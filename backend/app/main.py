"""Unified FastAPI entrypoint (`uvicorn backend.app.main:app`)."""

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI

from backend.app.api.analyze import router as analyze_router
from backend.app.api.health import router as health_router
from backend.app.ml.predictor import create_predictor
from backend.app.services.card_policy import evaluate_card


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.predictor = None
    app.state.model_ready = False
    app.state.model_version = None
    app.state.model_error = None
    app.state.card_evaluator = evaluate_card

    try:
        predictor = create_predictor()
        app.state.predictor = predictor
        app.state.model_version = getattr(predictor, "model_version", None)
        app.state.model_ready = hasattr(predictor, "predict_record")
        if not app.state.model_ready:
            app.state.model_error = "9감정 기록 단위 추론기(MODEL-02)가 아직 연결되지 않았습니다."
    except Exception as error:
        app.state.model_error = str(error)

    yield


def create_app() -> FastAPI:
    application = FastAPI(
        title="오늘의 모먼트 API",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        lifespan=lifespan,
    )
    application.include_router(health_router)
    application.include_router(analyze_router)
    return application


app = create_app()
