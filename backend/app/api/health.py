"""Liveness and readiness endpoints separating process life from model readiness."""

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from backend.app.schemas.analysis import HealthLiveResponse, HealthReadyResponse

router = APIRouter(prefix="/api/health", tags=["health"])


@router.get("/live", response_model=HealthLiveResponse)
def health_live() -> HealthLiveResponse:
    return HealthLiveResponse(status="live")


@router.get("/ready", response_model=HealthReadyResponse)
def health_ready(request: Request) -> JSONResponse:
    is_ready = bool(getattr(request.app.state, "model_ready", False))
    model_version = getattr(request.app.state, "model_version", None)
    detail = getattr(request.app.state, "model_error", None)

    if not is_ready:
        payload = HealthReadyResponse(
            status="not_ready",
            model_loaded=False,
            model_version=model_version,
            detail=detail or "감정 분석 모델이 아직 준비되지 않았습니다.",
        )
        return JSONResponse(status_code=503, content=payload.model_dump())

    payload = HealthReadyResponse(
        status="ready",
        model_loaded=True,
        model_version=model_version,
        detail=None,
    )
    return JSONResponse(status_code=200, content=payload.model_dump())
