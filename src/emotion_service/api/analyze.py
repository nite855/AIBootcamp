from fastapi import APIRouter, HTTPException, Request

from emotion_service.schemas.analysis import AnalyzeRequest, AnalyzeResponse
from emotion_service.services.analysis import count_emotion_words, count_words, parse_lines

router = APIRouter(prefix="/api")


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze(payload: AnalyzeRequest, request: Request) -> AnalyzeResponse:
    try:
        lines = parse_lines(payload.text)
        predictions = [request.app.state.predictor.predict(line) for line in lines]
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    return AnalyzeResponse(
        lines=lines,
        predictions=predictions,
        word_frequencies=count_words(lines),
        emotion_word_frequencies=count_emotion_words(lines, predictions),
    )
