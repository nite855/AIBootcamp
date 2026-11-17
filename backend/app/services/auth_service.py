"""Authentication service handling registration, login, refresh rotation, logout, and withdrawal."""

from datetime import timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from backend.app.core.config import get_settings
from backend.app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_token,
    utc_now,
    verify_password,
)
from backend.app.db.models import RefreshToken, User, UserConsentLog
from backend.app.schemas.auth import (
    AuthMeResponse,
    AuthTokenResponse,
    AuthUserOut,
    ConsentItemInput,
    LoginRequest,
    RegisterRequest,
)
from backend.app.services.consent_service import apply_user_consents, evaluate_user_consents


class AuthError(ValueError):
    """Domain error with HTTP status and machine-readable code for auth flows."""

    def __init__(self, status_code: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code


def serialize_user(user: User) -> AuthUserOut:
    return AuthUserOut(
        id=str(user.id),
        login_id=user.login_id,
        email=user.email,
        nickname=user.nickname,
        is_adult_14_plus=user.is_adult_14_plus,
        created_at=user.created_at,
    )


def _issue_refresh_token(db: Session, user: User) -> str:
    settings = get_settings()
    raw = generate_refresh_token()
    now = utc_now()
    row = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(raw),
        expires_at=now + timedelta(days=settings.refresh_token_expire_days),
        revoked_at=None,
        created_at=now,
    )
    db.add(row)
    return raw


def _build_token_response(
    db: Session,
    user: User,
    *,
    issue_refresh: bool,
) -> tuple[AuthTokenResponse, str | None]:
    satisfied, missing_codes, consents = evaluate_user_consents(db, user.id)
    scope = "full" if satisfied else "consent_only"
    access_token, expires_in = create_access_token(
        user_id=str(user.id),
        login_id=user.login_id,
        token_scope=scope,
    )
    raw_refresh = _issue_refresh_token(db, user) if issue_refresh else None
    payload = AuthTokenResponse(
        access_token=access_token,
        expires_in=expires_in,
        consent_required=not satisfied,
        missing_required_codes=missing_codes,
        user=serialize_user(user),
        consents=consents,
    )
    return payload, raw_refresh


def register_user(
    db: Session,
    payload: RegisterRequest,
    *,
    client_meta_hash: str | None,
) -> tuple[AuthTokenResponse, str]:
    existing_id = db.scalar(select(User).where(User.login_id == payload.login_id))
    if existing_id is not None:
        raise AuthError(409, "LOGIN_ID_TAKEN", "이미 사용 중인 아이디입니다.")

    existing_email = db.scalar(select(User).where(User.email == payload.email))
    if existing_email is not None:
        raise AuthError(409, "EMAIL_TAKEN", "이미 등록된 이메일 주소입니다.")

    user = User(
        login_id=payload.login_id,
        email=payload.email,
        password_hash=hash_password(payload.password),
        nickname=payload.nickname or payload.login_id,
        is_adult_14_plus=False,
        is_active=True,
    )
    db.add(user)
    db.flush()

    apply_user_consents(
        db,
        user=user,
        submitted=payload.consents,
        client_meta_hash=client_meta_hash,
        require_all_mandatory=True,
    )

    response, raw_refresh = _build_token_response(db, user, issue_refresh=True)
    db.commit()
    db.refresh(user)
    assert raw_refresh is not None
    return response, raw_refresh


def login_user(
    db: Session,
    payload: LoginRequest,
) -> tuple[AuthTokenResponse, str | None]:
    user = db.scalar(select(User).where(User.login_id == payload.login_id))
    if user is None or not user.is_active or user.deleted_at is not None:
        raise AuthError(401, "INVALID_CREDENTIALS", "아이디 또는 비밀번호가 올바르지 않습니다.")
    if not verify_password(payload.password, user.password_hash):
        raise AuthError(401, "INVALID_CREDENTIALS", "아이디 또는 비밀번호가 올바르지 않습니다.")

    satisfied, _, _ = evaluate_user_consents(db, user.id)
    response, raw_refresh = _build_token_response(db, user, issue_refresh=satisfied)
    db.commit()
    return response, raw_refresh


def refresh_session(
    db: Session,
    raw_refresh_token: str | None,
) -> tuple[AuthTokenResponse, str | None]:
    if not raw_refresh_token:
        raise AuthError(401, "REFRESH_TOKEN_MISSING", "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.")

    token_hash = hash_token(raw_refresh_token)
    row = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    now = utc_now()
    if row is None or row.revoked_at is not None:
        raise AuthError(401, "INVALID_REFRESH_TOKEN", "유효하지 않은 로그인 세션입니다.")
    expires_at = row.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=now.tzinfo)
    if expires_at <= now:
        row.revoked_at = now
        db.commit()
        raise AuthError(401, "REFRESH_TOKEN_EXPIRED", "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.")

    user = db.scalar(select(User).where(User.id == row.user_id))
    if user is None or not user.is_active or user.deleted_at is not None:
        row.revoked_at = now
        db.commit()
        raise AuthError(401, "ACCOUNT_INACTIVE", "사용할 수 없는 계정입니다.")

    # Rotate refresh token on every refresh.
    row.revoked_at = now
    satisfied, _, _ = evaluate_user_consents(db, user.id)
    response, next_refresh = _build_token_response(db, user, issue_refresh=satisfied)
    db.commit()
    return response, next_refresh


def logout_session(db: Session, raw_refresh_token: str | None) -> None:
    if not raw_refresh_token:
        return
    token_hash = hash_token(raw_refresh_token)
    row = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    if row is not None and row.revoked_at is None:
        row.revoked_at = utc_now()
        db.commit()


def update_user_consents(
    db: Session,
    *,
    user: User,
    submitted: list[ConsentItemInput],
    client_meta_hash: str | None,
) -> tuple[AuthTokenResponse, str]:
    # Determine whether user currently lacks required consent (Consent Gate completion)
    # vs already active user toggling optional consents.
    was_satisfied, _, _ = evaluate_user_consents(db, user.id)
    apply_user_consents(
        db,
        user=user,
        submitted=submitted,
        client_meta_hash=client_meta_hash,
        require_all_mandatory=not was_satisfied,
    )
    response, raw_refresh = _build_token_response(db, user, issue_refresh=True)
    db.commit()
    assert raw_refresh is not None
    return response, raw_refresh


def get_me_status(db: Session, user: User) -> AuthMeResponse:
    satisfied, missing_codes, consents = evaluate_user_consents(db, user.id)
    return AuthMeResponse(
        consent_required=not satisfied,
        missing_required_codes=missing_codes,
        user=serialize_user(user),
        consents=consents,
    )


def withdraw_user(
    db: Session,
    *,
    user: User,
    password: str,
    client_meta_hash: str | None,
) -> None:
    if not verify_password(password, user.password_hash):
        raise AuthError(401, "INVALID_PASSWORD", "비밀번호가 일치하지 않습니다.")

    now = utc_now()
    user_ref_hash = hash_token(str(user.id))

    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )

    for consent in list(user.consents):
        if consent.agreed and consent.revoked_at is None:
            db.add(
                UserConsentLog(
                    user_id=None,
                    user_ref_hash=user_ref_hash,
                    policy_code=consent.policy_code,
                    policy_version=consent.policy_version,
                    action="WITHDRAWN",
                    client_meta_hash=client_meta_hash,
                    created_at=now,
                )
            )

    # Hard-delete user row so diary_records, collected_cards, user_consents, and refresh_tokens
    # cascade-delete immediately in compliance with PIPA Article 21 (destruction upon withdrawal).
    db.delete(user)
    db.commit()
