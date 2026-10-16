import unittest

from emotion_service.schemas.analysis import EmotionPrediction
from emotion_service.services.analysis import count_emotion_words, count_words, parse_lines


class ParseLinesTests(unittest.TestCase):
    def test_removes_blank_lines_and_surrounding_whitespace(self) -> None:
        self.assertEqual(parse_lines(" ù ���� \n\n ��° ���� "), ["ù ����", "��° ����"])

    def test_rejects_empty_input(self) -> None:
        with self.assertRaisesRegex(ValueError, "������ �Է�"):
            parse_lines(" \n\t ")

    def test_accepts_one_hundred_non_empty_lines(self) -> None:
        self.assertEqual(len(parse_lines("\n".join(["����"] * 100))), 100)

    def test_rejects_more_than_one_hundred_non_empty_lines(self) -> None:
        with self.assertRaisesRegex(ValueError, "100�� ����"):
            parse_lines("\n".join(["����"] * 101))


class CountWordsTests(unittest.TestCase):
    def test_counts_whitespace_separated_words_in_descending_order(self) -> None:
        frequencies = count_words(["���� ���� �⻵", "���� ���� �ູ��", "���� �ູ��"])

        self.assertEqual(
            [item.model_dump() for item in frequencies],
            [
                {"word": "����", "count": 3},
                {"word": "����", "count": 2},
                {"word": "�ູ��", "count": 2},
                {"word": "�⻵", "count": 1},
            ],
        )

    def test_counts_top_three_words_by_dominant_emotion(self) -> None:
        predictions = [
            EmotionPrediction(emotion="���", confidence=0.9, probabilities={}, input_tokens=1, truncated=False),
            EmotionPrediction(emotion="���", confidence=0.8, probabilities={}, input_tokens=1, truncated=False),
            EmotionPrediction(emotion="�г�", confidence=0.8, probabilities={}, input_tokens=1, truncated=False),
        ]

        frequencies = count_emotion_words(
            ["�ູ �ູ ����", "�ູ ���� ��ſ�", "ȭ ȭ �Ҹ�"], predictions
        )

        self.assertEqual(
            [item.model_dump() for item in frequencies["���"]],
            [
                {"word": "�ູ", "count": 3},
                {"word": "����", "count": 2},
                {"word": "��ſ�", "count": 1},
            ],
        )


if __name__ == "__main__":
    unittest.main()
