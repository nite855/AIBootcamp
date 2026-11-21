import unittest
from hierarchical_contract import combine

class ContractTest(unittest.TestCase):
    def setUp(self):
        self.parent = {"positive": .45, "negative": .40, "neutral": .15}
        self.pos = {"pos_1": .4, "pos_2": 1/3, "pos_3": 4/15}
        self.neg = {"neg_1": .425, "neg_2": .35, "neg_3": .225}

    def test_combines_and_preserves_parents(self):
        r = combine(self.parent, self.pos, self.neg)
        self.assertAlmostEqual(sum(r["probabilities"].values()), 1)
        self.assertAlmostEqual(sum(r["probabilities"][k] for k in self.pos), .45)
        self.assertAlmostEqual(sum(r["probabilities"][k] for k in self.neg), .40)

    def test_parent_and_child_are_independent(self):
        r = combine({"positive": .4, "negative": .25, "neutral": .35},
                    {"pos_1": 1/3, "pos_2": 1/3, "pos_3": 1/3}, self.neg)
        self.assertEqual(r["representative_parent"], "positive")
        self.assertEqual(r["top_subcategory"], "neutral")

    def test_invalid_and_missing_are_rejected(self):
        for invalid in ({}, {"pos_1": 1, "pos_2": 0, "pos_3": float("nan")},
                        {"pos_1": True, "pos_2": 0, "pos_3": 0},
                        {"pos_1": .3, "pos_2": .3, "pos_3": .3}):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                combine(self.parent, invalid, self.neg)

if __name__ == "__main__":
    unittest.main()
