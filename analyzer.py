import re


class Analyzer:
    """실제 모델 대신 사용하는 간단한 감정 분석 Mock."""

    POSITIVE_WORDS = {
        "good",
        "great",
        "happy",
        "love",
        "좋다",
        "좋아",
        "행복",
        "기쁘다",
        "사랑",
    }
    NEGATIVE_WORDS = {
        "bad",
        "sad",
        "hate",
        "angry",
        "나쁘다",
        "싫다",
        "슬프다",
        "화나다",
        "분노",
    }

    def predict(self, text: str) -> float:
        tokens = re.findall(r"[\w가-힣]+", text.lower())
        if not tokens:
            return 0.0

        positive_count = sum(token in self.POSITIVE_WORDS for token in tokens)
        negative_count = sum(token in self.NEGATIVE_WORDS for token in tokens)
        return float((positive_count - negative_count) / len(tokens))
