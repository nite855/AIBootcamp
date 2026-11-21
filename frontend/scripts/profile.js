(function (root, factory) {
  const api = factory();
  if (typeof module === "object") module.exports = api;
  else root.MomentProfile = api;
})(globalThis, function () {
  "use strict";
  // Profile and notice preferences (soft UI v1.1 "프로필", 2026-11-20). Kept in their own localStorage
  // key, never inside the diary IndexedDB snapshot. Notices are preferences only: nothing is sent.
  const KEY = "moment-card:profile-v1";
  const NAME_MAX = 12;
  const DEFAULT_NAME = "하루";
  const COLORS = Object.freeze(["#f3cdb6", "#ffb3c7", "#ffe49a", "#a6ebd6", "#aed6ff", "#d9c4ff"]);
  // Avatar icons (2026-11-21): picked in the edit dialog like the color. Profiles saved before
  // the icon existed (or with an unknown id) show the bunny.
  const ICONS = Object.freeze(["bunny", "bear", "cat", "chick", "cloud", "star"]);
  const ICON_LABELS = Object.freeze({ bunny: "토끼", bear: "곰", cat: "고양이", chick: "병아리", cloud: "구름", star: "별" });
  const DEFAULTS = Object.freeze({ name: DEFAULT_NAME, color: COLORS[0], icon: ICONS[0], notifyDaily: false, notifyAnalysis: false });
  const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

  // Nickname: trimmed, inner whitespace collapsed, at most 12 characters (code points); empty → 하루.
  function normalizeName(value) {
    const name = Array.from(String(value ?? "").replace(/\s+/g, " ").trim()).slice(0, NAME_MAX).join("").trim();
    return name || DEFAULT_NAME;
  }
  function normalize(input) {
    const p = input && typeof input === "object" ? input : {};
    return {
      name: normalizeName(p.name),
      color: COLORS.includes(p.color) ? p.color : DEFAULTS.color,
      icon: ICONS.includes(p.icon) ? p.icon : DEFAULTS.icon,
      notifyDaily: p.notifyDaily === true,
      notifyAnalysis: p.notifyAnalysis === true,
    };
  }
  // Storage may be missing or throw (private mode, blocked site data); the defaults are used then.
  function load(storage) {
    try {
      const raw = storage?.getItem(KEY);
      return normalize(raw ? JSON.parse(raw) : null);
    } catch { return normalize(null); }
  }
  function save(storage, profile) {
    const next = normalize(profile);
    try { storage?.setItem(KEY, JSON.stringify(next)); return { profile: next, stored: true }; }
    catch { return { profile: next, stored: false }; }
  }
  function parse(date) {
    const m = DATE.exec(date || "");
    if (!m) return null;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? d : null;
  }
  // "moment와 함께한 지 N일째": the first record day counts as day 1. Null without a valid first date.
  function daysTogether(firstDate, today) {
    const a = parse(firstDate), b = parse(today);
    if (!a || !b) return null;
    return Math.max(1, Math.round((b - a) / 86400000) + 1);
  }
  // Record export was removed from the profile page on 2026-11-20 (user decision).
  return { KEY, NAME_MAX, DEFAULT_NAME, COLORS, ICONS, ICON_LABELS, DEFAULTS, normalize, normalizeName, load, save, daysTogether };
});
