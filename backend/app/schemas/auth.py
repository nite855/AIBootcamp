"""Pydantic schemas for JWT authentication, registration, PIPA consents, and account management."""

from datetime import datetime
import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

LOGIN_ID_RE = re.compile(r"^[a-z0-9_.-]{4,32}$")


class ConsentItemInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(min_length=1, max_length=64)
    version: int = Field(ge=1)
    agreed: bool


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    login_id: str = Field(min_length=4, max_length=32)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    nickname: str | None = Field(default=None, max_length=32)
    consents: list[ConsentItemInput] = Field(min_length=1)

    @field_validator("login_id")
    @classmethod
    def _normalize_login_id(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not LOGIN_ID_RE.match(normalized):
            raise ValueError("아이디는 4~32자의 영문 소문자, 숫자, _, ., -만 사용할 수 있습니다.")
        return normalized

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()

    @field_validator("password")
    @classmethod
    def _validate_password(cls, value: str) -> str:
        if "\x00" in value or not value.strip():
            raise ValueError("비밀번호 형식이 올바르지 않습니다.")
        if len(value) < 8:
            raise ValueError("비밀번호는 8자 이상이어야 합니다.")
        return value

    @field_validator("nickname")
    @classmethod
    def _normalize_nickname(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            return None
        if "\x00" in cleaned:
            raise ValueError("닉네임에 사용할 수 없는 문자가 포함되어 있습니다.")
        return cleaned


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    login_id: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("login_id")
    @classmethod
    def _normalize_login_id(cls, value: str) -> str:
        return value.strip().lower()


class ConsentUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    consents: list[ConsentItemInput] = Field(min_length=1)


class WithdrawRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    password: str = Field(min_length=1, max_length=128)
    confirm_withdrawal: Literal[True]


class ConsentPolicyOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str
    version: int
    title: str
    summary: str
    purpose: str
    items: str
    retention_period: str
    refusal_notice: str
    is_required: bool
    is_sensitive: bool
    display_order: int


class UserConsentStatusOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str
    version: int
    title: str
    summary: str
    purpose: str
    items: str
    retention_period: str
    refusal_notice: str
    is_required: bool
    is_sensitive: bool
    display_order: int
    agreed: bool
    agreed_at: datetime | None = None
    revoked_at: datetime | None = None
    needs_reconsent: bool


class AuthUserOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    login_id: str
    email: str
    nickname: str
    is_adult_14_plus: bool
    created_at: datetime


class AuthTokenResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
    consent_required: bool
    missing_required_codes: list[str]
    user: AuthUserOut
    consents: list[UserConsentStatusOut]


class AuthMeResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    consent_required: bool
    missing_required_codes: list[str]
    user: AuthUserOut
    consents: list[UserConsentStatusOut]


class MessageResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str
