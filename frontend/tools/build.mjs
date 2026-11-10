import { readFile, writeFile } from "node:fs/promises";
import { buildTokens } from "./build-tokens.mjs";
await buildTokens();
const base = new URL("../", import.meta.url);
const read = (p) => readFile(new URL(p, base), "utf8");
const safe = (s) => s.replace(/<\/script/gi, "<\\/script");
let shell = await read("templates/shell.html");
const statisticsView =
  (await read("scripts/statistics-view.js")) +
  "\n" +
  (await read("scripts/catalog-view.js"));
const assetNames = ["pos_1","pos_2","pos_3","neg_1","neg_2","neg_3","neutral","heart","star"];
const assets = Object.fromEntries(await Promise.all(assetNames.map(async name => [name, "data:image/png;base64," + (await readFile(new URL("assets/characters/" + name + ".png", base))).toString("base64")])));
const persistence = await read("scripts/persistence.js");
const app = (await read("scripts/app.js")).replace("/*__OBJECT_ASSETS__*/", () => JSON.stringify(assets)).replace("/*__PERSISTENCE__*/", () => persistence).replace(
  "/*__STATISTICS_VIEW__*/",
  () => statisticsView,
);
const fonts = (await read("styles/base.css"))
  .split("\n")
  .filter((line) => line.startsWith("@font-face"))
  .join("\n");
const styles = fonts + "\n" + (await read("styles/diary.css")) + "\n" + (await read("styles/themes.css")) + "\n" + (await read("styles/generated/tokens.css")) + "\n" + (await read("styles/flip.css"));
const domain =
  (await read("scripts/core.js")) +
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
const license = await read("docs/licenses/ibm-plex-sans-kr.txt");
shell = shell.replace(
  "</body>",
  () =>
    '<script type="text/plain" id="embedded-font-license">' +
    safe(license) +
    "</script>\n</body>",
);
await writeFile(new URL("index.html", base), shell);
console.log(
  "Built Diary Simple v3 standalone HTML (" +
    Buffer.byteLength(shell) +
    " bytes)",
);
