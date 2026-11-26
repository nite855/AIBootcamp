const { test } = require("node:test");
const assert = require("node:assert/strict");
const S = require("../scripts/share-core.js");

test("first sentence stops at the first sentence end of the first non-empty line", () => {
  assert.equal(S.firstSentence("오랜만에 친구와 산책했다. 천천히 이야기하니 마음이 가벼워졌다."), "오랜만에 친구와 산책했다.");
  assert.equal(S.firstSentence("\n\n  첫 줄!  둘째 문장\n다음 줄"), "첫 줄!");
  assert.equal(S.firstSentence("마침표 없는 한 줄\n두 번째 줄."), "마침표 없는 한 줄", "no terminator: the whole first line");
  assert.equal(S.firstSentence("정말?! 그렇구나"), "정말?!");
  assert.equal(S.firstSentence('그가 말했다 "좋아." 그리고'), '그가 말했다 "좋아."', "closing quote stays with the sentence");
  assert.equal(S.firstSentence("가\t\t나   다."), "가 나 다.", "whitespace collapsed");
});

test("first sentence is capped at 40 characters with an ellipsis", () => {
  const forty = "가".repeat(40), fortyOne = "가".repeat(41);
  assert.equal(S.firstSentence(forty), forty, "exactly 40 stays");
  assert.equal(S.firstSentence(fortyOne), "가".repeat(39) + "…");
  assert.equal(Array.from(S.firstSentence("😀".repeat(50))).length, 40, "code points");
  assert.equal(S.firstSentence("가나다라마바사", 5), "가나다라…");
  assert.equal(S.firstSentence("가나다", 0), "가나다", "invalid limit falls back to 40");
});

test("empty bodies give no quote; a custom sentence wins and is capped", () => {
  for (const empty of ["", "   \n  ", null, undefined]) assert.equal(S.firstSentence(empty), "");
  assert.equal(S.quote({ text: "자동 문장. 나머지" }), "자동 문장.");
  assert.equal(S.quote({ text: "자동 문장." }, "  내가 고른   문장 "), "내가 고른 문장");
  assert.equal(S.quote({ text: "자동." }, "가".repeat(45)), "가".repeat(40));
  assert.equal(S.quote(null), "");
});
