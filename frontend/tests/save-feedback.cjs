// 2026-11-24 critique P1 fixes for the moment of saving (Plain Node script, Playwright).
// 1) A save that fails validation shows a writer-facing message inside the write bar, on screen, and typing
//    clears it (it used to land in #feedback below the fold as "비어 있는 기록이 있습니다…삭제해 주세요").
// 2) After a save the "분석 대기" panel title is on the first screen, before the card, with no "저장했어요"
//    toast over it and no foil hint above a waiting card.
// 3) Back on the editor, the "오늘 작성 완료" bar shows its whole sentence on phones (it was cut to "기록을 :").
// The save button reads "기록 남기기" on every width.
const assert = require('node:assert/strict'), path = require('node:path'), os = require('node:os');
const { pathToFileURL } = require('node:url');
const { executablePath } = require('./browser-runtime.cjs');
const { chromium } = require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(), 'aibootcamp-frontend-review/node_modules/playwright'));
const URL = process.env.CARDEX_TEST_URL || pathToFileURL(path.resolve(__dirname, '../index.html')).href;

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    for (const [width, height] of [[1440, 900], [1366, 768], [390, 844], [320, 640]]) {
      const mobile = width < 960, tag = `${width}x${height}`;
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: mobile, isMobile: mobile });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(URL);
      await page.waitForFunction(() => DiaryReview.isReady());
      const save = page.locator('.write-actions [data-action=save]');
      const onScreen = async locator => { const b = await locator.boundingBox(); return Boolean(b) && b.y >= 0 && b.y + b.height <= height; };

      assert.equal(await save.innerText(), '기록 남기기', `${tag}: label`);

      // Empty and whitespace-only saves explain themselves in the bar.
      for (const text of ['', '   \n  ']) {
        await page.locator('#diary-text').fill(text);
        await save.click();
        const error = page.locator('#write-error');
        await error.waitFor();
        assert.match(await error.innerText(), /한 줄만 적어도 저장할 수 있어요/, `${tag}: empty message`);
        assert.ok(await onScreen(error), `${tag}: the error is on the first screen`);
        assert.doesNotMatch(await page.locator('#feedback').innerText(), /비어 있는 기록|삭제해 주세요/, `${tag}: no domain wording`);
        assert.match(await page.locator('#alerter').innerText(), /한 줄만 적어도/, `${tag}: announced once as an alert`);
        assert.equal(await page.locator('#char-count').isVisible(), false, `${tag}: the counter yields to the error`);
        assert.equal(await page.locator('#save-status').isVisible(), false, `${tag}: so does the save status`);
        assert.equal((await page.evaluate(() => DiaryReview.getState().sessions.length)), 0, `${tag}: nothing saved`);
      }
      // Symbols only: a different, specific message.
      await page.locator('#diary-text').fill('!!! ...');
      await save.click();
      await page.waitForFunction(() => /글자나 숫자를 한 자 이상/.test(document.querySelector('#write-error')?.textContent || ''));
      // Typing clears the error and brings the counter back, without losing the draft.
      await page.locator('#diary-text').fill('');
      await page.locator('#diary-text').pressSequentially('오늘');
      assert.equal(await page.locator('#write-error').count(), 0, `${tag}: typing clears the error`);
      assert.equal(await page.locator('.write-editor[data-write-error]').count(), 0);
      assert.equal(await page.locator('#diary-text').inputValue(), '오늘');

      // A real save: the wait panel's title is on the first screen, before the card, with no toast or foil hint.
      await page.locator('#diary-text').fill('오늘은 수업이 길어서 좀 지쳤다. 그래도 저녁에 친구랑 떡볶이 먹으면서 한참 웃었더니 기분이 풀렸다.');
      await save.click();
      const title = page.locator('#wait-title');
      await title.waitFor();
      await page.waitForTimeout(500); // the panel's entrance and any toast would be showing by now
      assert.ok(await onScreen(title), `${tag}: "기록은 잘 저장됐어요" is on the first screen`);
      assert.equal(await page.evaluate(() => document.activeElement?.id), 'wait-title', `${tag}: focus moves to the title`);
      const order = await page.evaluate(() => {
        const panel = document.querySelector('.wait-panel'), stage = document.querySelector('.card-stage');
        return Boolean(panel.compareDocumentPosition(stage) & Node.DOCUMENT_POSITION_FOLLOWING);
      });
      assert.ok(order, `${tag}: the panel comes before the card`);
      assert.ok(await onScreen(page.locator('[data-wait-action=write]')), `${tag}: "기록으로 돌아가기" on the first screen`);
      assert.equal(await page.locator('#moment-toast.show').count(), 0, `${tag}: no toast over the panel`);
      assert.equal(await page.locator('.record-top .card-effect-hint').count(), 0, `${tag}: no foil hint above a waiting card`);
      const steps = await page.locator('.wait-steps').boundingBox(), stage = await page.locator('.card-stage').boundingBox();
      assert.ok(steps.y + steps.height <= stage.y + 1, `${tag}: the step chips lead the panel, outside the stage`);

      // Back on the editor: the done bar's sentence is whole and the two buttons stay 44px tall.
      await page.locator('[data-wait-action=write]').click();
      const status = page.locator('.done-status');
      await status.waitFor();
      assert.match(await status.innerText(), /기록을 저장했어요 · 카드는 분석 대기 중이에요/);
      assert.ok(await status.evaluate(el => el.scrollWidth <= el.clientWidth + 1), `${tag}: the done sentence is not cut`);
      for (const b of await page.locator('.done-actions > button').all()) assert.ok((await b.boundingBox()).height >= 44, `${tag}: 44px buttons`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tag}: no horizontal overflow`);

      // Opening the saved record later (not right after a save) keeps the usual card page and its foil hint.
      await page.locator('[data-open]').first().click();
      await page.locator('.record-panel .card-info').waitFor();
      assert.equal(await page.locator('.wait-panel').count(), 0, `${tag}: the wait panel belongs to the save only`);

      assert.deepEqual(errors, [], `${tag}: no page errors`);
      await context.close();
      console.log(`ok ${tag}`);
    }
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
