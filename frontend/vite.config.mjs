import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIRTUAL_FONTS_ID = "virtual:moment-fonts.css";
const RESOLVED_VIRTUAL_FONTS_ID = "\0" + VIRTUAL_FONTS_ID;

const safeScript = (source) => source.replace(/<\/script/gi, "<\\/script");

const UMD_DOMAIN_FILES = new Set(
  [
    "src/domain/core9.js",
    "scripts/core.js",
    "scripts/cards.js",
    "scripts/diary-core.js",
    "scripts/statistics.js",
    "scripts/record-id.js",
    "scripts/storage.js",
    "scripts/backup.js",
  ].map((rel) => path.resolve(__dirname, rel).replace(/\\/g, "/")),
);

/**
 * Force legacy UMD domain scripts to take their browser/globalThis branch in
 * both Vite dev and Rollup build so CommonJS wrappers never trigger `require()`.
 */
function momentUmdDomainPlugin() {
  return {
    name: "moment-umd-domain",
    enforce: "pre",
    transform(code, id) {
      const normalizedId = id.split("?")[0].replace(/\\/g, "/");
      if (!UMD_DOMAIN_FILES.has(normalizedId)) return null;
      return {
        code: `(function (module, exports, require) {\n${code}\n})(undefined, undefined, undefined);\n`,
        map: null,
      };
    },
  };
}

function momentBaselineAssetsPlugin() {
  const readUtf8 = (rel) => readFileSync(path.resolve(__dirname, rel), "utf8");

  return {
    name: "moment-baseline-assets",
    enforce: "post",
    resolveId(id) {
      if (id === VIRTUAL_FONTS_ID) return RESOLVED_VIRTUAL_FONTS_ID;
      return null;
    },
    load(id) {
      if (id === RESOLVED_VIRTUAL_FONTS_ID) {
        // Preserve only @font-face declarations from styles/base.css, matching tools/build.mjs.
        return readUtf8("styles/base.css")
          .split(/\r?\n/)
          .filter((line) => line.startsWith("@font-face"))
          .join("\n");
      }
      return null;
    },
    transformIndexHtml(html) {
      const themeTokens = readUtf8("scripts/generated/theme-tokens.js");
      const themeInit = readUtf8("scripts/theme.js");
      const license = readUtf8("docs/licenses/ibm-plex-sans-kr.txt");

      return html
        .replace(
          "<!--__THEME_PREPAINT__-->",
          () => `<script>\n${safeScript(themeTokens + "\n" + themeInit)}\n</script>`,
        )
        .replace(
          "<!--__FONT_LICENSE__-->",
          () =>
            `<script type="text/plain" id="embedded-font-license">${safeScript(license)}</script>`,
        );
    },
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url === "/" || req.url === "/index.html") {
          req.url = "/app.html";
        }
        next();
      });
    },
    generateBundle(_options, bundle) {
      if (bundle["app.html"]) {
        bundle["app.html"].fileName = "index.html";
      }
    },
  };
}

export default defineConfig({
  plugins: [momentUmdDomainPlugin(), vue(), momentBaselineAssetsPlugin()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "app.html"),
    },
  },
});
