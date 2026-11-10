async function reveal(page, action) {
  const target = page.locator(`[data-action="${action}"]`).first();
  await target.evaluate(el => { for(let p=el.parentElement;p;p=p.parentElement) if(p.tagName==='DETAILS') p.open=true; });
  const pop = await target.evaluate(el => el.closest('[popover]')?.id);
  if(pop && !await target.isVisible()) await page.locator(`[popovertarget="${pop}"]`).click();
  await target.click();
}
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
    await p.goto(pathToFileURL(path.resolve(__dirname, "../index.html")).href);
    await p.waitForFunction(() => DiaryReview.isReady());
    const click = a => reveal(p,a);
    for (const [action, label] of [["history", "보관함"], ["settings", "설정"]]) {
      const button = p.locator("header").getByRole("button", { name: label, exact: true });
      assert.equal(await button.getAttribute("title"), label);
      assert.equal((await button.innerText()).trim(), "");
      assert.equal(await button.locator('svg[aria-hidden="true"]').count(), 1);
      for (const key of ["Enter", "Space"]) {
        await click("write");
        await button.focus();
        await p.keyboard.press(key);
        assert.equal(await p.evaluate(() => DiaryReview.getState().view), action);
      }
      await click("write");
      await button.click();
      assert.equal(await p.evaluate(() => DiaryReview.getState().view), action);
    }
    await click("write");
    {
      // Empty state: unopened 2:3 card back that reacts to typing without re-rendering.
      await p.setViewportSize({ width: 1440, height: 900 });
      const empty = p.locator(".empty-card");
      assert.equal(await empty.count(), 1);
      const ratio = await empty.evaluate((el) => { const r = el.getBoundingClientRect(); return r.width / r.height; });
      assert.ok(Math.abs(ratio - 2 / 3) < 0.02, `empty card ratio ${ratio}`);
      const caption = await p.locator(".card-area .caption").innerText();
      assert.ok(!caption.includes("뒤집기"), caption);
      assert.ok(caption.includes("기록은 보관할 수 있어요."), caption);
      assert.equal(await empty.getAttribute("data-typing"), "false");
      const hint = () => p.locator(".empty-hint").innerText();
      const idle = await hint();
      const textarea = p.locator("#diary-text");
      await textarea.fill("   \n  ");
      assert.equal(await empty.getAttribute("data-typing"), "false", "whitespace only is not typing");
      await textarea.fill("오늘은 산책을 했다");
      assert.equal(await empty.getAttribute("data-typing"), "true");
      assert.notEqual(await hint(), idle);
      assert.equal(await p.evaluate(() => document.activeElement?.id), "diary-text", "typing keeps focus");
      await textarea.fill("");
      assert.equal(await empty.getAttribute("data-typing"), "false");
      assert.equal(await hint(), idle);
      const animated = await p.locator(".empty-spark").first().evaluate((el) => getComputedStyle(el).animationName);
      assert.equal(animated, "none");
      await p.emulateMedia({ reducedMotion: "reduce" });
      assert.equal(await p.locator(".empty-spark").first().evaluate((el) => getComputedStyle(el).animationName), "none");
      await p.emulateMedia({ reducedMotion: null });
      checks++;
    }
    const fits = async () => {
      await p.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1);

      assert.equal(
        await p.evaluate(
          () =>
            document.documentElement.scrollWidth > innerWidth ||
            document.documentElement.scrollHeight > innerHeight + 1,
        ),
        false,
      );
      checks++;
    };
    for (const size of [{width:1440,height:900},{width:390,height:844},{width:375,height:667},{width:360,height:640},{width:320,height:568}]) {
      await p.setViewportSize(size);
      await p.waitForFunction(() => parseInt(document.documentElement.style.getPropertyValue("--app-height")) === innerHeight);
      await fits();
      const navigation = await p.locator("header .icon").evaluateAll(buttons => buttons.map(button => {
        const { x, y, width, height } = button.getBoundingClientRect();
        return { x, y, width, height };
      }));
      assert.equal(navigation.length, 2);
      for (const box of navigation) {
        assert.equal(box.width, 44);
        assert.equal(box.height, 44);
        assert.ok(box.x >= 0 && box.x + box.width <= size.width);
      }
      assert.equal(navigation[1].x - navigation[0].x - navigation[0].width, 8);
      const brand = await p.locator("header .brand").boundingBox();
      assert.ok(brand.x + brand.width <= navigation[0].x, "brand and navigation do not overlap");
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
    await p.locator(".flip-scene").waitFor();
    assert.equal(await p.locator(".empty-card").count(), 0, "saved record replaces the empty card");
    await click("history");
    assert.ok(
      (await p.locator(".entry-list").innerText()).includes("PRIVATE_RECORD"),
    );
    await p.locator('[data-archive="catalog"]').click();
    assert.ok(
      (await p.locator(".catalog-grid").innerText()).includes("미발견"),
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
        await p.locator('#stats-kind').selectOption(tab);
        await fits();
      }
      await p.locator('[data-archive="records"]').click();
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
