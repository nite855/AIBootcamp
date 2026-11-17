"""Authentication and Korean PIPA consent endpoints (/api/auth/*)."""

from fastapi import APIRouter, Cookie, Depends, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from backend.app.api.deps import AuthenticatedPrincipal, get_current_principal
from backend.app.core.config import get_settings
from backend.app.core.security import hash_client_meta
from backend.app.db.session import get_db
from backend.app.schemas.auth import (
    AuthMeResponse,
    AuthTokenResponse,
    ConsentPolicyOut,
    ConsentUpdateRequest,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    WithdrawRequest,
)
from backend.app.services.auth_service import (
    AuthError,
    get_me_status,
    login_user,
    logout_session,
    refresh_session,
    register_user,
    update_user_consents,
    withdraw_user,
)
from backend.app.services.consent_service import (
    ConsentValidationError,
    get_active_policies,
    serialize_policy,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _client_meta_hash(request: Request) -> str:
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    return hash_client_meta(ip, ua)


def _set_refresh_cookie(response: Response, raw_token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=raw_token,
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path=settings.refresh_cookie_path,
    )


def _clear_refresh_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        key=settings.refresh_cookie_name,
        path=settings.refresh_cookie_path,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
    )


def _auth_error_response(status_code: int, code: str, detail: str, **extra: object) -> JSONResponse:
    body: dict[str, object] = {"detail": detail, "code": code, **extra}
    return JSONResponse(status_code=status_code, content=body)


@router.get("/consent-policies", response_model=list[ConsentPolicyOut])
def list_consent_policies(db: Session = Depends(get_db)) -> list[ConsentPolicyOut]:
    return [serialize_policy(p) for p in get_active_policies(db)]


@router.post("/register", response_model=AuthTokenResponse, status_code=201)
def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthTokenResponse | JSONResponse:
    try:
        token_payload, raw_refresh = register_user(
            db,
            payload,
            client_meta_hash=_client_meta_hash(request),
        )
    except ConsentValidationError as exc:
        db.rollback()
        return _auth_error_response(
            422,
            exc.code,
            str(exc),
            missing_required_codes=exc.missing_codes,
        )
    except AuthError as exc:
        db.rollback()
        return _auth_error_response(exc.status_code, exc.code, str(exc))

    _set_refresh_cookie(response, raw_refresh)
    return token_payload


@router.post("/login", response_model=AuthTokenResponse)
def login(
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthTokenResponse | JSONResponse:
    try:
        token_payload, raw_refresh = login_user(db, payload)
    except AuthError as exc:
        return _auth_error_response(exc.status_code, exc.code, str(exc))

    if raw_refresh is not None:
        _set_refresh_cookie(response, raw_refresh)
    else:
        _clear_refresh_cookie(response)
    return token_payload


@router.post("/refresh", response_model=AuthTokenResponse)
def refresh(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    moment_refresh_token: str | None = Cookie(default=None),
) -> AuthTokenResponse | JSONResponse:
    cookie_name = get_settings().refresh_cookie_name
    raw_token = request.cookies.get(cookie_name) or moment_refresh_token
    try:
        token_payload, next_refresh = refresh_session(db, raw_token)
    except AuthError as exc:
        _clear_refresh_cookie(response)
        return _auth_error_response(exc.status_code, exc.code, str(exc))

    if next_refresh is not None:
        _set_refresh_cookie(response, next_refresh)
    else:
        _clear_refresh_cookie(response)
    return token_payload


@router.post("/logout", response_model=MessageResponse)
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    moment_refresh_token: str | None = Cookie(default=None),
) -> MessageResponse:
    cookie_name = get_settings().refresh_cookie_name
    raw_token = request.cookies.get(cookie_name) or moment_refresh_token
    logout_session(db, raw_token)
    _clear_refresh_cookie(response)
    return MessageResponse(message="로그아웃되었습니다.")


@router.get("/me", response_model=AuthMeResponse)
def me(
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> AuthMeResponse:
    return get_me_status(db, principal.user)


@router.put("/consents", response_model=AuthTokenResponse)
def update_consents(
    payload: ConsentUpdateRequest,
    request: Request,
    response: Response,
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> AuthTokenResponse | JSONResponse:
    try:
        token_payload, raw_refresh = update_user_consents(
            db,
            user=principal.user,
            submitted=payload.consents,
            client_meta_hash=_client_meta_hash(request),
        )
    except ConsentValidationError as exc:
        db.rollback()
        return _auth_error_response(
            422,
            exc.code,
            str(exc),
            missing_required_codes=exc.missing_codes,
        )

    _set_refresh_cookie(response, raw_refresh)
    return token_payload


@router.post("/withdraw", response_model=MessageResponse)
def withdraw(
    payload: WithdrawRequest,
    request: Request,
    response: Response,
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> MessageResponse | JSONResponse:
    try:
        withdraw_user(
            db,
            user=principal.user,
            password=payload.password,
            client_meta_hash=_client_meta_hash(request),
        )
    except AuthError as exc:
        db.rollback()
        return _auth_error_response(exc.status_code, exc.code, str(exc))

    _clear_refresh_cookie(response)
    return MessageResponse(message="회원 탈퇴 및 개인정보·민감정보 파기가 완료되었습니다.")
