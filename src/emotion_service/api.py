from collections import Counter
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from emotion_service.predictor import EmotionPredictor


PROJECT_ROOT = Path(__file__).resolve().parents[2]
INDEX_PATH = PROJECT_ROOT / "web" / "index.html"
IMAGES_PATH = PROJECT_ROOT / "images"


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.predictor = EmotionPredictor()
    yield


app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
app.mount("/images", StaticFiles(directory=IMAGES_PATH), name="images")


class AnalyzeRequest(BaseModel):
    text: str


class EmotionPrediction(BaseModel):
    emotion: str
    confidence: float
    probabilities: dict[str, float]
    input_tokens: int
    truncated: bool


class WordFrequency(BaseModel):
    word: str
    count: int


class AnalyzeResponse(BaseModel):
    lines: list[str]
    predictions: list[EmotionPrediction]
    word_frequencies: list[WordFrequency]
    emotion_word_frequencies: dict[str, list[WordFrequency]]


def parse_lines(text: str) -> list[str]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        raise ValueError("분석할 문장을 입력하세요.")
    if len(lines) > 100:
        raise ValueError("문장은 빈 줄을 제외하고 100줄 이하로 입력하세요.")
    return lines


def count_words(lines: list[str]) -> list[WordFrequency]:
    counts = Counter(word for line in lines for word in line.split())
    return [WordFrequency(word=word, count=count) for word, count in counts.most_common(10)]


def count_emotion_words(
    lines: list[str], predictions: list[EmotionPrediction]
) -> dict[str, list[WordFrequency]]:
    counts_by_emotion: dict[str, Counter[str]] = {}
    for line, prediction in zip(lines, predictions):
        emotion = prediction["emotion"] if isinstance(prediction, dict) else prediction.emotion
        counts_by_emotion.setdefault(emotion, Counter()).update(line.split())
    return {
        emotion: [WordFrequency(word=word, count=count) for word, count in counts.most_common(3)]
        for emotion, counts in counts_by_emotion.items()
    }


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(INDEX_PATH)


@app.post("/api/analyze", response_model=AnalyzeResponse)
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
