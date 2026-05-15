from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

AccountType = Literal["giver", "receiver"]


class UserResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    account_type: AccountType | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    can_change_username: bool = False
    username_change_deadline: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class SignupRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    account_type: AccountType


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenPayload(BaseModel):
    sub: str
    email: EmailStr


class ProfileUpdateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
