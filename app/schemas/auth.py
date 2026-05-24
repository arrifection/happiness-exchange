from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.core.roles import UserRole


class UserResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str = UserRole.USER
    account_type: str = "member"
    created_at: datetime | None = None
    updated_at: datetime | None = None
    is_verified: bool = False
    is_banned: bool = False
    can_change_username: bool = False
    username_change_deadline: datetime | None = None
    blocked_users: list[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class SignupRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class VerifyEmailResponse(BaseModel):
    message: str
    status: str  # "verified" | "already_verified"


class ResendVerificationResponse(BaseModel):
    message: str
    status: str = "sent"  # "sent" | "already_verified"


class TokenPayload(BaseModel):
    sub: str
    email: EmailStr
    role: str = UserRole.USER


class ProfileUpdateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
