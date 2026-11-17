const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT, "dist");

test("Vite build emits dist/index.html with pre-paint theme init, font license, and bundles", () => {
  const indexHtmlPath = path.join(DIST_DIR, "index.html");
  assert.ok(fs.existsSync(indexHtmlPath), "frontend/dist/index.html must exist after Vite build");
  const html = fs.readFileSync(indexHtmlPath, "utf8");

  assert.ok(html.includes("window.CardexDesignThemes"), "pre-paint CardexDesignThemes missing");
  assert.ok(html.includes("window.CardexTheme"), "pre-paint CardexTheme missing");
  assert.ok(html.includes('id="embedded-font-license"'), "IBM Plex Sans KR license missing");
  assert.ok(html.includes('id="app"'), "#app mount point missing");
  assert.ok(html.includes('id="announcer"'), "#announcer live region missing");
  assert.ok(html.includes('id="toast"'), "#toast undo container missing");

  const themeScriptIdx = html.indexOf("window.CardexDesignThemes");
  const moduleScriptIdx = html.indexOf('type="module"');
  assert.ok(themeScriptIdx > 0 && moduleScriptIdx > themeScriptIdx, "theme init must run before module script");

  const cssMatch = html.match(/href="\/?(assets\/[^"]+\.css)"/);
  const jsMatch = html.match(/src="\/?(assets\/[^"]+\.js)"/);
  assert.ok(cssMatch, "built CSS link missing in dist/index.html");
  assert.ok(jsMatch, "built JS script missing in dist/index.html");
  assert.ok(fs.existsSync(path.join(DIST_DIR, cssMatch[1])), "built CSS asset file missing");
  assert.ok(fs.existsSync(path.join(DIST_DIR, jsMatch[1])), "built JS asset file missing");
});

test("built CSS preserves exact BASE-01 cascade order and all 20 theme/mode selectors", () => {
  const assetsDir = path.join(DIST_DIR, "assets");
  const cssFile = fs.readdirSync(assetsDir).find((f) => f.endsWith(".css"));
  assert.ok(cssFile, "built CSS file must exist");
  const css = fs.readFileSync(path.join(assetsDir, cssFile), "utf8");

  const markers = [
    ["font-face", "IBM Plex Sans KR"],
    ["diary", ".shell{height:var(--app-height"],
    ["themes", "data-appearance=paper"],
    ["tokens", "color-background"],
    ["flip", ".flip-scene"],
    ["benchmark", ".app-scenery"],
    ["moment", ".screen-title"],
  ];
  const positions = markers.map(([name, token]) => [name, css.indexOf(token)]);
  for (const [name, pos] of positions) {
    assert.ok(pos >= 0, `CSS layer marker missing: ${name}`);
  }
  for (let i = 1; i < positions.length; i++) {
    assert.ok(
      positions[i][1] > positions[i - 1][1],
      `CSS layer order violated: ${positions[i - 1][0]} (${positions[i - 1][1]}) vs ${positions[i][0]} (${positions[i][1]})`,
    );
  }

  assert.ok(!css.includes(".app-shell{min-height:100vh}"), "non-@font-face legacy rules from base.css must not leak");

  const themeIds = [
    "blossom",
    "paper",
    "sage",
    "aurora",
    "editorial",
    "retro",
    "lemon",
    "forest",
    "sunset",
    "starlight",
  ];
  for (const id of themeIds) {
    for (const mode of ["light", "dark"]) {
      assert.ok(
        css.includes(`[data-appearance=${id}][data-theme=${mode}]`) ||
          css.includes(`[data-appearance="${id}"][data-theme="${mode}"]`),
        `missing theme/mode selector: ${id}/${mode}`,
      );
    }
  }
});

test("Vue shell and HomeView preserve BASE-01 DOM hierarchy and classes", () => {
  const appVue = fs.readFileSync(path.join(ROOT, "src/App.vue"), "utf8");
  const headerVue = fs.readFileSync(path.join(ROOT, "src/components/AppHeader.vue"), "utf8");
  const homeVue = fs.readFileSync(path.join(ROOT, "src/views/HomeView.vue"), "utf8");
  const footerVue = fs.readFileSync(path.join(ROOT, "src/components/AppFooter.vue"), "utf8");

  assert.ok(appVue.includes('class="shell"'));
  assert.ok(appVue.includes("'home-workspace'"));
  assert.ok(!appVue.includes("<style scoped"), "avoid scoped style specificity changes in App.vue");

  assert.ok(headerVue.includes('class="topbar-title"') && headerVue.includes('class="tabs"'));
  assert.ok(homeVue.includes('class="editor home-editor"') && homeVue.includes('class="home-aside"'));
  assert.ok(homeVue.includes('class="panel latest-panel"') && homeVue.includes('class="panel recent-panel"'));
  assert.ok(homeVue.includes('id="diary-text"') && homeVue.includes('id="char-count"'));
  assert.ok(footerVue.includes("EVERY DAY IS A LITTLE ART."));
});
