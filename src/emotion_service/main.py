from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from emotion_service.api.analyze import router as analyze_router
from emotion_service.ml.predictor import EmotionPredictor

PROJECT_ROOT = Path(__file__).resolve().parents[2]
STATIC_PATH = PROJECT_ROOT / "static"


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.predictor = EmotionPredictor()
    yield


app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
app.mount("/static", StaticFiles(directory=STATIC_PATH), name="static")
app.include_router(analyze_router)


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(STATIC_PATH / "index.html")
