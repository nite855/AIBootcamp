const { test } = require("node:test");
const assert = require("node:assert/strict");
const S = require("../scripts/statistics.js"),
  C = require("../scripts/core.js");
const probabilities = Object.fromEntries(
  C.IDS.map((id, i) => [id, i === 0 ? 1 : 0]),
);
const row = (date, analysis = { status: "valid", probabilities }) => ({
  recordDate: date,
  version: 1,
  analysis: analysis && { version:1, taxonomy_version:C.TAXONOMY, ...analysis },
});
test("counts records separately from days, supports leap months and missing analysis", () => {
  const s = S.monthSummary(
    [
      row("2024-02-01"),
      row("2024-02-01"),
      row("2024-02-29", { status: "pending" }),
      row("2024-03-01"),
    ],
    "2024-02",
  );
  assert.equal(s.total, 3);
  assert.equal(s.writtenDays, 2);
  assert.equal(s.valid, 2);
  assert.equal(s.missing, 1);
  assert.equal(s.days.length, 29);
  assert.equal(s.days[1].summary.leaf, null);
  assert.equal(s.days[1].count, 0);
});
test("monthly distribution weights source records, not daily averages", () => {
  const neutral = Object.fromEntries(
    C.IDS.map((id) => [id, id === "neu_1" ? 1 : 0]),
  );
  const s = S.monthSummary(
    [
      row("2026-11-01"),
      row("2026-11-01"),
      row("2026-11-02", { status: "valid", probabilities: neutral }),
    ],
    "2026-11",
  );
  assert.equal(s.distribution.leaf.pos_1, 2 / 3);
  assert.equal(s.days[1].summary.parents.neutral, 1);
});
test("invalid, absent and empty analysis are distinct from neutral", () => {
  const s = S.monthSummary(
    [
      row("2026-11-01", { status: "valid", probabilities: { neutral: 1 } }),
      row("2026-11-02", null),
    ],
    "2026-11",
  );
  assert.equal(s.total, 2);
  assert.equal(s.valid, 0);
  assert.equal(s.missing, 2);
  assert.equal(s.distribution.leaf, null);
  assert.equal(S.monthSummary([], "2026-11").total, 0);
});

test("old taxonomies, stale records and truncated results are excluded without changing record counts", () => {
  const old = row('2026-11-01',{status:'valid',probabilities,taxonomy_version:'old'});
  const stale = {...row('2026-11-01'), version:2};
  const truncated = row('2026-11-01',{status:'valid',probabilities,truncated:true});
  const s=S.monthSummary([row('2026-11-01'),old,stale,truncated],'2026-11');
  assert.equal(s.total,4);assert.equal(s.valid,1);assert.equal(s.missing,3);
  assert.equal(s.distribution.leaf.pos_1,1);
});

const vector = id => Object.fromEntries(C.IDS.map(x => [x, x === id ? 1 : 0]));
test("insight is withheld below 3 analyzed records and reports ties", () => {
  const rows = n => Array.from({ length: n }, () => row("2026-11-02", { status: "valid", probabilities: vector("neg_2") }));
  for (const n of [0, 1, 2]) {
    const i = S.insight(S.monthSummary(rows(n), "2026-11"));
    assert.equal(i.ready, false); assert.equal(i.valid, n); assert.equal(i.needed, 3 - n);
  }
  const ready = S.insight(S.monthSummary(rows(3), "2026-11"));
  assert.equal(ready.ready, true); assert.equal(ready.leaf, "neg_2"); assert.equal(ready.parent, "negative");
  // Pending records count toward totals, never toward the insight minimum.
  const mixed = S.monthSummary([...rows(2), row("2026-11-03", { status: "pending" })], "2026-11");
  assert.equal(S.insight(mixed).ready, false);
  const tie = S.monthSummary([...rows(2), row("2026-11-04", { status: "valid", probabilities: vector("pos_1") }), row("2026-11-05", { status: "valid", probabilities: vector("pos_1") })], "2026-11");
  assert.deepEqual(S.insight(tie).leafTies, ["pos_1", "neg_2"], "ties follow taxonomy order");
  for (const bad of [null, undefined, {}, { valid: 5 }]) assert.equal(S.insight(bad).ready, false);
});

test("day emotion is the dominant analyzed leaf and null without valid analysis", () => {
  const s = S.monthSummary([row("2026-11-02", { status: "valid", probabilities: vector("neu_3") }), row("2026-11-03", { status: "pending" })], "2026-11");
  assert.equal(S.dayEmotion(s.days[1]), "neu_3");
  assert.equal(S.dayEmotion(s.days[2]), null);
  assert.equal(S.dayEmotion(s.days[0]), null);
  assert.equal(S.dayEmotion(undefined), null);
});

test("month shift crosses years and never passes the current month", () => {
  assert.equal(S.shiftMonth("2026-01", -1), "2025-12");
  assert.equal(S.shiftMonth("2025-12", 1), "2026-01");
  assert.equal(S.shiftMonth("2026-11", 1, "2026-11"), "2026-11", "blocked at current month");
  assert.equal(S.shiftMonth("2026-10", 1, "2026-11"), "2026-11");
  assert.equal(S.shiftMonth("2026-11", -13), "2025-10");
  for (const [m, step] of [["bad", 1], ["2026-11", 1.5], ["2026-11", NaN]]) assert.equal(S.shiftMonth(m, step), m);
});

test("weeks start on Sunday and cross month and year boundaries", () => {
  assert.equal(S.weekStart("2026-11-15"), "2026-11-15", "a Sunday starts its own week");
  assert.equal(S.weekStart("2026-11-21"), "2026-11-15", "Saturday belongs to the same week");
  assert.equal(S.weekStart("2026-12-02"), "2026-11-29", "week spans the month change");
  assert.equal(S.weekStart("2027-01-01"), "2026-12-27", "week spans the year change");
  assert.deepEqual(S.weekDates("2026-12-31"), ["2026-12-27", "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
  for (const bad of ["", "2026-13-01", "2026-02-30", "2026-1-5", null, undefined]) {
    assert.equal(S.weekStart(bad), null);
    assert.deepEqual(S.weekDates(bad), []);
  }
  assert.equal(S.addDays("2028-02-28", 1), "2028-02-29", "leap day");
  assert.equal(S.addDays("bad", 1), "bad");
});

test("week shift never passes the week of today", () => {
  assert.equal(S.shiftWeek("2026-11-15", -1, "2026-11-19"), "2026-11-08");
  assert.equal(S.shiftWeek("2026-11-15", 1, "2026-11-19"), "2026-11-15", "blocked at the current week");
  assert.equal(S.shiftWeek("2026-11-08", 1, "2026-11-19"), "2026-11-15");
  assert.equal(S.shiftWeek("2026-11-18", -1, "2026-11-19"), "2026-11-08", "a mid-week date is normalized first");
  assert.equal(S.shiftWeek("2026-12-27", -53, "2027-01-01"), "2025-12-21");
  for (const step of [1.5, NaN]) assert.equal(S.shiftWeek("2026-11-08", step, "2026-11-19"), "2026-11-08");
  assert.equal(S.shiftWeek("bad", 1, "2026-11-19"), "bad");
});

test("streak counts written days back from today (or yesterday while today is open)", () => {
  const today = "2026-11-20";
  assert.equal(S.streakDays([], today), 0);
  assert.equal(S.streakDays(["2026-11-20"], today), 1);
  assert.equal(S.streakDays(["2026-11-18", "2026-11-19", "2026-11-20", "2026-11-20"], today), 3, "duplicates count once");
  assert.equal(S.streakDays(["2026-11-18", "2026-11-19"], today), 2, "unwritten today keeps yesterday's streak");
  assert.equal(S.streakDays(["2026-11-17", "2026-11-18"], today), 0, "a missed yesterday breaks it");
  assert.equal(S.streakDays(["2026-11-16", "2026-11-18", "2026-11-19", "2026-11-20"], today), 3, "gap stops the count");
  assert.equal(S.streakDays(["2026-12-31", "2027-01-01"], "2027-01-01"), 2, "crosses the year");
  assert.equal(S.streakDays(["2026-11-21"], today), 0, "future dates are not counted");
  assert.equal(S.streakDays(["bad", null, 3, "2026-11-20"], today), 1);
  assert.equal(S.streakDays("2026-11-20", today), 0, "non-array input");
  assert.equal(S.streakDays(["2026-11-20"], "bad"), 0);
});

test("week label names the month of the week's Sunday and its row", () => {
  assert.deepEqual(S.weekLabel("2026-11-18"), { month: 11, week: 3 }, "Nov 2026 starts on a Sunday");
  assert.deepEqual(S.weekLabel("2026-11-01"), { month: 11, week: 1 });
  assert.deepEqual(S.weekLabel("2026-12-02"), { month: 11, week: 5 }, "a week starting in November keeps its name");
  assert.deepEqual(S.weekLabel("2026-12-06"), { month: 12, week: 2 }, "Dec 2026 starts on a Tuesday");
  assert.deepEqual(S.weekLabel("2027-01-01"), { month: 12, week: 5 });
  for (const bad of ["", "2026-02-30", null]) assert.equal(S.weekLabel(bad), null);
});

test("moving average keeps gaps and averages the available window", () => {
  assert.deepEqual(S.movingAverage([]), []);
  assert.deepEqual(S.movingAverage([0.4]), [0.4], "length 1");
  assert.deepEqual(S.movingAverage([0.2, 0.6]), [0.2, 0.4], "length 2");
  const out = S.movingAverage([0.3, null, 0.9, 0.6, 0.3]);
  assert.equal(out[1], null, "a gap stays a gap");
  assert.ok(Math.abs(out[2] - 0.6) < 1e-9, "null skipped inside the window");
  assert.ok(Math.abs(out[4] - 0.6) < 1e-9);
  assert.deepEqual(S.movingAverage([1, 0], 0), [1, 0], "invalid size falls back to 1");
  assert.deepEqual(S.movingAverage("bad"), []);
});

test("window emotion: strongest emotion of the trailing 3-day averaged probabilities", () => {
  const p = (shares) => Object.fromEntries(C.IDS.map(id => [id, shares[id] || 0]));
  const day = (shares) => shares ? { summary: { validCount: 1, leaf: p(shares) } } : { summary: { validCount: 0, leaf: null } };
  assert.deepEqual(S.windowEmotion([]), []);
  assert.deepEqual(S.windowEmotion("bad"), []);
  assert.deepEqual(S.windowEmotion([null, {}, { summary: { validCount: 1, leaf: { pos_1: 1 } } }]), [null, null, null], "missing or partial leaf is no analysis");
  // Window shorter at the start; a strong day outweighs two weaker ones.
  const days = [day({ pos_1: 0.92, neu_1: 0.08 }), day({ neg_2: 0.35, neu_1: 0.65 }), day({ neg_2: 0.4, pos_1: 0.6 })];
  const out = S.windowEmotion(days);
  assert.equal(out[0].type, "pos_1", "first day uses a one-day window");
  assert.ok(Math.abs(out[0].share - 0.92) < 1e-9);
  assert.equal(out[1].type, "pos_1", "0.46 average beats neu_1 0.365");
  assert.equal(out[2].type, "pos_1");
  // Gaps stay null and are skipped inside the window.
  const gap = S.windowEmotion([day({ neg_3: 1 }), day(null), day({ pos_2: 0.4, neu_2: 0.6 })]);
  assert.equal(gap[1], null, "a gap stays a gap");
  assert.equal(gap[2].type, "neg_3", "window = day 1 and day 3 only (neg_3 0.5)");
  // Old days fall out of the window.
  const slide = S.windowEmotion([day({ neg_1: 1 }), day({ pos_3: 1 }), day({ pos_3: 1 }), day({ pos_3: 1 })]);
  assert.equal(slide[3].type, "pos_3");
  assert.ok(Math.abs(slide[3].share - 1) < 1e-9);
  // Ties follow IDS order.
  assert.equal(S.windowEmotion([day({ neu_3: 0.5, pos_2: 0.5 })])[0].type, "pos_2");
  assert.equal(S.windowEmotion([day({}), day({})], 0)[1].type, C.IDS[0], "invalid size falls back to 1");
});

test("window emotion matches the trend line: averaged positive share equals the moving average", () => {
  const month = "2026-11";
  const pr = (i) => { const raw = C.IDS.map((_, k) => ((i * 7 + k * 3) % 9) + 1), sum = raw.reduce((a, b) => a + b, 0); return Object.fromEntries(C.IDS.map((id, k) => [id, raw[k] / sum])); };
  const records = [1, 2, 4, 5, 6, 9].map(d => ({ recordDate: `${month}-${String(d).padStart(2, "0")}`, version: 1, analysis: { version: 1, taxonomy_version: C.TAXONOMY, status: "valid", probabilities: pr(d) } }));
  const days = S.monthSummary(records, month).days;
  const line = S.movingAverage(days.map(d => d.summary.validCount ? d.summary.parents.positive : null), 3);
  const colors = S.windowEmotion(days);
  days.forEach((d, i) => {
    assert.equal(colors[i] === null, line[i] === null, "same gaps as the line on day " + (i + 1));
    if (line[i] === null) return;
    const win = days.slice(Math.max(0, i - 2), i + 1).filter(x => x.summary.validCount);
    const pos = C.IDS.filter(id => id.startsWith("pos")).reduce((a, id) => a + win.reduce((s, x) => s + x.summary.leaf[id], 0) / win.length, 0);
    assert.ok(Math.abs(pos - line[i]) < 1e-9, "positive share matches the line on day " + (i + 1));
  });
});

test("month delta compares with the previous month across the year boundary", () => {
  const rec = d => ({ recordDate: d });
  assert.deepEqual(S.monthDelta([rec("2026-01-03"), rec("2026-01-09"), rec("2025-12-30")], "2026-01"), { current: 2, previous: 1, delta: 1 });
  assert.deepEqual(S.monthDelta([rec("2026-10-01")], "2026-11"), { current: 0, previous: 1, delta: -1 });
  assert.deepEqual(S.monthDelta([], "2026-11"), { current: 0, previous: 0, delta: 0 });
  assert.deepEqual(S.monthDelta(null, "bad"), { current: 0, previous: 0, delta: 0 });
});

const leafRow = (date, id, version = 1) => ({
  recordDate: date, version: 1,
  analysis: { status: "valid", version, taxonomy_version: C.TAXONOMY, probabilities: Object.fromEntries(C.IDS.map(x => [x, x === id ? 1 : 0])) },
});
test("weekday summary starts on Sunday and ignores outdated analyses", () => {
  // 2026-11-01 is a Sunday; 2026-11-06 a Friday.
  const s = S.weekdaySummary([leafRow("2026-11-01", "pos_1"), leafRow("2026-11-08", "neg_1"), leafRow("2026-11-06", "pos_2", 0), { recordDate: "2026-11-06", version: 1, analysis: { status: "pending" } }], "2026-11");
  assert.equal(s.length, 7);
  assert.deepEqual(s.map(d => d.weekday), [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(s[0].count, 2); assert.equal(s[0].valid, 2);
  assert.ok(Math.abs(s[0].parents.positive - 0.5) < 1e-9 && Math.abs(s[0].parents.negative - 0.5) < 1e-9);
  assert.equal(s[5].count, 2, "Friday has two records");
  assert.equal(s[5].valid, 0, "outdated and pending analyses are excluded");
  assert.equal(s[5].parents, null);
  assert.deepEqual(S.weekdaySummary([], "2026-11").map(d => d.count), [0, 0, 0, 0, 0, 0, 0], "empty month");
});

test("weekday insight needs three analyzed records and drops tied leads", () => {
  const month = "2026-11";
  // Friday (6, 13) positive; Thursday (5, 12) negative.
  const rows = [leafRow("2026-11-06", "pos_1"), leafRow("2026-11-13", "pos_1"), leafRow("2026-11-05", "neg_1"), leafRow("2026-11-12", "neg_2")];
  assert.deepEqual(S.weekdayInsight(S.weekdaySummary(rows, month)), { positive: 5, negative: 4 });
  assert.equal(S.weekdayInsight(S.weekdaySummary(rows.slice(0, 2), month)), null, "fewer than three");
  // Positive tied between Friday and Saturday; negative still leads on Thursday.
  const tie = [leafRow("2026-11-06", "pos_1"), leafRow("2026-11-07", "pos_1"), leafRow("2026-11-05", "neg_1")];
  assert.deepEqual(S.weekdayInsight(S.weekdaySummary(tie, month)), { positive: null, negative: 4 });
  const allTied = [leafRow("2026-11-06", "neu_1"), leafRow("2026-11-07", "neu_1"), leafRow("2026-11-08", "neu_1")];
  assert.equal(S.weekdayInsight(S.weekdaySummary(allTied, month)), null, "no positive or negative lead");
  assert.equal(S.weekdayInsight(null), null);
});
