"""
NEXUS.IA — /settings routes
Profile management + API key store (encrypted in DB).
Engine handlers check APIKeyStore FIRST, then fall back to .env.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
from typing import Optional
from cryptography.fernet import Fernet, InvalidToken
import base64

from app.db.session import get_db
from app.core.dependencies import get_current_user, require_admin
from app.core.config import settings
from app.models import UserProfile, APIKeyStore

router = APIRouter(prefix="/settings", tags=["Settings"])


# ── Fernet encryption helper ─────────────────────────────────────────────────

def _fernet() -> Fernet:
    key = settings.CREDENTIALS_ENCRYPTION_KEY.encode()
    # Ensure 32-byte Fernet key (URL-safe base64)
    padded = base64.urlsafe_b64encode(key[:32].ljust(32, b"="))
    return Fernet(padded)


def encrypt_key(plain: str) -> str:
    return _fernet().encrypt(plain.encode()).decode()


def decrypt_key(encrypted: str) -> str:
    try:
        return _fernet().decrypt(encrypted.encode()).decode()
    except (InvalidToken, Exception):
        return ""


# ── Schemas ──────────────────────────────────────────────────────────────────

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    timezone: Optional[str] = None
    language: Optional[str] = None
    preferences_json: Optional[dict] = None


class APIKeyIn(BaseModel):
    provider: str        # openai | gemini | claude | groq | elevenlabs | whatsapp | telegram | ...
    key: str
    label: Optional[str] = None


class APIKeyOut(BaseModel):
    provider: str
    label: Optional[str]
    is_active: bool
    has_key: bool        # True = key exists in DB (never expose raw key)
    last_used_at: Optional[datetime]


# ── Profile ──────────────────────────────────────────────────────────────────

@router.get("/profile")
async def get_profile(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = result.scalar_one_or_none()
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "company_id": user.company_id,
        "profile": {
            "avatar_url": profile.avatar_url if profile else None,
            "phone": profile.phone if profile else None,
            "bio": profile.bio if profile else None,
            "timezone": profile.timezone if profile else "America/Sao_Paulo",
            "language": profile.language if profile else "pt-BR",
            "preferences_json": profile.preferences_json if profile else {},
        }
    }


@router.put("/profile")
async def update_profile(body: ProfileUpdate, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = result.scalar_one_or_none()

    if not profile:
        profile = UserProfile(user_id=user.id)
        db.add(profile)

    if body.name and body.name != user.name:
        user.name = body.name
    if body.avatar_url is not None: profile.avatar_url = body.avatar_url
    if body.phone is not None: profile.phone = body.phone
    if body.bio is not None: profile.bio = body.bio
    if body.timezone is not None: profile.timezone = body.timezone
    if body.language is not None: profile.language = body.language
    if body.preferences_json is not None: profile.preferences_json = body.preferences_json

    await db.commit()
    return {"message": "Perfil atualizado com sucesso"}


# ── API Keys ─────────────────────────────────────────────────────────────────

@router.get("/api-keys")
async def list_api_keys(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    result = await db.execute(
        select(APIKeyStore).where(
            APIKeyStore.company_id == user.company_id,
            APIKeyStore.is_active == True
        )
    )
    keys = result.scalars().all()
    return [
        APIKeyOut(
            provider=k.provider,
            label=k.label,
            is_active=k.is_active,
            has_key=bool(k.encrypted_key),
            last_used_at=k.last_used_at,
        )
        for k in keys
    ]


@router.post("/api-keys")
async def save_api_key(body: APIKeyIn, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    # ── Provedores de pagamento são gerenciados exclusivamente pelo superadmin ──
    _PLATFORM_ONLY_PROVIDERS = {"mercadopago", "stripe", "pagseguro", "asaas", "pix_gateway"}
    if body.provider in _PLATFORM_ONLY_PROVIDERS:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=403,
            detail=(
                f"O provedor '{body.provider}' é gerenciado centralmente pela plataforma Smart Moon. "
                "Acesse o painel administrativo para configurar gateways de pagamento."
            )
        )

    # Upsert: update if provider already exists for this company
    result = await db.execute(
        select(APIKeyStore).where(
            APIKeyStore.company_id == user.company_id,
            APIKeyStore.provider == body.provider,
        )
    )
    record = result.scalar_one_or_none()

    encrypted = encrypt_key(body.key)

    if record:
        record.encrypted_key = encrypted
        record.is_active = True
        record.label = body.label or record.label
        record.user_id = user.id
    else:
        record = APIKeyStore(
            user_id=user.id,
            company_id=user.company_id,
            provider=body.provider,
            encrypted_key=encrypted,
            label=body.label or body.provider,
            is_active=True,
        )
        db.add(record)

    await db.commit()
    return {"message": f"Chave {body.provider} salva com sucesso"}


@router.delete("/api-keys/{provider}")
async def delete_api_key(provider: str, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    await db.execute(
        delete(APIKeyStore).where(
            APIKeyStore.company_id == user.company_id,
            APIKeyStore.provider == provider,
        )
    )
    await db.commit()
    return {"message": f"Chave {provider} removida"}


# ── Internal helper used by engine handlers ──────────────────────────────────

async def get_api_key_for_provider(provider: str, company_id: int, db: AsyncSession) -> Optional[str]:
    """Returns decrypted API key from DB, or None if not found."""
    result = await db.execute(
        select(APIKeyStore).where(
            APIKeyStore.company_id == company_id,
            APIKeyStore.provider == provider,
            APIKeyStore.is_active == True,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        return None
    # Update last_used_at
    record.last_used_at = datetime.now(timezone.utc)
    await db.commit()
    return decrypt_key(record.encrypted_key)
