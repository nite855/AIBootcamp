from collections import Counter

from emotion_service.schemas.analysis import EmotionPrediction, WordFrequency


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
        counts_by_emotion.setdefault(prediction.emotion, Counter()).update(line.split())
    return {
        emotion: [WordFrequency(word=word, count=count) for word, count in counts.most_common(3)]
        for emotion, counts in counts_by_emotion.items()
    }
