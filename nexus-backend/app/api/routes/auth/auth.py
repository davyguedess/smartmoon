"""Auth routes — login/refresh/logout using HttpOnly cookies (Protocol 1).

Session flow:
  POST /auth/login  → sets access_token + refresh_token as HttpOnly cookies
  POST /auth/refresh → rotates refresh token, issues new pair
  POST /auth/logout  → revokes all refresh tokens for user, clears cookies
  GET  /auth/me      → returns current user info
"""
from typing import Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, text
from loguru import logger

from app.db.session import get_db
from app.db.repositories.user_repository import UserRepository
from app.core.security import (
    verify_password_or_dummy, create_access_token, create_refresh_token,
    decode_token, hash_token, get_cookie_params,
)
from app.core.dependencies import get_current_user
from app.core.config import settings
from app.core.rate_limiter import check_login_rate, record_failed_login, clear_login_attempts
from app.services.audit_service import audit, audit_anonymous
from app.models import RefreshToken
from app.schemas.auth import UserOut
from app.core.security_events import log_security_event, extract_request_info

router = APIRouter(prefix="/auth", tags=["Auth"])

ACCESS_MAX_AGE = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60  # Sincronizado com JWT
REFRESH_MAX_AGE = 30 * 24 * 3600  # 30 days


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    """Attach both tokens as HttpOnly cookies to the response."""
    cookie = get_cookie_params()
    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=ACCESS_MAX_AGE,
        path="/",
        **cookie,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=REFRESH_MAX_AGE,
        path="/auth",   # enviado a /auth/refresh E /auth/logout (logout precisa revogar)
        **cookie,
    )


def _clear_auth_cookies(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/auth")
    # cookies antigos gravados com o path restrito
    response.delete_cookie("refresh_token", path="/auth/refresh")


@router.post("/login")
async def login(
    request: Request,
    response: Response,
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    # Protocol 1: brute-force protection
    check_login_rate(request, form.username)

    repo = UserRepository(db)
    user = await repo.get_by_email(form.username)
    if not verify_password_or_dummy(form.password, user.password_hash if user else None):
        record_failed_login(request, form.username)
        await audit_anonymous(db, "auth.login_failed", {"email": form.username}, ip_address=request.client.host if request.client else None)
        req_info = extract_request_info(request)
        await log_security_event(db, "login_failed", ip_address=req_info["ip_address"], user_agent=req_info["user_agent"], extra_metadata={"email": form.username})
        await db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email ou senha incorretos")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Usuário inativo")

    # Success — clear attempt counter
    clear_login_attempts(request, form.username)

    extra = {"role": user.role, "company_id": user.company_id, "is_superadmin": bool(getattr(user, "is_superadmin", False))}
    access_token = create_access_token(str(user.id), extra)
    refresh_token = create_refresh_token(str(user.id))

    rt = RefreshToken(
        user_id=user.id,
        company_id=user.company_id,
        token_hash=hash_token(refresh_token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        device_info=request.headers.get("User-Agent", "")[:500],
        ip_address=request.client.host if request.client else None,
    )
    db.add(rt)
    await db.commit()

    _set_auth_cookies(response, access_token, refresh_token)
    await audit(db, user, "auth.login", "user", user.id, ip_address=request.client.host if request.client else None)
    req_info = extract_request_info(request)
    await log_security_event(db, "login_success", user_id=user.id, ip_address=req_info["ip_address"], user_agent=req_info["user_agent"])
    # Return minimal info — NOT the tokens (they are in cookies)
    return {"message": "Login realizado com sucesso", "user_id": user.id, "role": user.role}



@router.post("/refresh")
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    raw_refresh = request.cookies.get("refresh_token")
    if not raw_refresh:
        raise HTTPException(status_code=401, detail="Refresh token não encontrado")

    payload = decode_token(raw_refresh)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Refresh token inválido")

    token_hash = hash_token(raw_refresh)

    # SELECT ... FOR UPDATE to serialize concurrent refresh attempts
    result = await db.execute(
        select(RefreshToken)
        .where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked == False,  # noqa: E712
        )
        .with_for_update(skip_locked=True)
    )
    db_token = result.scalar_one_or_none()
    if not db_token:
        raise HTTPException(status_code=401, detail="Refresh token revogado ou inválido")

    if db_token.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Refresh token expirado — faça login novamente")

    db_token.revoked = True
    await db.flush()

    user_id = payload.get("sub")
    repo = UserRepository(db)
    user = await repo.get_by_id(int(user_id))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Usuário não encontrado ou inativo")

    extra = {"role": user.role, "company_id": user.company_id, "is_superadmin": bool(getattr(user, "is_superadmin", False))}
    new_access = create_access_token(str(user.id), extra)
    new_refresh = create_refresh_token(str(user.id))

    try:
        new_rt = RefreshToken(
            user_id=user.id,
            company_id=user.company_id,
            token_hash=hash_token(new_refresh),
            expires_at=datetime.now(timezone.utc) + timedelta(days=30),
            device_info=request.headers.get("User-Agent", "")[:500],
            ip_address=request.client.host if request.client else None,
        )
        db.add(new_rt)
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=401, detail="Refresh concorrente — use o token mais recente")

    _set_auth_cookies(response, new_access, new_refresh)
    return {"message": "Token renovado com sucesso"}


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    raw_refresh = request.cookies.get("refresh_token")
    if raw_refresh:
        token_hash = hash_token(raw_refresh)
        # Revoke all tokens for this user (all devices) or just this one
        result = await db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        db_token = result.scalar_one_or_none()
        if db_token:
            # Revoke all tokens for this user (logout from all devices)
            await db.execute(
                update(RefreshToken)
                .where(RefreshToken.user_id == db_token.user_id, RefreshToken.revoked == False)  # noqa: E712
                .values(revoked=True)
            )
            await db.commit()

    _clear_auth_cookies(response)
    return {"message": "Logout realizado com sucesso"}


@router.get("/me", response_model=UserOut)
async def me(current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Return current user info enriched with plan and modules."""
    plan_row = await db.execute(
        text(
            "SELECT p.id, p.name, p.display_name, p.color, CAST(p.modules AS text) "
            "FROM companies c "
            "LEFT JOIN plans p ON p.name = c.plan "
            "WHERE c.id = :cid "
            "LIMIT 1"
        ),
        {"cid": current_user.company_id},
    )
    plan = plan_row.fetchone()

    import json as _json
    plan_id = plan[0] if plan else None
    plan_name = plan[1] if plan and plan[1] else "free"
    plan_display = plan[2] if plan and plan[2] else "Free"
    plan_color = plan[3] if plan and plan[3] else "#64748b"
    try:
        modules = _json.loads(plan[4]) if plan and plan[4] else []
    except Exception:
        modules = []

    # ── Payment pending check ──────────────────────────────────────────────
    payment_pending = False
    if plan_name != "free":
        try:
            sub_r = await db.execute(
                text(
                    "SELECT status FROM subscriptions "
                    "WHERE company_id = :cid AND (expires_at IS NULL OR expires_at > NOW()) "
                    "ORDER BY created_at DESC LIMIT 1"
                ),
                {"cid": current_user.company_id},
            )
            sub_row = sub_r.fetchone()
            if sub_row and sub_row[0] == "pending_payment":
                payment_pending = True
                # Restrict modules to Free-tier while payment is pending
                modules = []
        except Exception:
            pass

    return UserOut(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role=current_user.role,
        company_id=current_user.company_id,
        is_superadmin=getattr(current_user, "is_superadmin", False),
        plan_id=plan_id,
        plan_name=plan_name,
        plan_display_name=plan_display,
        plan_color=plan_color,
        modules=modules,
        payment_pending=payment_pending,
    )


# ── Register ─────────────────────────────────────────

from pydantic import BaseModel, EmailStr
from app.models import Company


class RegisterIn(BaseModel):
    email: str
    password: str
    full_name: str = ""
    document: str = ""           # CPF or CNPJ
    document_type: str = ""      # "cpf" or "cnpj"
    birth_date: str = ""         # "YYYY-MM-DD"
    company_name: str = ""       # only for CNPJ
    accepted_terms: bool = False
    plan_id: int = 0             # Selected plan ID (0 = free default)


@router.post("/register")
async def register(
    body: RegisterIn,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Register a new user with full profile data (pure-SQL, no ORM flush)."""
    from app.core.security import hash_password

    # Validate
    if not body.accepted_terms:
        raise HTTPException(status_code=400, detail="Você deve aceitar os termos de uso")
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Senha deve ter no mínimo 8 caracteres")

    # Check duplicate email
    dup = await db.execute(
        text("SELECT id FROM users WHERE LOWER(email) = LOWER(:email) LIMIT 1"),
        {"email": body.email},
    )
    if dup.fetchone():
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")

    # Resolve plan
    selected_plan_id: Optional[int] = None
    selected_plan_name = "free"
    if body.plan_id and body.plan_id > 0:
        plan_r = await db.execute(
            text("SELECT id, name FROM plans WHERE id = :pid AND is_active = true LIMIT 1"),
            {"pid": body.plan_id},
        )
        row = plan_r.fetchone()
        if row:
            selected_plan_id, selected_plan_name = row[0], row[1]
    if not selected_plan_id:
        plan_r = await db.execute(
            text("SELECT id, name FROM plans WHERE name = 'free' AND is_active = true LIMIT 1")
        )
        row = plan_r.fetchone()
        if row:
            selected_plan_id, selected_plan_name = row[0], row[1]

    # Company name
    company_display = (
        body.company_name
        if (body.document_type == "cnpj" and body.company_name)
        else (body.full_name or body.email.split("@")[0])
    )

    # Create company
    comp_r = await db.execute(
        text(
            "INSERT INTO companies (name, plan, created_at, updated_at) "
            "VALUES (:name, :plan, NOW(), NOW()) RETURNING id"
        ),
        {"name": company_display, "plan": selected_plan_name},
    )
    company_id: int = comp_r.fetchone()[0]

    # Optionally set plan_id on company (use SAVEPOINT to not abort transaction if column missing)
    if selected_plan_id:
        try:
            await db.execute(text("SAVEPOINT sp_plan_id"))
            await db.execute(
                text("UPDATE companies SET plan_id = :pid WHERE id = :cid"),
                {"pid": selected_plan_id, "cid": company_id},
            )
            await db.execute(text("RELEASE SAVEPOINT sp_plan_id"))
        except Exception:
            try:
                await db.execute(text("ROLLBACK TO SAVEPOINT sp_plan_id"))
            except Exception:
                pass

    # Create user
    name = body.full_name or body.email.split("@")[0]
    pw_hash = hash_password(body.password)
    user_r = await db.execute(
        text(
            "INSERT INTO users (company_id, name, email, password_hash, role, is_active, created_at, updated_at) "
            "VALUES (:cid, :name, LOWER(:email), :pw, 'owner', true, NOW(), NOW()) RETURNING id, company_id, role"
        ),
        {"cid": company_id, "name": name, "email": body.email, "pw": pw_hash},
    )
    urow = user_r.fetchone()
    user_id, user_company_id, user_role = urow[0], urow[1], urow[2]

    # Extra user fields
    if body.document or body.document_type or body.birth_date:
        sets, params = [], {"uid": user_id}
        if body.document:
            sets.append("document = :doc"); params["doc"] = body.document
        if body.document_type:
            sets.append("document_type = :dtype"); params["dtype"] = body.document_type
        if body.birth_date:
            try:
                from datetime import date as _date
                parts = body.birth_date.split("-")
                parsed_bd = _date(int(parts[0]), int(parts[1]), int(parts[2]))
                sets.append("birth_date = :bdate"); params["bdate"] = parsed_bd  # date object, not string
            except Exception:
                pass
        if sets:
            await db.execute(
                text(f"UPDATE users SET {', '.join(sets)}, updated_at=NOW() WHERE id = :uid"),
                params,
            )

    # Commit all core data
    await db.commit()

    # Best-effort: create subscription + transaction
    pix_checkout = None
    try:
        if selected_plan_id:
            plan_det = await db.execute(
                text("SELECT price, duration_days FROM plans WHERE id = :pid"),
                {"pid": selected_plan_id},
            )
            prow = plan_det.fetchone()
            plan_price = float(prow[0]) if prow else 0.0
            duration = int(prow[1]) if prow else 30

            # PAYMENT GATE: free = active, paid = pending_payment
            sub_status = "active" if plan_price == 0 else "pending_payment"
            sub_r = await db.execute(
                text(
                    "INSERT INTO subscriptions (company_id, plan_id, status, started_at, expires_at) "
                    "VALUES (:cid, :pid, :status, NOW(), NOW() + make_interval(days => :days)) RETURNING id"
                ),
                {"cid": company_id, "pid": selected_plan_id, "days": duration, "status": sub_status},
            )
            sub_id = sub_r.fetchone()[0]

            tx_status = "paid" if plan_price == 0 else "pending"
            await db.execute(
                text(
                    "INSERT INTO transactions (company_id, subscription_id, plan_id, amount, "
                    "payment_method, status, description, paid_at) "
                    "VALUES (:cid, :sid, :pid, :amount, :method, :status, :desc, "
                    "CASE WHEN :status = 'paid' THEN NOW() ELSE NULL END)"
                ),
                {
                    "cid": company_id, "sid": sub_id, "pid": selected_plan_id,
                    "amount": plan_price,
                    "method": "auto" if plan_price == 0 else "pix",
                    "status": tx_status,
                    "desc": f"Registro - Plano {selected_plan_name}",
                },
            )
            await db.commit()

            # ── Generate PIX charge for paid plans ─────────────────────────
            pix_checkout = None
            if plan_price > 0:
                try:
                    from app.payments.providers.mercadopago_provider import MercadoPagoProvider
                    import uuid as _uuid
                    ext_ref = f"sub_{company_id}_{sub_id}"
                    provider = await MercadoPagoProvider.get_instance(db=db)
                    pix = await provider.create_pix_charge(
                        amount=plan_price,
                        description=f"Smart Moon - Plano {selected_plan_name}",
                        external_reference=ext_ref,
                        payer_email=body.email,
                    )
                    # Store external_id in transaction for webhook matching
                    await db.execute(
                        text("UPDATE transactions SET external_id = :eid WHERE subscription_id = :sid AND status = 'pending'"),
                        {"eid": pix.external_payment_id, "sid": sub_id},
                    )
                    await db.commit()
                    pix_checkout = {
                        "subscription_id": sub_id,
                        "plan_name": selected_plan_name,
                        "amount": plan_price,
                        "pix_qr_code": pix.pix_qr_code,
                        "pix_copy_paste": pix.pix_copy_paste_code,
                        "payment_link": pix.payment_link,
                        "external_payment_id": pix.external_payment_id,
                    }
                    logger.info(f"💳 PIX gerado para registro: R${plan_price:.2f} | empresa {company_id}")
                except Exception as pix_err:
                    logger.error(f"❌ Falha ao gerar PIX no registro: {pix_err}")
                    pix_checkout = None
    except Exception:
        try:
            await db.rollback()
        except Exception:
            pass

    # ── Créditos iniciais (onboarding) ────────────────────────────────────────
    # Free = 100 créditos para testar a plataforma
    # Planos pagos = 500 créditos de boas-vindas
    try:
        initial_credits = 500 if selected_plan_name != "free" else 100
        await db.execute(
            text(
                "INSERT INTO user_credits (company_id, balance, updated_at) "
                "VALUES (:cid, :bal, NOW()) "
                "ON CONFLICT (company_id) DO UPDATE SET "
                "  balance = user_credits.balance + :bal, "
                "  updated_at = NOW() "
                "WHERE user_credits.balance = 0"  # só adiciona se ainda não tem créditos
            ),
            {"cid": company_id, "bal": initial_credits},
        )
        await db.commit()
        logger.info(f"💰 {initial_credits} créditos iniciais concedidos à empresa {company_id} (plano: {selected_plan_name})")
    except Exception as ce:
        logger.warning(f"Não foi possível alocar créditos iniciais: {ce}")
        try:
            await db.rollback()
        except Exception:
            pass

    # Auto-login
    extra = {"role": user_role, "company_id": user_company_id}
    access_token = create_access_token(str(user_id), extra)
    refresh_token_val = create_refresh_token(str(user_id))

    try:
        await db.execute(
            text(
                "INSERT INTO refresh_tokens (user_id, company_id, token_hash, expires_at, device_info, ip_address) "
                "VALUES (:uid, :cid, :th, :exp, :dev, :ip)"
            ),
            {
                "uid": user_id,
                "cid": user_company_id,
                "th": hash_token(refresh_token_val),
                "exp": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
                "dev": request.headers.get("User-Agent", "")[:500],
                "ip": request.client.host if request.client else None,
            },
        )
        await db.commit()
    except Exception:
        try:
            await db.rollback()
        except Exception:
            pass

    _set_auth_cookies(response, access_token, refresh_token_val)

    # Return checkout data for paid plans
    result = {"message": "Conta criada com sucesso!", "user_id": user_id, "role": user_role}
    if pix_checkout:
        result["payment_required"] = True
        result["checkout"] = pix_checkout
    return result


# ── Public endpoints for registration page ────────────────────────────────

@router.get("/terms")
async def get_terms(db: AsyncSession = Depends(get_db)):
    """Public endpoint to get terms of service and privacy policy for the registration page."""
    from app.models import PlatformSettings
    result = await db.execute(
        select(PlatformSettings).where(PlatformSettings.key.in_(["terms_of_service", "privacy_policy"]))
    )
    settings = {row.key: row.value for row in result.scalars().all()}
    return {
        "terms_of_service": settings.get("terms_of_service", ""),
        "privacy_policy": settings.get("privacy_policy", ""),
    }


# ── Payment status polling endpoint ────────────────────────────────────────

@router.get("/payment-status")
async def payment_status(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if current user's subscription payment has been confirmed.
    Frontend polls this every 5s on the checkout page."""
    try:
        r = await db.execute(
            text("""
                SELECT s.status, s.id as sub_id,
                       t.status as tx_status, t.external_id,
                       p.display_name, p.price, p.name as plan_name
                FROM subscriptions s
                JOIN plans p ON p.id = s.plan_id
                LEFT JOIN transactions t ON t.subscription_id = s.id
                WHERE s.company_id = :cid
                ORDER BY s.created_at DESC LIMIT 1
            """),
            {"cid": current_user.company_id},
        )
        row = r.fetchone()

        if not row:
            return {"status": "free", "payment_required": False, "active": False}

        # BUG-08 FIX: índices corretos do SELECT:
        # 0=s.status, 1=sub_id, 2=tx_status, 3=external_id,
        # 4=display_name, 5=price, 6=plan_name (slug)
        return {
            "subscription_status": row[0],
            "subscription_id":     row[1],
            "payment_status":      row[2] or "unknown",
            "external_payment_id": row[3],
            "plan_name":           row[4],   # display_name
            "plan_slug":           row[6],   # name (slug)
            "amount":              float(row[5]) if row[5] else 0,
            "payment_required":    row[0] == "pending_payment",
            "active":              row[0] == "active",
        }
    except Exception as e:
        logger.warning(f"payment-status check failed: {e}")
        return {"status": "unknown", "payment_required": False, "active": False}


# ── WebSocket token helper ─────────────────────────────────────────────────────

@router.get("/ws-token")
async def ws_token(
    request: Request,
    user=Depends(get_current_user),
):
    """Return the current access token for use in WebSocket connections.

    WebSocket cannot send HttpOnly cookies in cross-origin scenarios.
    The returned token is the same access_token (already validated by get_current_user)
    and must be passed as ?token=<jwt> to the /ws/* endpoints.
    """
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Sem sessão ativa")
    return {"token": token}
