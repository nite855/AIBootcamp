"""POST /api/analyze endpoint following contracts/analysis.schema.json with JWT & PIPA consent gating."""

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from backend.app.api.deps import require_active_consents
from backend.app.db.models import User
from backend.app.db.session import get_db
from backend.app.ml.intake import ModelIntakeError, validate_probabilities
from backend.app.ml.predictor import ModelNotReadyError
from backend.app.schemas.analysis import (
    AnalyzeRequest,
    AnalyzeResponse,
    AnalyzeSuccessResponse,
    AnalyzeUnissuableResponse,
    ErrorResponse,
)
from backend.app.services.card_policy import evaluate_card
from backend.app.services.record_service import persist_analysis_for_record

router = APIRouter(prefix="/api", tags=["analysis"])


def _error_json(status_code: int, detail: str, code: str, request_id: str) -> JSONResponse:
    body = ErrorResponse(detail=detail, code=code, request_id=request_id)
    return JSONResponse(status_code=status_code, content=body.model_dump())


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze(
    payload: AnalyzeRequest,
    request: Request,
    current_user: User = Depends(require_active_consents),
    db: Session = Depends(get_db),
) -> AnalyzeResponse | JSONResponse:
    predictor = getattr(request.app.state, "predictor", None)
    is_ready = bool(getattr(request.app.state, "model_ready", False))
    if not is_ready or predictor is None:
        return _error_json(
            503,
            "감정 분석 모델이 아직 준비되지 않았습니다.",
            "MODEL_NOT_READY",
            payload.request_id,
        )

    try:
        raw_result = predictor.predict_record(payload.text)
    except ModelNotReadyError as error:
        return _error_json(503, str(error), "MODEL_NOT_READY", payload.request_id)
    except Exception:
        return _error_json(
            500,
            "감정 분석 처리 중 내부 오류가 발생했습니다.",
            "INFERENCE_ERROR",
            payload.request_id,
        )

    if not isinstance(raw_result, dict):
        return _error_json(
            500,
            "모델 출력 형식이 올바르지 않습니다.",
            "INVALID_MODEL_OUTPUT",
            payload.request_id,
        )

    model_version = str(
        raw_result.get("model_version")
        or getattr(request.app.state, "model_version", "")
        or "unknown"
    )
    truncated = bool(raw_result.get("truncated", False))
    if truncated:
        unissuable = AnalyzeUnissuableResponse(
            record_id=payload.record_id,
            version=payload.version,
            request_id=payload.request_id,
            status="error",
            model_version=model_version,
            probabilities=None,
            truncated=True,
            error_code="INPUT_TRUNCATED",
            message="모델 최대 입력 길이를 초과하여 카드를 발급할 수 없습니다.",
        )
        persist_analysis_for_record(
            db,
            current_user,
            client_record_id=payload.record_id,
            expected_version=payload.version,
            result=unissuable,
        )
        return unissuable

    try:
        probabilities = validate_probabilities(raw_result.get("probabilities"))
    except ModelIntakeError:
        return _error_json(
            500,
            "모델 출력 확률 검증에 실패했습니다.",
            "INVALID_MODEL_OUTPUT",
            payload.request_id,
        )

    card_evaluator = getattr(request.app.state, "card_evaluator", None) or evaluate_card
    card = card_evaluator(probabilities)
    success = AnalyzeSuccessResponse(
        record_id=payload.record_id,
        version=payload.version,
        request_id=payload.request_id,
        status="valid",
        model_version=model_version,
        probabilities=probabilities,
        truncated=False,
        dominant_emotion=card["dominant_emotion"],
        dominant_ratio=card["dominant_ratio"],
        ties=card["ties"],
        card_stage=card["card_stage"],
        card_key=card["card_key"],
        card_policy_version=card["card_policy_version"],
    )
    persist_analysis_for_record(
        db,
        current_user,
        client_record_id=payload.record_id,
        expected_version=payload.version,
        result=success,
    )
    return success
