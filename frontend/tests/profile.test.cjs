const { test } = require("node:test");
const assert = require("node:assert/strict");
const P = require("../scripts/profile.js");

test("nickname is trimmed, collapsed, capped at 12 characters and never empty", () => {
  assert.equal(P.normalizeName("  새 벽  "), "새 벽");
  assert.equal(P.normalizeName("가\n\t나"), "가 나");
  assert.equal(P.normalizeName("가".repeat(12)), "가".repeat(12));
  assert.equal(P.normalizeName("가".repeat(13)), "가".repeat(12), "13 characters are cut to 12");
  assert.equal(Array.from(P.normalizeName("😀".repeat(20))).length, 12, "code points, not UTF-16 units");
  for (const empty of ["", "   ", null, undefined]) assert.equal(P.normalizeName(empty), "하루");
});

test("profile keeps known colors and boolean notices only", () => {
  assert.deepEqual(P.normalize(null), P.DEFAULTS);
  assert.deepEqual(P.normalize({ name: "모모", color: P.COLORS[3], notifyDaily: true, notifyAnalysis: "yes" }), { name: "모모", color: P.COLORS[3], icon: "bunny", notifyDaily: true, notifyAnalysis: false });
  assert.equal(P.normalize({ color: "red" }).color, P.COLORS[0]);
  assert.equal(P.COLORS.length, 6);
});

test("avatar icon is one of six, defaults to the bunny and survives a save", () => {
  assert.deepEqual([...P.ICONS], ["bunny", "bear", "cat", "chick", "cloud", "star"]);
  assert.equal(P.DEFAULTS.icon, "bunny");
  for (const id of P.ICONS) {
    assert.equal(P.normalize({ icon: id }).icon, id);
    assert.ok(P.ICON_LABELS[id], `${id} has a Korean label`);
  }
  for (const bad of ["dog", "Bunny", " cat", "", 3, null, undefined, {}, ["cat"]]) assert.equal(P.normalize({ icon: bad }).icon, "bunny", `invalid icon ${JSON.stringify(bad)}`);
  // Profiles stored before icons existed have no icon field: they load as the bunny, keeping name and color.
  const mem = new Map([[P.KEY, JSON.stringify({ name: "모모", color: P.COLORS[1], notifyDaily: true })]]);
  const storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  assert.deepEqual(P.load(storage), { ...P.DEFAULTS, name: "모모", color: P.COLORS[1], notifyDaily: true });
  P.save(storage, { ...P.load(storage), icon: "chick" });
  assert.equal(P.load(storage).icon, "chick");
  assert.equal(JSON.parse(mem.get(P.KEY)).icon, "chick");
});

test("load and save survive missing, broken or throwing storage", () => {
  const mem = new Map(), storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  assert.deepEqual(P.load(storage), P.DEFAULTS);
  const saved = P.save(storage, { name: "  별  ", color: P.COLORS[2] });
  assert.equal(saved.stored, true);
  assert.deepEqual(P.load(storage), { ...P.DEFAULTS, name: "별", color: P.COLORS[2] });
  assert.equal(mem.has(P.KEY), true);
  mem.set(P.KEY, "{broken");
  assert.deepEqual(P.load(storage), P.DEFAULTS, "corrupt JSON falls back");
  const throwing = { getItem() { throw Error("blocked"); }, setItem() { throw Error("blocked"); } };
  assert.deepEqual(P.load(throwing), P.DEFAULTS);
  assert.deepEqual(P.save(throwing, { name: "a" }), { profile: { ...P.DEFAULTS, name: "a" }, stored: false });
  assert.deepEqual(P.load(undefined), P.DEFAULTS);
});

test("days together count the first record day as day 1", () => {
  assert.equal(P.daysTogether("2026-11-20", "2026-11-20"), 1);
  assert.equal(P.daysTogether("2026-11-01", "2026-11-20"), 20);
  assert.equal(P.daysTogether("2025-12-31", "2026-01-01"), 2, "crosses the year");
  assert.equal(P.daysTogether("2028-02-28", "2028-03-01"), 3, "leap day");
  assert.equal(P.daysTogether("2026-11-25", "2026-11-20"), 1, "a future first date never goes below 1");
  assert.equal(P.daysTogether(null, "2026-11-20"), null);
  assert.equal(P.daysTogether("2026-02-30", "2026-11-20"), null);
});

test("record export was removed from the profile module", () => {
  assert.equal(P.exportText, undefined);
  assert.equal(P.exportFileName, undefined);
});
