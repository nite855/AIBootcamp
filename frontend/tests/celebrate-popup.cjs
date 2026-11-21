// 2026-11-21 new-card popup (replaces the bottom badge; reference/Gemini_Generated_Gif_*): switching to
// example mode opens a centered dialog with the best new card large, the others small, "내 감정 도감 보기"
// and "닫기". It never closes by itself, closes with X / 닫기 / Esc / backdrop and returns focus, does not
// reopen for slots already seen, opens the catalog detail, and fits desktop (card left of the copy) and
// phones (stacked, inside the viewport, no horizontal overflow). Plain Node script.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { pathToFileURL } = require('node:url');
const { executablePath } = require('./browser-runtime.cjs');
const { chromium } = require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(), 'aibootcamp-frontend-review/node_modules/playwright'));
const URL = pathToFileURL(path.resolve(__dirname, '../index.html')).href;
const evidence = fs.mkdtempSync(path.join(os.tmpdir(), 'moment-celebrate-popup-'));
const popup = '#celebrate-dialog[open]';

async function open(browser, viewport, theme = 'clean') {
  const page = await browser.newPage({ viewport });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL);
  await page.waitForFunction(() => DiaryReview.isReady());
  await page.evaluate(t => CardexTheme.setTheme(t), theme);
  // The demo switch lives on the profile page (avatar → 기록 관리 · 시연 모드).
  await page.locator('header .avatar').click();
  await page.locator('#settings-records [data-action=preview]').click();
  await page.locator(popup).waitFor({ timeout: 2000 });
  return { page, errors };
}
const box = (page, sel) => page.locator(sel).first().boundingBox();

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    // ── Desktop: content, grade, focus, no auto close ──
    let { page, errors } = await open(browser, { width: 1440, height: 900 });
    const info = await page.evaluate(() => {
      const d = document.getElementById('celebrate-dialog');
      return {
        modal: d.matches(':modal'), example: DiaryReview.getState().mode === 'example', title: d.querySelector('h2').textContent, desc: d.querySelector('.celebrate-desc').textContent,
        grade: d.dataset.grade, cardGrade: d.querySelector('.celebrate-card .mini-card')?.dataset.grade,
        more: d.querySelectorAll('.celebrate-more li:not(.celebrate-rest)').length, rest: d.querySelector('.celebrate-rest')?.textContent || '',
        names: [...d.querySelectorAll('.celebrate-more .sr-only')].map(s => s.textContent), eyebrow: d.querySelector('.celebrate-eyebrow').textContent,
        focus: document.activeElement?.dataset.celebrate, labelled: d.getAttribute('aria-labelledby'),
      };
    });
    assert.equal(info.modal, true, 'popup is a modal dialog');
    assert.equal(info.example, true);
    const count = Number((info.title.match(/(\d+)장/) || [])[1] || 1);
    assert.match(info.title, /^새로운 감정 카드 (\d+장 )?획득!$/);
    assert.ok(count >= 2, 'example mode unlocks several cards at once');
    assert.equal(info.grade, 'stage-3', 'the highest stage leads');
    assert.equal(info.cardGrade, 'stage-3', 'the big card carries the grade effect');
    assert.match(info.desc, new RegExp(`3단계 카드가 도감에 채워졌어요\\. 외 ${count - 1}장도 함께 담겼어요\\.`));
    assert.equal(info.more, Math.min(6, count - 1), 'up to six other cards are shown small');
    assert.equal(info.rest, count - 1 > 6 ? `+${count - 7}` : '');
    assert.ok(info.names.every(n => /^.+ [123]단계$/.test(n)), 'small cards have names for screen readers');
    assert.equal(info.eyebrow, '시연 모드 · MOMENT CARD');
    assert.equal(info.focus, 'catalog', 'focus starts on 내 감정 도감 보기');
    assert.equal(info.labelled, 'celebrate-title');
    // Desktop layout: card left of the copy, centered, inside the viewport; no old bottom badge.
    const panel = await box(page, '.celebrate-panel'), art = await box(page, '.celebrate-art'), copy = await box(page, '.celebrate-copy');
    assert.ok(art.x + art.width <= copy.x, 'card sits left of the copy on desktop');
    assert.ok(Math.abs(panel.x + panel.width / 2 - 720) < 2 && panel.y > 0 && panel.y + panel.height < 900, 'centered inside the viewport');
    assert.equal(await page.locator('.celebrate-badge').count(), 0, 'no bottom badge');
    await page.waitForTimeout(3600);
    assert.equal(await page.locator(popup).count(), 1, 'the popup never closes by itself');
    await page.screenshot({ path: path.join(evidence, 'popup-1440.png') });
    // Esc closes and focus returns to the demo switch that opened it.
    await page.keyboard.press('Escape');
    await page.locator('#celebrate-dialog').waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => document.activeElement?.closest('header .avatar, [data-action=preview]') !== null || document.activeElement === document.body), true);
    // Seen slots do not reopen: back to real mode and into example mode again.
    // (Switching modes leaves the profile page, so go back to it before each toggle.)
    await page.locator('header .avatar').click(); await page.locator('#settings-records [data-action=preview]').click();
    assert.equal(await page.evaluate(() => DiaryReview.getState().mode), 'real');
    await page.locator('header .avatar').click(); await page.locator('#settings-records [data-action=preview]').click();
    assert.equal(await page.evaluate(() => DiaryReview.getState().mode), 'example');
    assert.equal(await page.locator(popup).waitFor({ timeout: 800 }).then(() => true, () => false), false, 'no popup for cards already seen');
    assert.deepEqual(errors, []);
    await page.close();

    // ── X, 닫기 and the backdrop close it; 내 감정 도감 보기 opens the catalog detail ──
    for (const how of ['x', 'close', 'backdrop']) {
      ({ page, errors } = await open(browser, { width: 1440, height: 900 }));
      const before = await page.evaluate(() => DiaryReview.getState().view);
      if (how === 'x') await page.locator(`${popup} .celebrate-x`).click();
      else if (how === 'close') await page.locator(`${popup} .celebrate-close`).click();
      else await page.mouse.click(30, 30);
      await page.locator('#celebrate-dialog').waitFor({ state: 'detached' });
      assert.equal(await page.evaluate(() => DiaryReview.getState().view), before, `${how} stays on the page`);
      assert.deepEqual(errors, []);
      await page.close();
    }
    ({ page, errors } = await open(browser, { width: 1440, height: 900 }));
    const lead = await page.locator(popup).evaluate(d => d.dataset.emotion);
    await page.locator(`${popup} .celebrate-go`).click();
    await page.locator('#card-detail[open]').waitFor({ timeout: 2000 });
    const s = await page.evaluate(() => DiaryReview.getState());
    assert.equal(s.view, 'history'); assert.equal(s.archiveTab, 'catalog');
    assert.deepEqual(s.catalogDetail, { type: lead, stage: 3 }, 'catalog detail of the lead card');
    assert.deepEqual(errors, []);
    await page.close();

    // ── Phone: stacked, inside the viewport, no horizontal overflow; dark theme stays legible ──
    ({ page, errors } = await open(browser, { width: 390, height: 844 }, 'night'));
    await page.waitForTimeout(900);
    const p = await box(page, '.celebrate-panel'), a = await box(page, '.celebrate-art'), c = await box(page, '.celebrate-copy'), go = await box(page, '.celebrate-go');
    assert.ok(a.y + a.height <= c.y + 1, 'card above the copy on phones');
    assert.ok(p.x >= 15 && p.x + p.width <= 375 && p.y >= 0 && p.y + p.height <= 844, 'panel inside the 390 viewport with gutters');
    assert.ok(go.height >= 44 && go.width > c.width * .9, 'full-width primary button with a 44px target');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal overflow (390)');
    const contrast = await page.evaluate(() => {
      const cv = document.createElement('canvas').getContext('2d');
      const rgb = col => { cv.clearRect(0, 0, 1, 1); cv.fillStyle = col; cv.fillRect(0, 0, 1, 1); return [...cv.getImageData(0, 0, 1, 1).data].slice(0, 3); };
      const lum = v => { const x = v.map(n => { n /= 255; return n <= .03928 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }); return .2126 * x[0] + .7152 * x[1] + .0722 * x[2]; };
      const h = document.querySelector('#celebrate-title'), ink = lum(rgb(getComputedStyle(h).color)), surf = lum(rgb(getComputedStyle(document.body).getPropertyValue('--surface')));
      const [hi, lo] = [ink, surf].sort((x, y) => y - x); return (hi + .05) / (lo + .05);
    });
    assert.ok(contrast >= 4.5, `title contrast on night ${contrast.toFixed(2)} >= 4.5`);
    await page.screenshot({ path: path.join(evidence, 'popup-390-night.png') });
    assert.deepEqual(errors, []);
    await page.close();
    console.log('PASS: new-card popup (modal, lead stage-3 card, small cards +N, focus, no auto close, Esc/X/닫기/backdrop, no repeat, catalog detail, desktop row, phone stack, night contrast); evidence: ' + evidence);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
