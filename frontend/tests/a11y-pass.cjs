// 2026-11-24 bundle C accessibility pass: persistent live regions (status spoken once, #feedback is only the
// visible copy), no live region on the autosave line, focus on the wait panel after a save, 44px touch
// targets on small controls, --muted for meaningful text, the weekday share as text on phones and the
// profile menu focusing a visible group. Plain Node script.
const assert = require('node:assert/strict'), path = require('node:path'), os = require('node:os');
const { pathToFileURL } = require('node:url');
const { executablePath, reveal } = require('./browser-runtime.cjs');
const { chromium } = require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(), 'aibootcamp-frontend-review/node_modules/playwright'));

// The control is hit at every point of a centred 44×44 square (its ::after may extend past the drawing).
const hitBox = (page, selector) => page.locator(selector).first().evaluate(el => {
  const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const points = [[0, -21], [0, 21], [-21, 0], [21, 0]].map(([dx, dy]) => document.elementFromPoint(cx + dx, cy + dy));
  return { width: r.width, height: r.height, hits: points.map(p => Boolean(p && (p === el || el.contains(p)))) };
});
const assertTarget = async (page, selector, label) => {
  const box = await hitBox(page, selector);
  assert.deepEqual(box.hits, [true, true, true, true], `${label}: 44px target (${box.width.toFixed(0)}×${box.height.toFixed(0)} drawn) ${box.hits}`);
};

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      const mobile = width < 960;
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: mobile, isMobile: mobile });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(process.env.CARDEX_TEST_URL || pathToFileURL(path.resolve(__dirname, '../index.html')).href);
      await page.waitForFunction(() => DiaryReview.isReady());

      // Live regions live outside #app; #feedback and the autosave line are not live regions.
      assert.deepEqual(await page.evaluate(() => ['announcer', 'alerter'].map(id => { const el = document.getElementById(id); return el && !document.getElementById('app').contains(el) && (el.getAttribute('aria-live') || el.getAttribute('role')); })), ['polite', 'alert']);
      assert.equal(await page.locator('#feedback').getAttribute('role'), null);
      assert.equal(await page.locator('#save-status').getAttribute('role'), null);

      // Save: the wait panel title takes focus and the result is spoken once from #announcer.
      await page.locator('#diary-text').fill('접근성 점검 PRIVATE_A11Y_TEXT');
      await reveal(page, 'save', { stay: true });
      await page.locator('.wait-panel').waitFor();
      assert.equal(await page.evaluate(() => document.activeElement?.id), 'wait-title');
      assert.match(await page.locator('#announcer').innerText(), /기록을 저장했어요/);
      assert.match(await page.locator('#feedback').innerText(), /기록을 저장했어요/);
      // A re-render with the same status does not touch the region again.
      await page.evaluate(() => { document.getElementById('announcer').textContent = 'sentinel'; });
      await page.locator('[data-wait-action=catalog]').click();
      assert.equal(await page.locator('#announcer').innerText(), 'sentinel', 'same status is not re-announced');

      await page.locator('[data-action=write]').first().click();
      await page.locator('.write-calendar').waitFor();
      // Small write-screen controls: drawn size unchanged, 44px to the finger.
      await assertTarget(page, '.write-calendar .calendar-switch button', `${width}: calendar switch`);
      await assertTarget(page, '.write-calendar .nav-arrow:not(:disabled)', `${width}: calendar arrow`);
      // Meaningful small text uses --muted.
      const colors = await page.evaluate(() => {
        const probe = document.createElement('i'); probe.style.color = 'var(--muted)'; document.body.append(probe);
        const muted = getComputedStyle(probe).color; probe.remove();
        return { muted, day: getComputedStyle(document.querySelector('.rail-day')).color };
      });
      assert.equal(colors.day, colors.muted, 'weekday labels use --muted');

      // Catalog chips (example data so the filter row is live).
      await reveal(page, 'settings'); await reveal(page, 'preview'); await reveal(page, 'catalog');
      await assertTarget(page, '.catalog-filters .chip', `${width}: catalog chip`);

      // 도감에 넣기 has no visible status bar change of its own: the status names it and is spoken.
      await page.locator('.slot:not(.is-locked) .mini-card').first().click();
      await page.locator('#card-detail[open] .detail-row').first().click();
      await page.locator('[data-action=card-catalog]').first().click();
      await page.waitForFunction(() => /도감에 담겼어요/.test(document.getElementById('announcer').textContent));
      await page.locator('#card-detail[open]').waitFor();
      await page.keyboard.press('Escape');
      await page.locator('#card-detail[open]').waitFor({ state: 'detached' }).catch(() => page.locator('#card-detail[open]').waitFor({ state: 'hidden' }));

      // Card modal close and step arrows.
      await reveal(page, 'review-month');
      await page.locator('[data-card-day]:visible').first().click();
      await page.locator('#card-modal[open]').waitFor();
      await assertTarget(page, '#card-modal .cm-close', `${width}: modal close`);
      await assertTarget(page, '#card-modal .cm-nav .nav-arrow:not(:disabled)', `${width}: modal arrow`);
      await page.keyboard.press('Escape');

      // Phones: the positive share is shown as text beside each weekday bar; trend dots are 44px tall targets.
      if (mobile) {
        const pct = page.locator('.weekday-row .weekday-pct').first();
        assert.equal(await pct.isVisible(), true);
        assert.match(await pct.innerText(), /^(\d+%|—)$/);
        const dot = await page.locator('button.trend-dot').first().evaluate(el => { const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; return [-21, 21].every(dy => { const p = document.elementFromPoint(cx, cy + dy); return p === el; }); });
        assert.equal(dot, true, 'trend dot: 44px tall target');
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

      // Profile menu: the jump focuses a visible group, never the sr-only heading.
      // (phones have no section menu: profile.css hides .profile-nav)
      if (!mobile) {
        await reveal(page, 'settings');
        await page.locator('[data-profile-jump=notice]').click();
        assert.deepEqual(await page.evaluate(() => { const a = document.activeElement; return [a.id, a.classList.contains('sr-only')]; }), ['settings-notice', false]);
        await page.locator('[data-profile-jump=theme]').click();
        assert.equal(await page.evaluate(() => document.activeElement.id), 'theme-title');
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('PASS: persistent live regions (spoken once), quiet autosave line, wait-title focus after save, 44px targets (calendar, chips, modal, trend dots), --muted labels, phone weekday share, profile group focus (1440·390px)');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
