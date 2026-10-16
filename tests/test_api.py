import unittest

from emotion_service.api import EmotionPrediction, count_emotion_words, count_words, parse_lines


class ParseLinesTests(unittest.TestCase):
    def test_removes_blank_lines_and_surrounding_whitespace(self) -> None:
        self.assertEqual(parse_lines(" 첫 문장 \n\n 둘째 문장 "), ["첫 문장", "둘째 문장"])

    def test_rejects_empty_input(self) -> None:
        with self.assertRaisesRegex(ValueError, "문장을 입력"):
            parse_lines(" \n\t ")

    def test_accepts_one_hundred_non_empty_lines(self) -> None:
        self.assertEqual(len(parse_lines("\n".join(["문장"] * 100))), 100)

    def test_rejects_more_than_one_hundred_non_empty_lines(self) -> None:
        with self.assertRaisesRegex(ValueError, "100줄 이하"):
            parse_lines("\n".join(["문장"] * 101))


class CountWordsTests(unittest.TestCase):
    def test_counts_whitespace_separated_words_in_descending_order(self) -> None:
        frequencies = count_words(["나는 정말 기뻐", "정말 정말 행복해", "나는 행복해"])

        self.assertEqual(
            [item.model_dump() for item in frequencies],
            [
                {"word": "정말", "count": 3},
                {"word": "나는", "count": 2},
                {"word": "행복해", "count": 2},
                {"word": "기뻐", "count": 1},
            ],
        )

    def test_counts_top_three_words_by_dominant_emotion(self) -> None:
        predictions = [
            EmotionPrediction(emotion="기쁨", confidence=0.9, probabilities={}, input_tokens=1, truncated=False),
            EmotionPrediction(emotion="기쁨", confidence=0.8, probabilities={}, input_tokens=1, truncated=False),
            EmotionPrediction(emotion="분노", confidence=0.8, probabilities={}, input_tokens=1, truncated=False),
        ]

        frequencies = count_emotion_words(
            ["행복 행복 성공", "행복 성공 즐거움", "화 화 불만"], predictions
        )

        self.assertEqual(
            [item.model_dump() for item in frequencies["기쁨"]],
            [
                {"word": "행복", "count": 3},
                {"word": "성공", "count": 2},
                {"word": "즐거움", "count": 1},
            ],
        )


if __name__ == "__main__":
    unittest.main()
