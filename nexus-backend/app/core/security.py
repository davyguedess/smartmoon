from datetime import datetime, timedelta, timezone
from hashlib import sha256
from typing import Optional
from uuid import uuid4
from jose import JWTError, jwt
import bcrypt as _bcrypt
from app.core.config import settings


def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def create_access_token(subject: str, extra: dict = None) -> str:
    # TASK 1.2 FIX: usa config em vez de hardcoded 8h (default: 15 min, recomendado: 30 min)
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    data = {"sub": subject, "exp": expire, "type": "access"}
    if extra:
        data.update(extra)
    return jwt.encode(data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(subject: str) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    # jti garante que dois tokens do mesmo usuário nunca colidam no hash único do banco
    data = {"sub": subject, "exp": expire, "iat": now, "jti": uuid4().hex, "type": "refresh"}
    return jwt.encode(data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


# Hash bcrypt de uma senha aleatória: usado para igualar o tempo de resposta
# quando o e-mail não existe (evita enumeração de usuários por timing).
_DUMMY_HASH = _bcrypt.hashpw(uuid4().hex.encode(), _bcrypt.gensalt()).decode()


def verify_password_or_dummy(plain: str, hashed: Optional[str]) -> bool:
    if not hashed:
        _bcrypt.checkpw(plain.encode(), _DUMMY_HASH.encode())
        return False
    return verify_password(plain, hashed)


def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


def hash_token(raw_token: str) -> str:
    """SHA-256 hex digest for storing refresh tokens in DB. Never store raw."""
    return sha256(raw_token.encode()).hexdigest()


def get_cookie_params() -> dict:
    """Returns cookie settings compatible with HTTP (no SSL) environments."""
    # Prioridade 1: Configuração explícita no .env
    if settings.COOKIE_SECURE is not None:
        is_secure = settings.COOKIE_SECURE
    else:
        # Prioridade 2: Auto-detect via URL e modo DEBUG
        has_ssl = settings.WEBHOOK_BASE_URL.startswith("https")
        is_secure = has_ssl and not settings.DEBUG
    
    return dict(
        httponly=True,
        secure=is_secure,
        samesite="lax",   # 'lax' works with HTTP and allows cookies on navigation
    )
