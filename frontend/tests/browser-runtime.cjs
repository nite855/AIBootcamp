const fs=require('node:fs'), path=require('node:path'), os=require('node:os');
const {chromium}=require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(),'aibootcamp-frontend-review/node_modules/playwright'));
// Prefer the browser matching this Playwright installation. Explicit overrides win.
const executablePath=process.env.CARDEX_CHROMIUM || (fs.existsSync(chromium.executablePath()) ? chromium.executablePath() : 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');
// The full archive and favorites open from the record tab (Figma v0.3 four tabs).
const RECORD_TAB_ACTIONS = new Set(['archive-records', 'favorite-records']);
// Saving opens the sealed card page (2026-11-19). Tests written for the editor flow get the card unsealed
// and are taken back to the editor; pass {stay: true} to inspect the sealed card page instead.
async function reveal(page, action, {stay = false} = {}) {
  // While the "분석 대기" panel shows, the page's "← 홈으로" is hidden and the panel's "기록으로 돌아가기"
  // is the one way back (2026-11-24).
  if (action === 'history' && await page.locator('.wait-panel [data-wait-action="write"]').count()) {
    await page.locator('.wait-panel [data-wait-action="write"]').click();
    return;
  }
  if (action !== 'save') await unseal(page);
  if (RECORD_TAB_ACTIONS.has(action) && !await page.locator(`[data-action="${action}"]:visible`).count()) {
    if (await page.locator('dialog[open]').count()) await page.keyboard.press('Escape');
    await page.locator('[data-action="write"]').first().click();
  }
  // Statistics keeps all three panels in the DOM and hides some with CSS, so prefer a visible match.
  const visible = page.locator(`[data-action="${action}"]:visible`);
  const target = (await visible.count()) ? visible.first() : page.locator(`[data-action="${action}"]`).first();
  await target.evaluate(el => { for (let p = el.parentElement; p; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true; });
  const popover = await target.evaluate(el => el.closest('[popover]')?.id);
  if (popover && !await target.isVisible()) await page.locator(`[popovertarget="${popover}"]`).click();
  await target.click();
  // Example mode opens the "new card" popup (2026-11-21, modal). Flows that only need the example data
  // close it; tests/celebrate-popup.cjs covers the popup itself.
  if (action === 'preview') await dismissCelebration(page);
  if (action === 'review-month') await settleStats(page);
  if (action === 'save' && !stay) {
    // A real save opens the card page with the "분석 대기" panel (or a draw for an analyzed card).
    const opened = await page.locator('.wait-panel, .card-box.is-sealed .mystery-card').first().waitFor({timeout: 1500}).then(() => true, () => false);
    if (opened) {
      await unseal(page);
      // The wait panel's "기록으로 돌아가기" is the one way back while it shows (2026-11-24, the page's
      // "← 홈으로" is hidden then); after an analyzed draw the page button is used.
      const back = page.locator('[data-wait-action="write"]');
      await ((await back.count()) ? back : page.locator('.record-panel [data-action="history"]')).click();
      await page.locator('#diary-text').waitFor();
    }
  }
}
// An analyzed card opened for the first time plays the draw (2026-11-20: always automatic and identical,
// about 1.5 + 1.2 + 1.7 s). Wait until the real card and its information are back.
async function unseal(page) {
  if (!await page.locator('.mystery-card').count()) return false;
  await page.waitForFunction(() => !document.querySelector('.card-box.is-sealed, .card-box.is-flipping'), null, {timeout: 9000});
  // A popup held back during the draw opens when it finishes.
  await dismissCelebration(page, 300);
  return true;
}
async function dismissCelebration(page, timeout = 1000) {
  const popup = page.locator('#celebrate-dialog[open]');
  if (!await popup.waitFor({timeout}).then(() => true, () => false)) return false;
  await popup.locator('.celebrate-close').click();
  await popup.waitFor({state: 'detached'});
  return true;
}
// Statistics draws its charts once on entry (2026-11-21, about 1.5 s). Wait until every animation in
// it has finished and the counted-up numbers show their final values; tests/stats-motion.cjs covers
// the motion itself.
async function settleStats(page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('[data-stats-anim="in"]');
    if (!root) return true;
    return root.getAnimations({subtree: true}).every(a => a.playState !== 'running' || !String(a.animationName).startsWith('stats-'))
      && [...root.querySelectorAll('[data-count]')].every(el => el.textContent === el.dataset.count);
  }, null, {timeout: 5000});
}
module.exports={executablePath,reveal,unseal,dismissCelebration,settleStats};
