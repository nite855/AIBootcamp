(function (root, factory) {
  const api = factory();
  if (typeof module === "object") module.exports = api;
  else root.MomentShare = api;
})(globalThis, function () {
  "use strict";
  // Share image rules (soft UI v1.1 "공유", 2026-11-20). By the user's decision the share image may
  // quote the record's first sentence (on by default); the rest of the diary is never drawn.
  const QUOTE_MAX = 40;
  const END = /[.!?。！？…]+["'”’)\]]*/;
  // First sentence of the first non-empty line, at most `max` characters (code points) with "…".
  function firstSentence(text, max = QUOTE_MAX) {
    const limit = Number.isSafeInteger(max) && max > 1 ? max : QUOTE_MAX;
    const line = String(text ?? "").replace(/\r\n?/g, "\n").split("\n").map(s => s.replace(/\s+/g, " ").trim()).find(Boolean) || "";
    const m = END.exec(line);
    const sentence = (m ? line.slice(0, m.index + m[0].length) : line).trim();
    const chars = Array.from(sentence);
    return chars.length > limit ? chars.slice(0, limit - 1).join("").trimEnd() + "…" : sentence;
  }
  // The quote drawn on the image: a custom sentence wins over the automatic one; both are capped.
  function quote(record, custom = "") {
    const own = Array.from(String(custom ?? "").replace(/\s+/g, " ").trim()).slice(0, QUOTE_MAX).join("");
    return own || firstSentence(record?.text);
  }
  return { QUOTE_MAX, firstSentence, quote };
});
