const {reveal, unseal} = require('./browser-runtime.cjs');
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
        // Messenger-style tabs: every destination is one keyboard step away, no overflow menu.
        await p.locator(`[data-action="${a}"]`).focus(); await p.keyboard.press(key);
        assert.notEqual(await p.evaluate(()=>DiaryReview.getState().view),'write');
      }
    }
    await click('write');
    // First run (Figma "기록 · 첫 실행"): the side column explains how cards are collected instead of the calendar.
    assert.equal(await p.locator('.how-panel').isVisible(),true);
    assert.equal(await p.locator('.write-calendar').count(),0);
    // Record home actions (soft UI v1.1): brand, 3 tabs, avatar, options, save, favorites, all records.
    assert.deepEqual(await p.locator('button:visible:not(.day-card)').evaluateAll(bs=>bs.map(b=>b.dataset.action||b.getAttribute('popovertarget')||(b.dataset.writeCalendar?'view-'+b.dataset.writeCalendar:b.dataset.weekStep?'week'+b.dataset.weekStep:'month'+b.dataset.homeMonth))),
      ['write','write','review-month','catalog','settings','help-write-inline','draft-more','save','favorite-records','archive-records']);
    await p.locator('#diary-text').fill('입력 중 초점 유지');
    assert.equal(await p.evaluate(()=>document.activeElement.id),'diary-text');
    await p.locator('#diary-text').fill('');
    // Menu geometry is checked after leaving the editor; mobile input focus hides it.
    await p.locator('header .brand').focus();
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
      assert.equal(navigation.length,3); // soft UI v1.1: 기록 · 통계 · 도감 (settings via the avatar)
      for(const box of navigation) { assert.ok(box.height>=44); assert.ok(box.x>=0 && box.x+box.width<=size.width); }
      const box = await p.locator('#diary-text').boundingBox();
      assert.ok(box.height >= 48, 'writing area remains usable');
      const editor = await p.locator('.write-editor').boundingBox(), save = await p.locator('[data-action=save]').boundingBox();
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
      // Locked slots carry no caption (Figma); "미발견" stays in their accessible name.
      (await p.locator(".catalog-grid .slot.is-locked").first().getAttribute("aria-label")).includes("미발견"),
    );
    await click('review-month');
    assert.ok(
      (await p.locator(".stats-head").innerText()).includes("기록 1편"),
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
      // Collected slot opens the card detail sheet; it must fit and close with Escape.
      await p.locator('.slot[data-stage="1"]').first().click();
      await p.locator('#card-detail[open]').waitFor();
      await fits();
      await p.keyboard.press('Escape');
      await click('review-month');
      // Phones switch stats panels with buttons (no select); desktop shows trend + distribution together.
      assert.equal(await p.locator('#stats-kind').count(), 0);
      for (const tab of ["trend", "count", "distribution"]) {
        const b = p.locator(`[data-stats="${tab}"]`);
        if (await b.isVisible()) { await b.click(); assert.equal(await p.locator(`[data-stats="${tab}"]`).getAttribute('aria-pressed'), 'true'); }
        await fits();
      }
      await click('archive-records');
      await fits();
      await p.locator('[data-open="sample-1"]').click();
      await unseal(p);
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
    assert.equal(bytes.readUInt32BE(20), 1512); // 5:7 moment card
    await click("card-catalog");
    assert.equal(await p.locator(".slot[data-stage]").count(), 3);
    // 도감에 넣기: toast + the card's catalog detail (Figma second pass).
    await p.locator("#card-detail[open]").waitFor();
    assert.match(await p.locator("#moment-toast").textContent(), /도감에 담겼어요/);
    await p.locator("#card-detail[open] [data-open]").first().click();
    await unseal(p);
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
    console.log({ checks, PNG: "1080x1512", errors, requests });
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
