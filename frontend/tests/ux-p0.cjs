// P0 UX regressions: character counter, oversized draft message, example→real save confirmation, help-write semantics.
const assert = require('node:assert/strict'), path = require('node:path'), { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.CARDEX_PLAYWRIGHT || path.join(require('node:os').tmpdir(), 'aibootcamp-frontend-review/node_modules/playwright'));
const { executablePath, reveal, unseal } = require('./browser-runtime.cjs');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(process.env.CARDEX_TEST_URL || pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForFunction(() => DiaryReview.isReady());
    const counter = page.locator('#char-count');
    const field = page.locator('#diary-text');

    // help-write opens a dialog, so it advertises a dialog popup instead of a stale aria-expanded.
    const help = page.locator('[data-action=help-write]');
    assert.equal(await help.getAttribute('aria-haspopup'), 'dialog');
    assert.equal(await help.getAttribute('aria-expanded'), null);
    assert.equal(await page.locator('#writing-question').count(), 0);

    // Counter: ok → warn → over, described by the textarea, text never truncated.
    assert.ok((await field.getAttribute('aria-describedby')).split(' ').includes('char-count'));
    assert.equal(await counter.getAttribute('data-level'), 'ok');
    assert.equal(await counter.textContent(), '0 / 10,000자');
    await field.fill('가'.repeat(9000));
    assert.equal(await counter.getAttribute('data-level'), 'warn');
    assert.ok((await counter.textContent()).startsWith('9,000 / 10,000자'));
    await field.fill('가'.repeat(10001));
    assert.equal(await counter.getAttribute('data-level'), 'over');
    assert.ok((await counter.textContent()).includes('1자 초과'));
    await page.waitForFunction(() => DiaryReview.getState().error);
    await reveal(page, 'storage-details');
    const detail = await page.locator('#info-copy').innerText();
    assert.ok(detail.includes('10,000자를 넘어'), detail);
    assert.ok(!detail.includes('형식을 확인할 수 없어요'), 'no misleading format error');
    await page.keyboard.press('Escape');
    assert.equal(Array.from(await field.inputValue()).length, 10001, 'draft kept, not truncated');
    await field.fill('줄인 초안');
    await page.waitForFunction(() => document.querySelector('#save-status')?.textContent === '초안 저장됨');
    assert.equal(await counter.getAttribute('data-level'), 'ok');

    // Example mode: saving asks before switching to real mode; cancel keeps example mode and saves nothing.
    await reveal(page, 'settings');
    await reveal(page, 'preview');
    await page.waitForFunction(() => DiaryReview.getState().mode === 'example');
    await reveal(page, 'write');
    await field.fill('예시 모드에서 쓴 실제 기록');
    await reveal(page, 'save');
    const dialog = page.locator('#confirm-dialog');
    assert.equal(await dialog.isVisible(), true);
    assert.equal(await dialog.locator('#confirm-title').textContent(), '실제 기록으로 저장');
    assert.equal(await dialog.locator('[data-confirm=accept]').textContent(), '실제 기록으로 저장');
    await dialog.locator('[data-confirm=cancel]').click();
    let state = await page.evaluate(() => DiaryReview.getState());
    assert.equal(state.mode, 'example');
    assert.equal(state.sessions.length, 0);
    assert.equal(await page.locator('[data-action=save]').evaluate(el => el === document.activeElement), true, 'focus returns to save');
    await reveal(page, 'save');
    await dialog.locator('[data-confirm=accept]').click();
    await page.waitForFunction(() => DiaryReview.getState().mode === 'real' && DiaryReview.getState().sessions.length === 1);
    // A confirmed save opens the card page with the "분석 대기" panel; go back home.
    await page.locator('.wait-panel').waitFor();
    await reveal(page, 'history');

    // Delete confirmation keeps its own title and label after the dialog was reused.
    await page.locator('.recent-list [data-open]').first().click();
    await reveal(page, 'delete-example');
    assert.equal(await dialog.locator('#confirm-title').textContent(), '삭제 확인');
    assert.equal(await dialog.locator('[data-confirm=accept]').textContent(), '삭제');
    await dialog.locator('[data-confirm=cancel]').click();

    // Pending card title names the analysis state; storage state stays in the caption.
    const pendingCard = page.locator('.flip-trigger .art-card');
    assert.equal(await pendingCard.getAttribute('aria-label'), '분석 대기 감정 카드');
    assert.ok(!(await pendingCard.innerHTML()).includes('기록을 보관했어요'));
    assert.ok((await page.locator('.card-area .caption').innerText()).includes('기록을 보관했어요'));

    // Mobile: the quiet counter is hidden, warnings stay visible.
    await page.setViewportSize({ width: 360, height: 640 });
    await reveal(page, 'write');
    assert.equal(await counter.isVisible(), false);
    await field.fill('가'.repeat(9500));
    assert.equal(await counter.isVisible(), true);

    assert.deepEqual(errors, []);
    console.log('PASS: P0 UX counter/limit message/example save confirm/help-write semantics');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
