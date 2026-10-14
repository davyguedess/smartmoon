from pydantic import BaseModel, EmailStr
from typing import Optional


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    company_id: int
    is_superadmin: bool = False

    # Plan info (populated by /auth/me handler)
    plan_id: Optional[int] = None
    plan_name: str = "free"
    plan_display_name: str = "Free"
    plan_color: str = "#64748b"
    modules: list[str] = []
    payment_pending: bool = False

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "operator"
