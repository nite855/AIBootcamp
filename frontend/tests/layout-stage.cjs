// 16:9 desktop stage and fluid mobile layout (Figma v0.3, plan step 2). Plain Node script.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const {pathToFileURL} = require('node:url');
const {executablePath} = require('./browser-runtime.cjs');
const {chromium} = require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(), 'aibootcamp-frontend-review/node_modules/playwright'));

const metrics = page => page.evaluate(() => {
  const root = document.documentElement, shell = document.querySelector('.shell').getBoundingClientRect();
  return {
    vw: root.clientWidth, vh: innerHeight, left: shell.left, right: shell.right, width: shell.width, height: shell.height,
    zoom: Number(getComputedStyle(root).getPropertyValue('--stage-zoom')),
    rails: root.hasAttribute('data-rails') || document.querySelectorAll('.stage-rail').length > 0,
    overflowX: root.scrollWidth > root.clientWidth,
  };
});

(async () => {
  const browser = await chromium.launch({headless: true, executablePath});
  const evidence = fs.mkdtempSync(path.join(os.tmpdir(), 'moment-layout-stage-'));
  try {
    const page = await browser.newPage({offline: true});
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForFunction(() => DiaryReview.isReady());
    const at = async (width, height) => {
      await page.setViewportSize({width, height});
      await page.waitForFunction(h => getComputedStyle(document.documentElement).getPropertyValue('--app-height') === h + 'px', height);
      await page.waitForTimeout(120);
      return metrics(page);
    };

    // Exact 16:9: stage spans the full viewport, no gutters, no rails; >1440 scales up.
    for (const [w, h, zoom] of [[1280, 720, 1], [1920, 1080, 1.333], [2560, 1440, 1.778]]) {
      const m = await at(w, h);
      assert.ok(Math.abs(m.width - m.vw) <= 1, `${w}x${h} stage fills width (${m.width} vs ${m.vw})`);
      assert.ok(m.height >= h - 1, `${w}x${h} stage fills height`);
      assert.ok(Math.abs(m.zoom - zoom) < 0.002, `${w}x${h} zoom ${m.zoom}`);
      assert.equal(m.rails, false, `${w}x${h} no rails`);
      assert.equal(m.overflowX, false, `${w}x${h} no horizontal overflow`);
      await page.screenshot({path: path.join(evidence, `desktop-${w}x${h}.png`)});
    }
    // Taller than 16:9 (16:10, 4:3, 1366x768): full width, panels absorb the extra height.
    for (const [w, h] of [[1440, 900], [1366, 768], [1024, 768]]) {
      const m = await at(w, h);
      assert.ok(Math.abs(m.width - m.vw) <= 1 && m.left >= -1, `${w}x${h} full width`);
      assert.ok(m.height >= h - 1, `${w}x${h} stage at least viewport height`);
      assert.equal(m.zoom, 1, `${w}x${h} no zoom below the 1440 base`);
      assert.equal(m.overflowX, false, `${w}x${h} no horizontal overflow`);
    }
    // Wider than 16:9: stage is 16:9 and centered; the theme background fills the gutters (soft UI v1.1 has no rails).
    for (const [w, h] of [[2560, 1080], [3440, 1440]]) {
      const m = await at(w, h);
      const stage = h * 16 / 9;
      assert.ok(Math.abs(m.width - stage) <= 2, `${w}x${h} stage width ${m.width} ≈ ${stage}`);
      assert.ok(Math.abs(m.left - (m.vw - m.right)) <= 2, `${w}x${h} stage centered`);
      assert.equal(m.rails, false, `${w}x${h} no rails`);
      assert.equal(m.overflowX, false, `${w}x${h} no horizontal overflow`);
      await page.screenshot({path: path.join(evidence, `ultrawide-${w}x${h}.png`)});
    }
    // Top bar (Figma v1.1): one pill with brand, three tabs and the avatar, tabs centred.
    {
      await at(1440, 900);
      const bar = await page.evaluate(() => {
        const box = s => document.querySelector(s).getBoundingClientRect();
        return { header: box('header'), tabs: box('.tabs'), brand: box('header .brand'), avatar: box('header .avatar'), count: document.querySelectorAll('.tabs .tab').length };
      });
      assert.equal(bar.count, 3);
      assert.ok(Math.abs((bar.tabs.left + bar.tabs.right) / 2 - (bar.header.left + bar.header.right) / 2) <= 2, 'tabs centred in the top bar');
      assert.ok(bar.brand.left < bar.tabs.left && bar.avatar.right > bar.tabs.right, 'brand left, avatar right');
      assert.ok(bar.avatar.width >= 44 && bar.avatar.height >= 44, 'avatar touch target');
    }

    // Phones: fluid full width, no zoom, bottom tab bar inside the viewport, save CTA reachable.
    for (const [w, h] of [[320, 568], [360, 780], [390, 844], [430, 932], [768, 1024]]) {
      const m = await at(w, h);
      assert.equal(m.zoom, 1, `${w}x${h} no zoom`);
      assert.equal(m.rails, false, `${w}x${h} no rails`);
      assert.equal(m.overflowX, false, `${w}x${h} no horizontal overflow`);
      const tabs = await page.locator('.tabs').boundingBox();
      assert.ok(tabs && tabs.y + tabs.height <= h + 1 && tabs.y >= 0, `${w}x${h} tab bar inside viewport`);
      assert.ok(tabs.y > h / 2 && tabs.width >= w - 2 * 20 - 1, `${w}x${h} floating bottom bar spans the width (Figma: 20px sides)`);
      const avatar = await page.locator('header .avatar').boundingBox();
      assert.ok(avatar.y < 120 && avatar.x + avatar.width <= w, `${w}x${h} avatar at the top`);
      const save = page.locator('[data-action=save]');
      await save.scrollIntoViewIfNeeded();
      assert.equal(await save.isVisible(), true, `${w}x${h} save visible`);
      await page.screenshot({path: path.join(evidence, `mobile-${w}x${h}.png`)});
    }
    assert.match(await page.locator('meta[name=viewport]').getAttribute('content'), /viewport-fit=cover/);
    assert.deepEqual(errors, []);
    console.log('PASS: 16:9 stage (fill/zoom/centered, no rails), top bar pill with 3 tabs + avatar, taller desktops, phones with floating tab bar; evidence: ' + evidence);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
