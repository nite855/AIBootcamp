const {reveal} = require('./browser-runtime.cjs');
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
      require('./browser-runtime.cjs').executablePath,
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
    await p.goto(pathToFileURL(path.resolve(__dirname, "../index.html")).href);
    await p.waitForFunction(() => DiaryReview.isReady());
    const click = a => reveal(p,a);
    for (const a of ['review-month','catalog','settings']) {
      for (const key of ['Enter','Space']) {
        await click('write');
        await p.locator('[popovertarget=main-menu]').focus(); await p.keyboard.press(key);
        await p.locator(`[data-action="${a}"]`).focus(); await p.keyboard.press(key);
        assert.notEqual(await p.evaluate(()=>DiaryReview.getState().view),'write');
      }
    }
    await click('write');
    assert.equal(await p.locator('.latest-panel').isVisible(),true);
    assert.equal(await p.locator('button:visible').count(),5);
    await p.locator('#diary-text').fill('입력 중 초점 유지');
    assert.equal(await p.evaluate(()=>document.activeElement.id),'diary-text');
    await p.locator('#diary-text').fill('');
    checks++;
    const fits = async () => {
      await p.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth);

      assert.equal(
        await p.evaluate(
          () =>
            document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      checks++;
    };
    for (const size of [{width:1440,height:900},{width:390,height:844},{width:375,height:667},{width:360,height:640},{width:320,height:568}]) {
      await p.setViewportSize(size);
      await p.waitForFunction(() => parseInt(document.documentElement.style.getPropertyValue("--app-height")) === innerHeight);
      await fits();
      const navigation = await p.locator("header nav button:visible").evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect();return {x:r.x,width:r.width,height:r.height}}));
      assert.equal(navigation.length,2);
      for(const box of navigation) { assert.ok(box.height>=44); assert.ok(box.x>=0 && box.x+box.width<=size.width); }
      const box = await p.locator('#diary-text').boundingBox();
      assert.ok(box.height >= 48, 'writing area remains usable');
      const editor = await p.locator('.editor').boundingBox(), save = await p.locator('[data-action=save]').boundingBox();
      assert.ok(save.y + save.height <= editor.y + editor.height, 'save button remains inside the editor');
      if ([1440,320].includes(size.width)) await p.screenshot({path:path.join(os.tmpdir(), `moment-write-${size.width}.png`)});
    }
    await p.setViewportSize({width:1366,height:768});
    await p.locator("#diary-text").fill("PRIVATE_RECORD_오늘 기록");
    await click("save");
    assert.equal(
      await p.evaluate(() => DiaryReview.getState().sessions.length),
      1,
    );
    await p.locator(".recent-list [data-open]").first().click();
    await p.locator(".flip-scene").waitFor();
    assert.equal(await p.locator(".empty-card").count(), 0, "saved record replaces the empty card");
    await click("archive-records");
    assert.ok(
      (await p.locator(".entry-list").innerText()).includes("PRIVATE_RECORD"),
    );
    await click('catalog');
    assert.ok(
      (await p.locator(".catalog-grid").innerText()).includes("미발견"),
    );
    await click('review-month');
    assert.ok(
      (await p.locator(".month-summary").innerText()).includes("1편의 기록"),
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
      await click("archive-records");
      await click('catalog');
      await fits();
      await p.locator('[data-stage="1"]').click();
      await fits();
      await click('review-month');
      for (const tab of ["trend", "count", "distribution"]) {
        await p.locator('#stats-kind').selectOption(tab);
        await fits();
      }
      await click('archive-records');
      await fits();
      await p.locator('[data-open="sample-1"]').click();
      await fits();
      await p.locator(".flip-trigger").click();
      await p.keyboard.press("Enter");
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
    await p.locator('[data-stage="1"]').click();
    await p.locator("[data-open]").first().click();
    await click("edit-example");
    await p.locator("#sample-text").fill("원문 수정");
    await click("save-example");
    await p.locator(".flip-trigger").click();
      await p.keyboard.press("Enter");
    assert.equal(await p.locator('[data-action="download"]').count(), 0);
    await p.reload();
    await p.waitForFunction(() => DiaryReview.isReady());
    assert.equal(
      await p.evaluate(() => DiaryReview.getState().sessions.length),
      1,
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
