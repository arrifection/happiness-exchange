from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.services.location import SUPPORTED_COUNTRIES, normalize_country
from app.core.roles import UserRole
from app.core.whatsapp import validate_whatsapp_number


class UserResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str = UserRole.USER
    account_type: str = "member"
    country: str = "Pakistan"
    whatsapp_number: str | None = None
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
    whatsapp_number: str = Field(min_length=1, max_length=24)
    country: str = "Pakistan"

    @field_validator("whatsapp_number")
    @classmethod
    def validate_whatsapp(cls, value: str) -> str:
        return validate_whatsapp_number(value)

    @field_validator("country")
    @classmethod
    def validate_country(cls, value: str) -> str:
        normalized = normalize_country(value)
        if normalized not in SUPPORTED_COUNTRIES:
            raise ValueError("Country must be Pakistan or Saudi Arabia.")
        return normalized


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    country: str | None = None

    @field_validator("country")
    @classmethod
    def validate_country(cls, value: str | None) -> str | None:
        if value is None or not str(value).strip():
            return None
        normalized = normalize_country(value)
        if normalized not in SUPPORTED_COUNTRIES:
            raise ValueError("Country must be Pakistan or Saudi Arabia.")
        return normalized


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class AcceptInviteRequest(BaseModel):
    token: str = Field(min_length=32, max_length=128)
    password: str = Field(min_length=8, max_length=72)


class InvitePreviewResponse(BaseModel):
    email: EmailStr
    name: str
    role: str
    expires_at: datetime | None = None


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


class CountryUpdateRequest(BaseModel):
    country: str

    @field_validator("country")
    @classmethod
    def validate_country(cls, value: str) -> str:
        normalized = normalize_country(value)
        if normalized not in SUPPORTED_COUNTRIES:
            raise ValueError("Country must be Pakistan or Saudi Arabia.")
        return normalized


class WhatsAppUpdateRequest(BaseModel):
    whatsapp_number: str = Field(min_length=1, max_length=24)

    @field_validator("whatsapp_number")
    @classmethod
    def validate_whatsapp(cls, value: str) -> str:
        return validate_whatsapp_number(value)
