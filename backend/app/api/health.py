"""Liveness and readiness endpoints separating process life from model and database readiness."""

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from backend.app.db.session import check_db_connection
from backend.app.schemas.analysis import HealthLiveResponse, HealthReadyResponse

router = APIRouter(prefix="/api/health", tags=["health"])


@router.get("/live", response_model=HealthLiveResponse)
def health_live() -> HealthLiveResponse:
    return HealthLiveResponse(status="live")


@router.get("/ready", response_model=HealthReadyResponse)
def health_ready(request: Request) -> JSONResponse:
    is_ready = bool(getattr(request.app.state, "model_ready", False))
    model_version = getattr(request.app.state, "model_version", None)
    model_detail = getattr(request.app.state, "model_error", None)
    db_ok, db_error = check_db_connection()

    if not is_ready or not db_ok:
        details = []
        if not is_ready:
            details.append(model_detail or "감정 분석 모델이 아직 준비되지 않았습니다.")
        if not db_ok:
            details.append(db_error or "데이터베이스 연결에 실패했습니다.")
        payload = HealthReadyResponse(
            status="not_ready",
            model_loaded=is_ready,
            model_version=model_version,
            database_connected=db_ok,
            detail=" | ".join(details),
        )
        return JSONResponse(status_code=503, content=payload.model_dump())

    payload = HealthReadyResponse(
        status="ready",
        model_loaded=True,
        model_version=model_version,
        database_connected=True,
        detail=None,
    )
    return JSONResponse(status_code=200, content=payload.model_dump())
