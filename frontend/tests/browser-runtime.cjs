const fs=require('node:fs'), path=require('node:path'), os=require('node:os');
const {chromium}=require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(),'aibootcamp-frontend-review/node_modules/playwright'));
// Prefer the browser matching this Playwright installation. Explicit overrides win.
const executablePath=process.env.CARDEX_CHROMIUM || (fs.existsSync(chromium.executablePath()) ? chromium.executablePath() : 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');
async function reveal(page, action) {
  const target = page.locator(`[data-action="${action}"]`).first();
  await target.evaluate(el => { for (let p = el.parentElement; p; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true; });
  const popover = await target.evaluate(el => el.closest('[popover]')?.id);
  if (popover && !await target.isVisible()) await page.locator(`[popovertarget="${popover}"]`).click();
  await target.click();
}
module.exports={executablePath,reveal};
