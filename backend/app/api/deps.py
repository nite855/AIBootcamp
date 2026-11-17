"""FastAPI dependencies for JWT authentication and Korean PIPA consent gating."""

from dataclasses import dataclass
import uuid

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.core.security import decode_access_token
from backend.app.db.models import User
from backend.app.db.session import get_db
from backend.app.services.consent_service import evaluate_user_consents

_BEARER_SCHEME = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthenticatedPrincipal:
    user: User
    token_scope: str


def get_current_principal(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_BEARER_SCHEME),
    db: Session = Depends(get_db),
) -> AuthenticatedPrincipal:
    if credentials is None or credentials.scheme.lower() != "bearer" or not credentials.credentials:
        raise HTTPException(
            status_code=401,
            detail="로그인이 필요합니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_access_token(credentials.credentials)
        user_uuid = uuid.UUID(str(payload["sub"]))
    except (jwt.PyJWTError, ValueError, KeyError) as exc:
        raise HTTPException(
            status_code=401,
            detail="인증 토큰이 유효하지 않거나 만료되었습니다.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user = db.scalar(select(User).where(User.id == user_uuid))
    if user is None or not user.is_active or user.deleted_at is not None:
        raise HTTPException(
            status_code=401,
            detail="유효하지 않은 계정입니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    request.state.auth_user_id = str(user.id)
    return AuthenticatedPrincipal(user=user, token_scope=str(payload.get("scope", "full")))


def require_active_consents(
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> User:
    if principal.token_scope != "full":
        raise HTTPException(
            status_code=403,
            detail="필수 개인정보 및 민감정보 처리 동의가 필요합니다.",
        )

    satisfied, missing_codes, _ = evaluate_user_consents(db, principal.user.id)
    if not satisfied:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "CONSENT_REQUIRED",
                "message": "최신 필수 개인정보 및 민감정보 처리 동의가 필요합니다.",
                "missing_required_codes": missing_codes,
            },
        )
    return principal.user
