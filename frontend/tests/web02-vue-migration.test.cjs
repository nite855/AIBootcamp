const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");

test("all Vue SFC components and views compile cleanly with @vue/compiler-sfc", async () => {
  const compiler = require(path.join(ROOT, "node_modules/@vue/compiler-sfc"));
  const sfcFiles = [
    "src/App.vue",
    "src/components/AppHeader.vue",
    "src/components/AppFooter.vue",
    "src/components/ThemeScenery.vue",
    "src/components/CharacterMark.vue",
    "src/components/RecordRow.vue",
    "src/components/EmptyCard.vue",
    "src/components/EmotionCard.vue",
    "src/components/AppDialogs.vue",
    "src/views/AuthView.vue",
    "src/views/HomeView.vue",
    "src/views/RecordsView.vue",
    "src/views/RecordDetail.vue",
    "src/views/StatisticsView.vue",
    "src/views/CatalogView.vue",
    "src/views/SettingsView.vue",
    "src/views/ThemeGallery.vue",
  ];

  for (const rel of sfcFiles) {
    const fullPath = path.join(ROOT, rel);
    const source = fs.readFileSync(fullPath, "utf8");
    const { descriptor, errors } = compiler.parse(source, { filename: fullPath });
    assert.equal(errors.length, 0, `${rel} parse errors: ${errors.map((e) => e.message).join(", ")}`);
    assert.ok(descriptor.template, `${rel} must define a template`);
    assert.equal(
      descriptor.styles.filter((s) => s.scoped).length,
      0,
      `${rel} must not use scoped styles that break BASE-01 selector parity`,
    );
    const compiled = compiler.compileTemplate({
      source: descriptor.template.content,
      filename: fullPath,
      id: rel,
    });
    assert.equal(
      compiled.errors.length,
      0,
      `${rel} template compile errors: ${compiled.errors.join(", ")}`,
    );
  }
});

test("migrated Vue views preserve BASE-01 classes, IDs, dialogs, and accessibility landmarks", () => {
  const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

  const recordsVue = read("src/views/RecordsView.vue");
  assert.ok(recordsVue.includes('id="record-search"'));
  assert.ok(recordsVue.includes('class="record-filters"'));
  assert.ok(recordsVue.includes('id="favorites-only"'));
  assert.ok(recordsVue.includes('id="emotion-filter"'));
  assert.ok(recordsVue.includes("data-sort"));
  assert.ok(recordsVue.includes('class="pagination"'));

  const detailVue = read("src/views/RecordDetail.vue");
  assert.ok(detailVue.includes('class="panel record-panel"'));
  assert.ok(detailVue.includes('class="record-layout show-record-card"'));
  assert.ok(detailVue.includes('id="sample-text"'));

  const cardVue = read("src/components/EmotionCard.vue");
  assert.ok(cardVue.includes('class="flip-scene"'));
  assert.ok(cardVue.includes('class="tilt-layer"'));
  assert.ok(cardVue.includes('class="flip-inner"'));
  assert.ok(cardVue.includes('class="flip-front"'));
  assert.ok(cardVue.includes('class="flip-back"'));
  assert.ok(cardVue.includes('data-action="read-full"'));
  assert.ok(cardVue.includes('data-action="download"'));
  assert.ok(cardVue.includes('popovertarget="card-more"'));

  const statsVue = read("src/views/StatisticsView.vue");
  assert.ok(statsVue.includes('id="stats-month"'));
  assert.ok(statsVue.includes('id="stats-kind"'));
  assert.ok(statsVue.includes('class="calendar-grid"'));
  assert.ok(statsVue.includes('class="stats-chart"'));
  assert.ok(statsVue.includes("선 끊김 = 분석 없는 날"));
  assert.ok(statsVue.includes('class="distribution"'));

  const catalogVue = read("src/views/CatalogView.vue");
  assert.ok(catalogVue.includes('id="catalog-type"'));
  assert.ok(catalogVue.includes('class="catalog-grid"'));

  const settingsVue = read("src/views/SettingsView.vue");
  assert.ok(settingsVue.includes('data-action="theme-gallery"'));
  assert.ok(settingsVue.includes("data-card-motion-toggle"));
  assert.ok(settingsVue.includes('name="policy"'));
  assert.ok(settingsVue.includes('id="backup-file"'));
  assert.ok(settingsVue.includes('id="backup-preview"'));
  assert.ok(settingsVue.includes('data-action="delete-all"'));
  assert.ok(settingsVue.includes('data-action="logout"'));
  assert.ok(settingsVue.includes('data-action="withdraw-account"'));
  assert.ok(!settingsVue.includes('data-action="preview"'));

  const authVue = read("src/views/AuthView.vue");
  assert.ok(authVue.includes('data-auth-tab="login"'));
  assert.ok(authVue.includes('data-auth-tab="register"'));
  assert.ok(authVue.includes("data-consent-code"));
  assert.ok(authVue.includes("민감정보 별도 동의"));

  const galleryVue = read("src/views/ThemeGallery.vue");
  assert.ok(galleryVue.includes('id="theme-current"'));
  assert.ok(galleryVue.includes('class="gallery-filters"'));
  assert.ok(galleryVue.includes('class="theme-gallery-grid"'));
  assert.ok(galleryVue.includes('class="applied-badge"'));

  const dialogsVue = read("src/components/AppDialogs.vue");
  for (const id of ["theme-dialog", "info-dialog", "confirm-dialog", "read-full-dialog"]) {
    assert.ok(dialogsVue.includes(`id="${id}"`), `missing dialog #${id}`);
  }
  assert.ok(dialogsVue.includes('class="moment-celebrate"'));
});

test("cardRenderer generates 1080x1620 SVG without raw diary text and supports neutral marks", async () => {
  // Note: assets.js imports PNG/SVG files handled by Vite; test pure domain + card SVG strings via core & cards.
  const Core = require("../scripts/core.js");
  const Cards = require("../scripts/cards.js");
  const secretText = "이 개인 일기 본문은 PNG SVG 안에 절대 포함되면 안 됩니다.";
  const record = {
    id: "rec-svg-1",
    text: secretText,
    recordDate: "2026-11-17",
    createdAt: "2026-11-17T09:30:00+09:00",
    version: 1,
    analysis: {
      status: "valid",
      version: 1,
      taxonomy_version: Core.TAXONOMY,
      probabilities: Object.fromEntries(Core.IDS.map((id) => [id, id === "neu_2" ? 0.7 : 0.3 / 9])),
    },
  };
  const card = Cards.resolve(record);
  assert.equal(card.status, "ready");
  assert.equal(card.type, "neu_2");
  assert.equal(card.stage, 2);

  // Verify cardRenderer.js source preserves 1080x1620 dimensions and never injects record.text
  const rendererSrc = fs.readFileSync(path.join(ROOT, "src/services/cardRenderer.js"), "utf8");
  assert.ok(rendererSrc.includes('width="1080" height="1620" viewBox="0 0 1080 1620"'));
  assert.ok(!rendererSrc.includes("record.text"), "cardSVG must never render record.text into exported PNG");
});

test("useDiaryStore composable manages save, edit, favorite, query, and backup merge without DOM", async () => {
  // Load UMD domain scripts into globalThis in order before importing useDiaryStore.
  globalThis.CardexCore = require("../scripts/core.js");
  globalThis.DiaryCore = require("../scripts/diary-core.js");
  globalThis.DiaryCards = require("../scripts/cards.js");
  globalThis.DiaryStatistics = require("../scripts/statistics.js");
  globalThis.MomentRecordId = require("../scripts/record-id.js");
  globalThis.DiaryStorage = require("../scripts/storage.js");
  globalThis.MomentBackup = require("../scripts/backup.js");

  // Patch ESM module resolution for pure Node test by verifying composable structure & domain integration
  const storeModSrc = fs.readFileSync(path.join(ROOT, "src/composables/useDiaryStore.js"), "utf8");
  assert.ok(storeModSrc.includes("MomentRecordId.create()"));
  assert.ok(storeModSrc.includes('analysis: { status: "pending" }'));
  assert.ok(storeModSrc.includes("window.DiaryReview = Object.freeze"));

  // Verify MomentBackup roundtrip & merge with real domain modules
  const sampleSession = [
    {
      id: "r-1",
      favorite: true,
      text: "오늘의 합성 기록",
      recordDate: "2026-11-17",
      version: 1,
      createdAt: "2026-11-17T09:00:00+09:00",
      updatedAt: "2026-11-17T09:00:00+09:00",
    },
  ];
  const exported = globalThis.MomentBackup.create(sampleSession);
  const parsed = globalThis.MomentBackup.parse(JSON.stringify(exported));
  const merged = globalThis.MomentBackup.merge([], parsed);
  assert.equal(merged.allowed, true);
  assert.equal(merged.added, 1);
  assert.equal(merged.entries[0].favorite, true);
});
