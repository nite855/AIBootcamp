import unittest

from main import count_words, parse_lines


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


if __name__ == "__main__":
    unittest.main()
