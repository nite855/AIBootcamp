import { readFile, writeFile } from "node:fs/promises";
const base = new URL("../", import.meta.url);
const read = (p) => readFile(new URL(p, base), "utf8");
const safe = (s) => s.replace(/<\/script/gi, "<\\/script");
let shell = await read("templates/shell.html");
const statisticsView =
  (await read("scripts/statistics-view.js")) +
  "\n" +
  (await read("scripts/catalog-view.js"));
const app = (await read("scripts/app.js")).replace(
  "/*__STATISTICS_VIEW__*/",
  () => statisticsView,
);
const fonts = (await read("styles/base.css"))
  .split("\n")
  .filter((line) => line.startsWith("@font-face"))
  .join("\n");
const styles = fonts + "\n" + (await read("styles/diary.css")) + "\n" + (await read("styles/themes.css")) + "\n" + (await read("styles/frost.css"));
const domain =
  (await read("scripts/core.js")) +
  "\n" +
  (await read("scripts/diary-core.js")) +
  "\n" +
  (await read("scripts/statistics.js")) +
  "\n" +
  (await read("scripts/cards.js"));
for (const [key, value] of Object.entries({
  STYLES: styles,
  THEME: safe(await read("scripts/theme.js")),
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
  "Built Frosted Moment standalone HTML (" +
    Buffer.byteLength(shell) +
    " bytes)",
);
