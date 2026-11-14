from pydantic import BaseModel


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
