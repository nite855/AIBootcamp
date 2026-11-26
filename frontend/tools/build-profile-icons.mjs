// Profile avatar icons (2026-11-22): six blob-style faces drawn with the card character's Figma
// filters (scripts/blob-art.js: white inner shadow + grain, glowing pill eyes) and rendered to
// 256×256 transparent PNGs in assets/profile/. tools/build.mjs embeds them as data URIs.
//
//   node tools/build-profile-icons.mjs            # write assets/profile/*.png (+ .svg sources)
//   node tools/build-profile-icons.mjs --check    # fail if a PNG is missing
//
// Uses the same Playwright/Chrome as the browser tests (CARDEX_PLAYWRIGHT, CARDEX_CHROMIUM).
import { mkdir, writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const Blob = require("../scripts/blob-art.js");
const out = new URL("../assets/profile/", import.meta.url);
export const ICONS = ["bunny", "bear", "cat", "chick", "cloud", "star"];
const SIZE = 256;

// Fixed bodies (the avatar circle behind keeps the profile color and theme tone).
// Deep tones like the card blob (--card-deep-*), so the white glowing eyes read even at 40px.
const COLORS = { bunny: "#e8789a", bear: "#c39069", cat: "#9b82ea", chick: "#e9b53f", cloud: "#6aa3e8", star: "#f0a24a" };
const CX = 106.6;
// The card blob, scaled to 86% and lowered so ears fit above it.
const body = (cy = 118, k = 0.86) => `<path d="${Blob.PATH}" transform="translate(${CX} ${cy}) scale(${k}) translate(${-CX} ${-CX})"/>`;
const eyesAt = (id, cy, k = 0.86) => {
  const x = v => +(CX + (v - CX) * k).toFixed(2), y = +(cy + (88.4 - CX) * k).toFixed(2);
  return { markup: Blob.eye(id, x(91), y) + Blob.eye(id, x(111.8), y), y };
};
const cheeks = y => `<g fill="#ff8fab" opacity=".45"><ellipse cx="78" cy="${y}" rx="9" ry="5.5"/><ellipse cx="135" cy="${y}" rx="9" ry="5.5"/></g>`;
const star = (cx, cy, outer, inner) => Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 ? inner : outer, a = -Math.PI / 2 + i * Math.PI / 5;
  return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
}).join(" ");

// Each face: shapes inside the grain/inner-shadow group (one silhouette), then eyes and accents on top.
const FACES = {
  bunny: id => {
    const e = eyesAt(id, 122);
    return { skin: `<ellipse cx="84" cy="56" rx="15" ry="34" transform="rotate(-10 84 56)"/><ellipse cx="129" cy="56" rx="15" ry="34" transform="rotate(10 129 56)"/>${body(122)}`,
      top: `<g fill="#ffd9e6" opacity=".75"><ellipse cx="84" cy="60" rx="6" ry="20" transform="rotate(-10 84 60)"/><ellipse cx="129" cy="60" rx="6" ry="20" transform="rotate(10 129 60)"/></g>${e.markup}${cheeks(e.y + 36)}` };
  },
  bear: id => {
    const e = eyesAt(id, 120);
    return { skin: `<circle cx="60" cy="70" r="21"/><circle cx="153" cy="70" r="21"/>${body(120)}`,
      top: `<g fill="#f3dcc4" opacity=".7"><circle cx="60" cy="70" r="9.5"/><circle cx="153" cy="70" r="9.5"/></g>${e.markup}<ellipse cx="${CX}" cy="${e.y + 36}" rx="6" ry="4" fill="#6b4a33" opacity=".75"/>${cheeks(e.y + 34)}` };
  },
  cat: id => {
    const e = eyesAt(id, 120);
    return { skin: `<path d="M56 96 L64 40 L100 70 Z M157 96 L149 40 L113 70 Z" stroke="currentColor" stroke-width="12" stroke-linejoin="round"/>${body(120)}`,
      top: `<g fill="#ffd9e6" opacity=".7"><path d="M67 80 L70 56 L86 70 Z M146 80 L143 56 L127 70 Z"/></g>${e.markup}<path d="M100.6 ${e.y + 34} h12 l-6 6 z" fill="#e8789a"/>${cheeks(e.y + 32)}` };
  },
  chick: id => {
    const e = eyesAt(id, 118);
    return { skin: `<ellipse cx="98" cy="52" rx="7" ry="15" transform="rotate(-22 98 52)"/><ellipse cx="112" cy="48" rx="7" ry="17" transform="rotate(14 112 48)"/>${body(118)}`,
      top: `${e.markup}<path d="M96.6 ${e.y + 32} L${CX} ${e.y + 25} L116.6 ${e.y + 32} L${CX} ${e.y + 40} Z" fill="#f39a3b"/>${cheeks(e.y + 30)}` };
  },
  cloud: id => {
    const e = eyesAt(id, 120, 1);
    return { skin: `<circle cx="70" cy="124" r="32"/><circle cx="108" cy="98" r="44"/><circle cx="146" cy="122" r="34"/><rect x="62" y="110" width="92" height="46" rx="23"/>`,
      top: `${e.markup}${cheeks(e.y + 32)}` };
  },
  star: id => {
    const e = eyesAt(id, 120, 1);
    return { skin: `<polygon points="${star(CX, 112, 72, 34)}" stroke="currentColor" stroke-width="20" stroke-linejoin="round"/>`,
      top: `${e.markup}${cheeks(e.y + 30)}` };
  },
};

export function iconSVG(name) {
  if (!FACES[name]) throw Error("Unknown icon " + name);
  const id = "pi-" + name, color = COLORS[name], face = FACES[name](id);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="18 8 177 177">`
    + `<defs><filter id="${id}-glow" x="0" y="0" width="213.2" height="213.2" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="12"/></filter>`
    + Blob.skinFilter(id, [0, 0, 213.2, 213.2]) + Blob.eyeFilter(id, [60, 60, 93, 90]) + `</defs>`
    + `<circle cx="${CX}" cy="110" r="56" fill="${color}" opacity=".28" filter="url(#${id}-glow)"/>`
    + `<g filter="url(#${id}-skin)" fill="${color}" color="${color}">${face.skin}</g>`
    + face.top + `</svg>`;
}

async function render() {
  const { chromium } = require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(), "aibootcamp-frontend-review/node_modules/playwright"));
  const executablePath = process.env.CARDEX_CHROMIUM || "C:/Program Files/Google/Chrome/Application/chrome.exe";
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1 });
    await mkdir(out, { recursive: true });
    for (const name of ICONS) {
      const svg = iconSVG(name);
      await writeFile(new URL(name + ".svg", out), svg + "\n");
      await page.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`);
      const png = await page.locator("svg").screenshot({ omitBackground: true });
      await writeFile(new URL(name + ".png", out), png);
      console.log(`assets/profile/${name}.png ${png.length} bytes`);
    }
  } finally { await browser.close(); }
}

if (process.argv.includes("--check")) {
  for (const name of ICONS) await access(new URL(name + ".png", out)).catch(() => { throw Error("Missing assets/profile/" + name + ".png: run node tools/build-profile-icons.mjs"); });
  console.log("Profile icons: OK");
} else if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await render();
}
