import { readFile, writeFile } from "node:fs/promises";
import { buildTokens } from "./build-tokens.mjs";
import { backupGenerated } from "./backup-generated.mjs";
await backupGenerated();
await buildTokens();
const base = new URL("../", import.meta.url);
const read = (p) => readFile(new URL(p, base), "utf8");
const safe = (s) => s.replace(/<\/script/gi, "<\\/script");
let shell = await read("templates/shell.html");
const statisticsView =
  (await read("scripts/home-view.js")) + "\n" +
  (await read("scripts/statistics-view.js")) +
  "\n" +
  (await read("scripts/catalog-view.js")) + "\n" +
  (await read("scripts/celebrate-view.js")) + "\n" +
  (await read("scripts/share-view.js")) + "\n" +
  (await read("scripts/profile-view.js"));
// 2026-11-22: cards draw the Figma blob (scripts/blob-art.js); only the empty-card heart PNG is still embedded.
const assetNames = ["heart"];
const assets = Object.fromEntries(await Promise.all(assetNames.map(async name => [name, "data:image/png;base64," + (await readFile(new URL("assets/characters/" + name + ".png", base))).toString("base64")])));
const persistence = await read("scripts/persistence.js");
const benchmark = await read("scripts/benchmark.js");
const app = (await read("scripts/app.js")).replace("/*__OBJECT_ASSETS__*/", () => JSON.stringify(assets)).replace("/*__PERSISTENCE__*/", () => persistence + "\n" + benchmark).replace(
  "/*__STATISTICS_VIEW__*/",
  () => statisticsView,
);
const fonts = (await read("styles/base.css"))
  .split("\n")
  .filter((line) => line.startsWith("@font-face"))
  .join("\n");
const styles = fonts + "\n" + (await read("styles/diary.css")) + "\n" + (await read("styles/themes.css")) + "\n" + (await read("styles/generated/tokens.css")) + "\n" + (await read("styles/flip.css")) + "\n" + (await read("styles/benchmark.css")) + "\n" + (await read("styles/layout.css")) + "\n" + (await read("styles/moment.css")) + "\n" + (await read("styles/screens.css")) + "\n" + (await read("styles/soft.css")) + "\n" + (await read("styles/write.css")) + "\n" + (await read("styles/collection.css")) + "\n" + (await read("styles/stats.css")) + "\n" + (await read("styles/stats-motion.css")) + "\n" +(await read("styles/profile.css")) + "\n" + (await read("styles/share.css")) + "\n" + (await decorStyles()) + "\n" + (await read("styles/grade-effects.css"));
// Soft UI v1.1 (2026-11-20): scrapbook.css is no longer shipped. Theme decoration SVGs are
// inlined as data URIs so the HTML stays standalone.
async function decorStyles() {
  const svgURI = async (p) => "data:image/svg+xml," + encodeURIComponent((await read(p)).trim());
  let css = await read("styles/theme-decor.css");
  for (const [marker, file] of [["CANDY", "candy-stars"], ["NOISE", "glass-noise"], ["SNOW", "mist-snow"], ["STITCH", "tearoom-stitch"]]) {
    css = css.replaceAll(`__DECOR_${marker}__`, await svgURI(`assets/themes/${file}.svg`));
  }
  if (/__DECOR_[A-Z_]+__/.test(css)) throw Error("Unresolved theme decoration marker");
  return css;
}
const domain =
  (await read("scripts/record-id.js")) + "\n" + (await read("scripts/core.js")) + "\n" + (await read("scripts/blob-art.js")) + "\n" + (await read("scripts/profile.js")) + "\n" + (await read("scripts/share-core.js")) +
  "\n" +
  (await read("scripts/diary-core.js")) +
  "\n" +
  (await read("scripts/statistics.js")) +
  "\n" +
  (await read("scripts/cards.js")) + "\n" + (await read("scripts/storage.js")) + "\n" + (await read("scripts/flip.js"));
for (const [key, value] of Object.entries({
  STYLES: styles,
  THEME: safe((await read("scripts/generated/theme-tokens.js")) + "\n" + (await read("scripts/theme.js"))),
  DOMAIN: safe(domain),
  APP: safe(app),
})) {
  const marker = "/*__" + key + "__*/";
  if (!shell.includes(marker)) throw Error("Missing marker " + key);
  shell = shell.replace(marker, () => value);
}
const license =
  "== Gothic A1 (subset) ==\n" + (await read("docs/licenses/gothic-a1-ofl.txt")) +
  "\n\n== Bricolage Grotesque (static subset instances) ==\n" + (await read("docs/licenses/bricolage-grotesque-ofl.txt"));
shell = shell.replace(
  "</body>",
  () =>
    '<script type="text/plain" id="embedded-font-license">' +
    safe(license) +
    "</script>\n</body>",
);
await writeFile(new URL("index.html", base), shell);
console.log(
  "Built 오늘의 모먼트 standalone HTML (" +
    Buffer.byteLength(shell) +
    " bytes)",
);
