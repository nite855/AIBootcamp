from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel

from test_emotion_model import EmotionPredictor


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.predictor = EmotionPredictor()
    yield


app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)


class AnalyzeRequest(BaseModel):
    text: str


class EmotionPrediction(BaseModel):
    emotion: str
    confidence: float
    probabilities: dict[str, float]
    input_tokens: int
    truncated: bool


class AnalyzeResponse(BaseModel):
    lines: list[str]
    predictions: list[EmotionPrediction]


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(Path(__file__).with_name("index.html"))


@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze(payload: AnalyzeRequest, request: Request) -> AnalyzeResponse:
    lines = [line.strip() for line in payload.text.splitlines() if line.strip()]
    if not lines:
        raise HTTPException(status_code=422, detail="분석할 문장을 입력하세요.")

    try:
        predictions = [request.app.state.predictor.predict(line) for line in lines]
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    return AnalyzeResponse(lines=lines, predictions=predictions)
