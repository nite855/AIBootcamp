const fs=require('node:fs'), path=require('node:path'), os=require('node:os');
const {chromium}=require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(),'aibootcamp-frontend-review/node_modules/playwright'));
// Prefer the browser matching this Playwright installation. Explicit overrides win.
const executablePath=process.env.CARDEX_CHROMIUM || (fs.existsSync(chromium.executablePath()) ? chromium.executablePath() : 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');
// The full archive and favorites open from the record tab (Figma v0.3 four tabs).
const RECORD_TAB_ACTIONS = new Set(['archive-records', 'favorite-records']);
// Saving opens the sealed card page (2026-11-19). Tests written for the editor flow get the card unsealed
// and are taken back to the editor; pass {stay: true} to inspect the sealed card page instead.
async function reveal(page, action, {stay = false} = {}) {
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
  if (action === 'save' && !stay) {
    // A real save opens the card page with the "분석 대기" panel (or a draw for an analyzed card).
    const opened = await page.locator('.wait-panel, .card-box.is-sealed .mystery-card').first().waitFor({timeout: 1500}).then(() => true, () => false);
    if (opened) {
      await unseal(page);
      await page.locator('.record-panel [data-action="history"]').click();
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
module.exports={executablePath,reveal,unseal,dismissCelebration};
