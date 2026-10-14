"""FastAPI dependency injection — Authentication & RBAC (Protocol 1 + Protocol 2).

HttpOnly cookie-based auth with multi-tenant isolation.
Falls back to Authorization: Bearer header for backward compatibility with tools/tests.
"""
from fastapi import Depends, HTTPException, Request, status
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import decode_token, verify_password
from app.db.session import get_db


# ── Token extraction ─────────────────────────────────────

def _extract_token(request: Request) -> Optional[str]:
    """Read access token from Authorization header first (for impersonation), then HttpOnly cookie."""
    # Priority 1: Authorization: Bearer (impersonation tokens & API clients)
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    # Priority 2: HttpOnly cookie (normal session)
    token = request.cookies.get("access_token")
    if token:
        return token
    return None


# ── Core authentication ──────────────────────────────────

async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Extract and validate JWT from cookie/header. Returns User model with _token_company_id."""
    token = _extract_token(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Não autenticado — faça login",
        )

    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
        )

    user_id = payload.get("sub")
    company_id = payload.get("company_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token sem subject")

    from app.db.repositories.user_repository import UserRepository
    repo = UserRepository(db)
    user = await repo.get_by_id(int(user_id))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Usuário não encontrado ou inativo")

    # Attach company_id from token (never trust frontend body)
    user._token_company_id = company_id or user.company_id
    user._token_role = payload.get("role", user.role)
    return user


# ── Role-based access ────────────────────────────────────

async def require_admin(user=Depends(get_current_user)):
    """Require owner or admin role (tenant-level)."""
    if user.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Permissão insuficiente — requer admin")
    return user


async def require_superadmin(user=Depends(get_current_user)):
    """Require NEXUS.IA internal superadmin — cross-tenant admin panel access.
    Only users with is_superadmin=True can access global admin endpoints.
    """
    if not getattr(user, "is_superadmin", False):
        raise HTTPException(
            status_code=403,
            detail="Acesso restrito — painel administrativo da Smart Moon requer superadmin",
        )
    return user


async def require_owner_only(user=Depends(get_current_user)):
    """Require owner role only — most sensitive operations."""
    if user.role != "owner":
        raise HTTPException(status_code=403, detail="Apenas o proprietário pode realizar esta ação")
    return user


def require_role(*allowed_roles: str):
    """Factory: Depends(require_role('owner', 'admin', 'operator'))"""
    async def _inner(user=Depends(get_current_user)):
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Role '{user.role}' não tem acesso a este recurso",
            )
        return user
    return _inner


# ── Multi-tenant isolation ───────────────────────────────

def require_company_scope(resource_company_id: int):
    """Validate that the authenticated user belongs to the same company as the resource."""
    async def _check(user=Depends(get_current_user)):
        if user._token_company_id != resource_company_id:
            raise HTTPException(
                status_code=403,
                detail="Acesso negado — recurso de outra empresa",
            )
        return user
    return _check


async def validate_company_access(user, resource_company_id: int) -> None:
    """Inline check: raises 403 if user's company != resource company.
    Use directly in route handlers for dynamic resource validation.
    """
    if user._token_company_id != resource_company_id:
        raise HTTPException(
            status_code=403,
            detail="Acesso negado — recurso pertence a outra empresa",
        )


# ── Re-authentication for sensitive actions ──────────────

async def require_reauth(
    request: Request,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Require password confirmation for sensitive actions.
    Expects header X-Reauth-Password with the user's current password.
    """
    password = request.headers.get("X-Reauth-Password")
    if not password:
        raise HTTPException(
            status_code=403,
            detail="Ação sensível requer confirmação de senha (header X-Reauth-Password)",
        )

    from app.db.repositories.user_repository import UserRepository
    repo = UserRepository(db)
    db_user = await repo.get_by_id(user.id)

    if not db_user or not verify_password(password, db_user.password_hash):
        raise HTTPException(
            status_code=403,
            detail="Senha incorreta — reautenticação falhou",
        )

    return user


# ── WebSocket auth helper ────────────────────────────────

async def decode_token_from_string(
    token: str,
    db: AsyncSession,
):
    """Validate a raw JWT string — used by WebSocket endpoints where Request is unavailable."""
    from app.core.security import decode_token as _decode
    from app.db.repositories.user_repository import UserRepository

    payload = _decode(token)
    if not payload or payload.get("type") != "access":
        raise ValueError("Token inválido ou expirado")

    user_id = payload.get("sub")
    company_id = payload.get("company_id")
    if not user_id:
        raise ValueError("Token sem subject")

    repo = UserRepository(db)
    user = await repo.get_by_id(int(user_id))
    if not user or not user.is_active:
        raise ValueError("Usuário não encontrado ou inativo")

    user._token_company_id = company_id or user.company_id
    user._token_role = payload.get("role", user.role)
    return user


# ── Plan feature guards ──────────────────────────────────────────────────────

def require_plan_feature(feature: str):
    """
    Dependency factory — blocks a route if the company's plan doesn't include `feature`.

    Usage:
        @router.get("/voice")
        async def voice_page(user=Depends(require_plan_feature("tts")), ...):
            ...
    """
    from app.db.repositories.plan_repository import PlanRepository

    async def _check(
        user=Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ):
        try:
            repo = PlanRepository(db)
            modules = await repo.get_modules_for_company(user.company_id)
            if "*" in modules or feature in modules:
                return user
            raise HTTPException(
                status_code=403,
                detail=(
                    f"A funcionalidade '{feature}' não está disponível no seu plano atual. "
                    f"Faça upgrade para acessar este recurso."
                ),
            )
        except HTTPException:
            raise
        except Exception:
            # If DB check fails, allow through (fail-open for availability)
            return user

    return _check


def require_quota_not_exceeded(resource: str):
    """
    Dependency factory — blocks a route if the company is over quota for `resource`.

    resource options: "flows", "agents", "executions", "skills", "integrations"

    Usage:
        @router.post("/flows")
        async def create_flow(user=Depends(require_quota_not_exceeded("flows")), ...):
            ...
    """
    from app.services.billing_service import get_quota_status

    async def _check(
        user=Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ):
        try:
            quota = await get_quota_status(user.company_id, db)
            over = quota.get("over_quota", {})
            if over.get(resource, False):
                plan = quota.get("plan_label", quota.get("plan", "atual"))
                limit = quota.get("limits", {}).get(f"{resource}_max", "?")
                raise HTTPException(
                    status_code=402,
                    detail=(
                        f"Limite de {limit} {resource} atingido no plano {plan}. "
                        f"Faça upgrade para continuar."
                    ),
                )
        except HTTPException:
            raise
        except Exception:
            pass  # fail-open
        return user

    return _check
