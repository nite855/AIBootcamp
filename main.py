from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from pydantic import BaseModel

from analyzer import Analyzer


app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
analyzer = Analyzer()


class AnalyzeRequest(BaseModel):
    text: str


class AnalyzeResponse(BaseModel):
    lines: list[str]
    scores: list[float]


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(Path(__file__).with_name("index.html"))


@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    lines: list[str] = [line.strip() for line in request.text.splitlines() if line.strip()]
    scores = [analyzer.predict(line) for line in lines]
    return AnalyzeResponse(lines=lines, scores=scores)
