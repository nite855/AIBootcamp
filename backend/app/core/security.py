"""Password hashing, JWT access tokens, opaque refresh tokens, and consent audit hashing."""

from datetime import datetime, timedelta, timezone
import hashlib
import secrets
from typing import Any

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
import jwt

from backend.app.core.config import get_settings

_PASSWORD_HASHER = PasswordHasher()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def hash_password(password: str) -> str:
    return _PASSWORD_HASHER.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _PASSWORD_HASHER.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def create_access_token(
    *,
    user_id: str,
    login_id: str,
    token_scope: str = "full",
    expires_delta: timedelta | None = None,
) -> tuple[str, int]:
    """Create a signed JWT access token and return (token, expires_in_seconds)."""
    settings = get_settings()
    now = utc_now()
    delta = expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    exp = now + delta
    payload: dict[str, Any] = {
        "sub": user_id,
        "login_id": login_id,
        "scope": token_scope,
        "typ": "access",
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
        "jti": secrets.token_hex(12),
    }
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return token, int(delta.total_seconds())


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate a signed JWT access token."""
    settings = get_settings()
    payload = jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )
    if payload.get("typ") != "access" or not payload.get("sub"):
        raise jwt.InvalidTokenError("Invalid access token claims")
    return payload


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def hash_client_meta(ip_address: str | None, user_agent: str | None) -> str:
    """Create a salted one-way digest of client metadata for PIPA consent audit logs."""
    settings = get_settings()
    raw = f"{settings.consent_hash_salt}|{ip_address or ''}|{user_agent or ''}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
