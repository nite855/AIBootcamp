"""Database engine, session lifecycle, healthcheck, and migration bootstrap."""

from collections.abc import Generator
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from backend.app.core.config import get_settings
from backend.app.db.base import Base
from backend.app.db.consent_seed import seed_consent_policies

_ENGINE: Engine | None = None
_SESSION_FACTORY: sessionmaker[Session] | None = None
_ACTIVE_URL: str | None = None


def _build_engine(database_url: str) -> Engine:
    connect_args: dict[str, object] = {}
    if database_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
    return create_engine(
        database_url,
        pool_pre_ping=True,
        connect_args=connect_args,
    )


def get_engine() -> Engine:
    global _ENGINE, _SESSION_FACTORY, _ACTIVE_URL
    url = get_settings().database_url
    if _ENGINE is None or _ACTIVE_URL != url:
        if _ENGINE is not None:
            _ENGINE.dispose()
        _ENGINE = _build_engine(url)
        _SESSION_FACTORY = sessionmaker(bind=_ENGINE, autocommit=False, autoflush=False)
        _ACTIVE_URL = url
    return _ENGINE


def get_session_factory() -> sessionmaker[Session]:
    get_engine()
    assert _SESSION_FACTORY is not None
    return _SESSION_FACTORY


def reset_db_engine() -> None:
    """Dispose cached engine (used when test fixtures swap DATABASE_URL)."""
    global _ENGINE, _SESSION_FACTORY, _ACTIVE_URL
    if _ENGINE is not None:
        _ENGINE.dispose()
    _ENGINE = None
    _SESSION_FACTORY = None
    _ACTIVE_URL = None


def get_db() -> Generator[Session, None, None]:
    session_factory = get_session_factory()
    db = session_factory()
    try:
        yield db
    finally:
        db.close()


def check_db_connection() -> tuple[bool, str | None]:
    try:
        engine = get_engine()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True, None
    except Exception as exc:
        return False, str(exc)


def run_migrations() -> None:
    alembic_ini = Path(__file__).resolve().parents[2] / "alembic.ini"
    cfg = Config(str(alembic_ini))
    cfg.set_main_option("sqlalchemy.url", get_settings().database_url)
    command.upgrade(cfg, "head")


def ensure_database_ready() -> None:
    """Run Alembic migrations (if enabled) and ensure initial consent policies exist."""
    settings = get_settings()
    engine = get_engine()
    if settings.auto_migrate_db:
        if settings.database_url.startswith("sqlite"):
            Base.metadata.create_all(bind=engine)
        else:
            run_migrations()
    with get_session_factory()() as db:
        seed_consent_policies(db)
