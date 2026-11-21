const { chromium } = require(require('node:path').join(require('node:os').tmpdir(), 'aibootcamp-frontend-review/node_modules/playwright'));
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'aibootcamp-standalone-'));
  const isolatedFile = path.join(directory, 'standalone.html');
  let browser;
  try {
    fs.copyFileSync(path.join(__dirname, 'standalone.html'), isolatedFile);
    browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    const context = await browser.newContext({ offline: true });
    const page = await context.newPage();
    const errors = [], unexpectedRequests = [];
    context.on('page', opened => opened.on('pageerror', error => errors.push(error.message)));
    page.on('pageerror', error => errors.push(error.message));
    const reportUrl = pathToFileURL(isolatedFile).href;
    context.on('request', request => {
      const url = request.url();
      if (url !== reportUrl && !/^(blob:|data:)/.test(url)) unexpectedRequests.push(url);
    });
    await page.goto(reportUrl);
    assert.equal(await page.locator('#matrix tbody tr').count(), 8);
    assert.equal(await page.locator('.project').count(), 8);
    assert.equal(await page.locator('img').count(), 16);
    await page.locator('img').evaluateAll(images => Promise.all(images.map(image => {
      image.loading = 'eager';
      return image.decode();
    })));
    assert.ok(await page.locator('img').evaluateAll(images => images.every(image => image.naturalWidth > 0)));
    assert.ok(await page.locator('a[href]').evaluateAll(links => links.every(link =>
      link.getAttribute('href').startsWith('#') || link.href.startsWith('blob:'))));
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    // Exercise actual clicks after moving only the HTML into an empty directory.
    const links = page.locator('a[data-embedded-href]');
    const openedResources = new Set();
    for (let i = 0; i < await links.count(); i++) {
      const link = links.nth(i);
      const id = await link.getAttribute('data-embedded-href');
      if (openedResources.has(id)) continue;
      openedResources.add(id);
      const popupPromise = page.waitForEvent('popup');
      // Some evidence links are inside closed <details> elements.
      await link.evaluate(element => {
        const details = element.closest('details');
        if (details) details.open = true;
      });
      await link.click();
      const popup = await popupPromise;
      await popup.waitForLoadState('load');
      assert.ok(popup.url().startsWith('blob:'), popup.url());
      assert.ok((await popup.locator('body').innerHTML()).length > 0);
      const image = popup.locator('img');
      if (await image.count() === 1 && await popup.locator('body > img').count() === 1) {
        await image.evaluate(element => element.decode());
      }
      await popup.close();
    }
    assert.equal(openedResources.size, 74);
    assert.deepEqual(unexpectedRequests, []);
    assert.deepEqual(errors, []);
    console.log('PASS: isolated HTML offline; 16 images; 74 embedded links including 8 apps; widths 1440/390; no external requests or JS errors.');
  } finally {
    if (browser) await browser.close();
    if (fs.existsSync(isolatedFile)) fs.unlinkSync(isolatedFile);
    fs.rmdirSync(directory);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
