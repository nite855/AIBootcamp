const assert = require("node:assert/strict"),
  path = require("node:path"),
  os = require("node:os"),
  fs = require("node:fs");
const { pathToFileURL } = require("node:url");
const { chromium } = require(
  process.env.CARDEX_PLAYWRIGHT ||
    path.join(
      os.tmpdir(),
      "aibootcamp-frontend-review/node_modules/playwright",
    ),
);
(async () => {
  const b = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CARDEX_CHROMIUM ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  let checks = 0;
  const errors = [],
    requests = [];
  try {
    const p = await b.newPage({ offline: true, acceptDownloads: true });
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("request", (r) => {
      if (/^https?:/.test(r.url())) requests.push(r.url());
    });
    await p.goto(pathToFileURL(path.resolve(__dirname, "../" + (process.env.MOMENT_VARIANT || "lemon") + ".html")).href);
    const click = (a) => p.locator(`[data-action="${a}"]`).first().click();
    const fits = async () => {
      assert.equal(
        await p.evaluate(
          () =>
            document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      checks++;
    };
    await p.locator("#diary-text").fill("PRIVATE_RECORD_오늘 기록");
    await click("save");
    assert.equal(
      await p.evaluate(() => DiaryReview.getState().sessions.length),
      1,
    );
    await click("history");
    assert.ok(
      (await p.locator(".entry-list").innerText()).includes("PRIVATE_RECORD"),
    );
    await p.locator('[data-archive="catalog"]').click();
    assert.ok(
      (await p.locator(".archive-panel").innerText()).includes("0 / 21"),
    );
    await p.locator('[data-archive="stats"]').click();
    assert.ok(
      (await p.locator(".stats-summary").innerText()).includes("기록 1편"),
    );
    await click("settings");
    await click("preview");
    assert.equal(
      await p.evaluate(() => DiaryReview.getState().mode),
      "example",
    );
    assert.ok(
      !(await p.locator(".entry-list").innerText()).includes("PRIVATE_RECORD"),
    );
    for (const size of [
      { width: 1366, height: 768 },
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
      { width: 360, height: 640 },
      { width: 320, height: 568 },
    ]) {
      await p.setViewportSize(size);
      await click("history");
      await p.locator('[data-archive="catalog"]').click();
      await fits();
      await p.locator('[data-stage="1"]').click();
      await fits();
      await p.locator('[data-archive="stats"]').click();
      for (const tab of ["trend", "count", "distribution"]) {
        await p.locator(`[data-stats="${tab}"]`).click();
        await fits();
      }
      await p.locator('[data-archive="records"]').click();
      await fits();
      await p.locator('[data-open="sample-1"]').click();
      await fits();
      await p.locator('[data-record-tab="card"]').click();
      await fits();
    }
    const d = p.waitForEvent("download");
    await click("download");
    const file = await d;
    const bytes = fs.readFileSync(await file.path());
    assert.equal(bytes.readUInt32BE(16), 1080);
    assert.equal(bytes.readUInt32BE(20), 1620);
    await click("card-catalog");
    assert.equal(await p.locator("[data-stage]").count(), 3);
    await click("catalog-records");
    await p.locator("[data-open]").first().click();
    await click("edit-example");
    await p.locator("#sample-text").fill("원문 수정");
    await click("save-example");
    await p.locator('[data-record-tab="card"]').click();
    assert.equal(await p.locator('[data-action="download"]').count(), 0);
    await p.reload();
    assert.equal(
      await p.evaluate(() => DiaryReview.getState().sessions.length),
      0,
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, []);
    console.log({ checks, PNG: "1080x1620", errors, requests });
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
