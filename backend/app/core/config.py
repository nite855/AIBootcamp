"""Application configuration loaded from environment variables."""

from dataclasses import dataclass
from functools import lru_cache
import os


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str
    access_token_expire_minutes: int
    refresh_token_expire_days: int
    cookie_secure: bool
    consent_hash_salt: str
    auto_migrate_db: bool
    max_records_per_user: int = 100
    refresh_cookie_name: str = "moment_refresh_token"
    refresh_cookie_path: str = "/api/auth"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        database_url=os.environ.get("DATABASE_URL", "sqlite:///./moment_local.db"),
        jwt_secret_key=os.environ.get(
            "JWT_SECRET_KEY", "dev-change-me-jwt-secret-key-at-least-32-bytes"
        ),
        jwt_algorithm=os.environ.get("JWT_ALGORITHM", "HS256"),
        access_token_expire_minutes=int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "15")),
        refresh_token_expire_days=int(os.environ.get("REFRESH_TOKEN_EXPIRE_DAYS", "14")),
        cookie_secure=_as_bool(os.environ.get("COOKIE_SECURE"), default=False),
        consent_hash_salt=os.environ.get("CONSENT_HASH_SALT", "dev-consent-salt"),
        auto_migrate_db=_as_bool(os.environ.get("AUTO_MIGRATE_DB"), default=True),
    )


def reset_settings_cache() -> None:
    """Clear cached settings (useful when tests mutate environment variables)."""
    get_settings.cache_clear()
