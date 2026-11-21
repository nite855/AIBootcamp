const test = require("node:test");
const assert = require("node:assert/strict");
const B = require("../scripts/blob-art.js");

const ids = svg => [...svg.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
const refs = svg => [...svg.matchAll(/url\(#([^)]+)\)/g)].map(m => m[1]);

test("blob draws the Figma shape in the given color with two eyes", () => {
  const svg = B.blobSVG({ color: "#8cc55a", uid: "a1", character: "neg_1", attrs: 'class="mc-character"' });
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 213\.2 213\.2"/);
  assert.match(svg, /data-character="neg_1"/);
  assert.match(svg, /class="mc-character"/);
  assert.equal((svg.match(/fill="#8cc55a"/g) || []).length, 2, "glow and body take the emotion color");
  assert.equal((svg.match(/<rect /g) || []).length, 2, "two pill eyes");
  assert.ok(svg.includes(`d="${B.PATH}"`));
  assert.ok(svg.includes("feTurbulence"), "grain");
  assert.ok(!svg.includes("<image"), "no bitmap");
});

test("every filter reference resolves inside the same drawing and ids follow the uid", () => {
  const svg = B.blobSVG({ color: "#e8789a", uid: "cb7" });
  assert.deepEqual(ids(svg).sort(), ["cb7-eye", "cb7-glow", "cb7-skin"]);
  for (const ref of refs(svg)) assert.ok(ids(svg).includes(ref), ref);
  const other = B.blobSVG({ color: "#e8789a", uid: "cb8" });
  assert.equal(ids(svg).filter(id => ids(other).includes(id)).length, 0, "two blobs never share an id");
});

test("missing or unsafe uid still gives unique, safe ids", () => {
  const a = ids(B.blobSVG({ color: "#fff" })), b = ids(B.blobSVG({ color: "#fff" }));
  assert.equal(a.filter(id => b.includes(id)).length, 0);
  const hostile = B.blobSVG({ color: "#fff", uid: '"><script>x</script>' });
  assert.ok(!hostile.includes("<script>"));
  for (const id of ids(hostile)) assert.match(id, /^[A-Za-z0-9_-]+$/);
});

test("invalid colors fall back to the neutral grey", () => {
  for (const bad of [undefined, "", "red", "#12", "#1234567", "url(#x)", '#fff" onload="x', "rgb(1,2,3)"]) {
    assert.equal(B.safeColor(bad), B.DEFAULT_COLOR, String(bad));
  }
  for (const ok of ["#abc", "#abcd", "#8cc55a", "#8CC55A80"]) assert.equal(B.safeColor(ok), ok);
  assert.ok(!B.blobSVG({ color: '#fff" onload="x' }).includes("onload"));
});

test("character attribute keeps only id characters", () => {
  assert.match(B.blobSVG({ color: "#fff", character: 'neu_3"><x' }), /data-character="neu_3x"/);
  assert.ok(!B.blobSVG({ color: "#fff" }).includes("data-character"));
});
