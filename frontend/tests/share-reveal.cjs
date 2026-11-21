// Card reveal, card information panel and share sheet (Figma v0.3 카드 등장 · 공유). Plain Node script.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const {pathToFileURL} = require('node:url');
const {executablePath, reveal, unseal} = require('./browser-runtime.cjs');
const {chromium} = require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(), 'aibootcamp-frontend-review/node_modules/playwright'));

(async () => {
  const browser = await chromium.launch({headless: true, executablePath});
  const evidence = fs.mkdtempSync(path.join(os.tmpdir(), 'moment-share-reveal-'));
  try {
    const page = await browser.newPage({acceptDownloads: true, viewport: {width: 1440, height: 900}});
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForFunction(() => DiaryReview.isReady());
    await page.evaluate(() => CardexTheme.setMotion('on'));
    const click = action => reveal(page, action);

    // Real record: pending card, no share, no emotion picker.
    await page.locator('#diary-text').fill('공유 검사용 PRIVATE_DIARY_TEXT');
    await reveal(page, 'save', {stay: true});
    await page.waitForFunction(() => DiaryReview.getState().sessions.length === 1);
    // Saving opens the card page with the "분석 대기" panel (no draw); reopening shows the card info.
    await page.waitForFunction(() => DiaryReview.getState().view === 'entry');
    await page.locator('.wait-panel').waitFor();
    assert.equal(await page.locator('.mystery-card').count(), 0, 'pending cards never play the draw');
    assert.equal(await page.locator('.card-info').isVisible(), false, 'card info replaced by the wait panel');
    await page.locator('.record-panel [data-action=history]').click();
    await page.locator('.recent-list [data-open]').first().click();
    assert.equal(await page.locator('.card-box[data-grade="pending"]').count(), 1);
    assert.match(await page.locator('.stage-chip').innerText(), /분석 대기/);
    assert.match(await page.locator('#card-info-title').innerText(), /기록은 잘 저장됐어요/);
    assert.equal(await page.locator('[data-action=share]').count(), 0, 'pending cards cannot be shared');
    assert.match(await page.locator('.card-info').innerText(), /AI 감정 분석은 아직 연결 전/);
    assert.equal(await page.locator('.card-info :is(select, input[type=radio], [data-emotion-pick])').count(), 0, 'no manual emotion choice');

    // Example mode: the first open seals the card; tapping flips it with the grade effect, geometry stays fixed.
    await click('settings');
    await page.locator('[data-action=preview]').evaluate(el => { const d = el.closest('details'); if (d) d.open = true; });
    await click('preview');
    // Open a stage-3 card from the catalog detail sheet.
    await click('catalog');
    await page.locator('[data-catalog-filter="pos_1"]').click();
    await page.locator('.slot[data-stage="3"]').click();
    await page.locator('#card-detail[open] [data-open]').first().click();
    await page.locator('.card-box.is-sealed .mystery-card').waitFor();
    assert.equal(await page.locator('.card-box[data-reveal="stage-3"]').count(), 1, 'stage 3 reveal');
    const before = await page.locator('.flip-scene').boundingBox();
    // The draw bursts on its own after ① 1.5s and ② 1.2s.
    await page.locator('.card-box.is-flipping').waitFor({timeout: 4000});
    const during = await page.locator('.flip-scene').boundingBox();
    for (const k of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(before[k] - during[k]) <= 1, 'card geometry fixed while sealed: ' + k);
    await page.waitForFunction(() => !document.querySelector('.card-box.is-flipping'), null, {timeout: 5000});
    const after = await page.locator('.flip-scene').boundingBox();
    for (const k of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(during[k] - after[k]) <= 1, 'card geometry fixed during reveal: ' + k);
    assert.equal(await page.locator('.mystery-card').count(), 0);
    assert.match(await page.locator('#card-info-title').innerText(), /3단계 카드를 얻었어요/);
    assert.match(await page.locator('.card-info').innerText(), /최고 확률 95%/);
    assert.equal(await page.locator('.record-panel [data-action=history]').innerText(), '목록으로');
    await page.screenshot({path: path.join(evidence, 'card-stage3.png')});
    // Re-render of the same record does not replay.
    await click('favorite');
    assert.equal(await page.locator('.mystery-card').count(), 0);

    // Share sheet (soft UI v1.1): title + subtitle, 4:5 preview quoting only the first sentence,
    // formats, four option switches, PNG 1080×1350, story 1080×1920, link copy.
    await click('share');
    assert.equal(await page.evaluate(() => DiaryReview.getState().view), 'share');
    assert.equal(await page.locator('.screen-title').innerText(), '공유하기');
    assert.equal(await page.locator('#share-title').innerText(), '카드 공유하기');
    assert.match(await page.locator('.share-head p').innerText(), /3단계 · \d{4}\.\d{2}\.\d{2}$/);
    assert.equal(await page.locator('.share-art').getAttribute('viewBox'), '0 0 1080 1350');
    assert.match(await page.evaluate(() => DiaryReview.getState().selected), /^sample-\d+$/);
    const art = () => page.locator('.share-art').evaluate(el => el.outerHTML);
    const artText = () => page.locator('.share-art').evaluate(el => [...el.querySelectorAll('text')].map(t => t.textContent).join('|'));
    const dateTexts = () => page.locator('.share-art text').evaluateAll(ts => ts.filter(t => /^\d{4}\.\d{2}\.\d{2}$/.test(t.textContent)).length);
    // Default: the record's first sentence is quoted; the rest of the body never appears.
    assert.ok((await artText()).includes('“오랜만에 친구와 산책했다.”'), 'first sentence quoted by default');
    assert.ok(!(await art()).includes('천천히 이야기하니'), 'second sentence never drawn');
    assert.ok(!(await art()).includes('PRIVATE_DIARY_TEXT'));
    assert.ok(!(await art()).includes('<desc>'), 'no hidden probability description in the image');
    // Figma: the analysis number stays out of the image by default.
    assert.ok(!(await artText()).includes('최고 확률'), 'probability hidden by default');
    assert.match(await artText(), /\d{4}\.\d{2}\.\d{2}/);
    for (const format of ['record', 'mixed', 'card']) {
      await page.locator(`[data-share-format="${format}"]`).click();
      assert.equal(await page.locator(`[data-share-format="${format}"]`).getAttribute('aria-pressed'), 'true');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.shareFormat), format);
      assert.ok((await artText()).includes('오랜만에'), 'quote in ' + format);
    }
    // Options: hide probability, date and emotion name; turn the quote off and on.
    assert.deepEqual(await page.locator('[data-share-opt]').evaluateAll(xs => xs.map(x => [x.dataset.shareOpt, x.checked])), [['quote', true], ['date', true], ['name', true], ['hideProb', true]]);
    await page.locator('[data-share-opt=hideProb]').uncheck();
    assert.equal(await page.evaluate(() => document.activeElement.dataset.shareOpt), 'hideProb');
    assert.match(await artText(), /최고 확률 95%/, 'probability shown when the switch is off');
    await page.locator('[data-share-opt=hideProb]').check();
    assert.ok(!(await artText()).includes('최고 확률'), 'probability hidden');
    const datesBefore = await dateTexts(); // header date + the card's own printed date
    await page.locator('[data-share-opt=date]').uncheck();
    assert.equal(await dateTexts(), datesBefore - 1, 'header date hidden');
    await page.locator('[data-share-opt=name]').uncheck();
    assert.ok(!(await artText()).includes('기쁨·활력'), 'emotion name hidden on the card and caption');
    assert.ok((await artText()).includes('오늘의 카드'));
    await page.locator('[data-share-opt=quote]').uncheck();
    assert.ok(!(await artText()).includes('오랜만에'), 'quote off');
    assert.equal(await page.locator('#share-sentence').isVisible(), false);
    await page.locator('[data-share-opt=quote]').check();
    await page.locator('#share-sentence').fill('오늘은 산책이 좋았다');
    assert.ok((await artText()).includes('오늘은 산책이 좋았다'), 'custom sentence replaces the automatic one');
    assert.equal(await page.locator('#share-sentence').getAttribute('maxlength'), '40');
    await page.screenshot({path: path.join(evidence, 'share-desktop.png')});
    const download = page.waitForEvent('download');
    await click('share-download');
    const file = await download;
    const bytes = fs.readFileSync(await file.path());
    assert.equal(bytes.readUInt32BE(16), 1080);
    assert.equal(bytes.readUInt32BE(20), 1350);
    // Story: without Web Share files the 1080×1920 PNG is downloaded with a hint.
    await page.evaluate(() => { navigator.canShare = () => false; });
    const story = page.waitForEvent('download');
    await click('share-story');
    const storyFile = await story;
    assert.match(storyFile.suggestedFilename(), /^moment-story-\d{4}-\d{2}-\d{2}\.png$/);
    const storyBytes = fs.readFileSync(await storyFile.path());
    assert.equal(storyBytes.readUInt32BE(16), 1080);
    assert.equal(storyBytes.readUInt32BE(20), 1920);
    assert.match(await page.locator('#feedback').innerText(), /스토리 이미지를 저장했어요/);
    // Link copy: the app address goes to the clipboard.
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
    await page.evaluate(() => { window.__copied = null; navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); }; });
    await click('share-link');
    assert.equal(await page.evaluate(() => window.__copied), await page.evaluate(() => location.href.split('#')[0]));
    assert.match(await page.locator('#feedback').innerText(), /앱 주소를 복사했어요/);
    await page.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(Error('denied')); });
    await click('share-link');
    assert.match(await page.locator('#feedback').innerText(), /링크를 복사하지 못했어요/);
    await click('share-close');
    assert.equal(await page.evaluate(() => DiaryReview.getState().view), 'entry');

    // Catalog detail → share → back to the catalog.
    await click('catalog');
    await page.locator('.slot[data-stage="2"]').first().click();
    await page.locator('#card-detail[open] [data-share-record]').click();
    assert.equal(await page.evaluate(() => DiaryReview.getState().view), 'share');
    assert.equal(await page.locator('.tabs [aria-current=page]').innerText(), '도감');
    await click('share-close');
    assert.equal(await page.evaluate(() => [DiaryReview.getState().view, DiaryReview.getState().archiveTab].join()), 'history,catalog');

    // Card effects cannot be turned off any more: the old switch is a no-op and settings has no toggle.
    await page.evaluate(() => CardexTheme.setMotion('off'));
    assert.equal(await page.evaluate(() => document.documentElement.dataset.motion), 'on');
    await click('settings');
    assert.equal(await page.locator('[data-card-motion-toggle]').count(), 0);
    await click('archive-records');
    await page.locator('[data-open="sample-2"]').click();
    await unseal(page);

    // Phones: share sheet and card screen fit without horizontal overflow.
    for (const [w, h] of [[390, 844], [320, 568]]) {
      await page.setViewportSize({width: w, height: h});
      await page.waitForTimeout(150);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `card ${w}`);
      await click('share');
      await page.waitForTimeout(150);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `share ${w}`);
      await page.screenshot({path: path.join(evidence, `share-${w}.png`), fullPage: true});
      await click('share-close');
    }
    assert.deepEqual(errors, []);
    console.log('PASS: pending card, one-time reveal with fixed geometry, card info, share formats/sentence/PNG 1080x1350, catalog share, motion always on, phones; evidence: ' + evidence);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
