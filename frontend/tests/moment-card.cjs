// Soft UI v1.1 moment card (5:7) and HTML mini card. Plain Node script against the built index.html.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const {pathToFileURL} = require('node:url');
const {executablePath, reveal, unseal} = require('./browser-runtime.cjs');
const {chromium} = require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(), 'aibootcamp-frontend-review/node_modules/playwright'));

(async () => {
  const browser = await chromium.launch({headless: true, executablePath});
  const evidence = fs.mkdtempSync(path.join(os.tmpdir(), 'moment-card-'));
  try {
    const page = await browser.newPage({offline: true, acceptDownloads: true, viewport: {width: 1440, height: 900}});
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForFunction(() => DiaryReview.isReady());
    await reveal(page, 'settings'); await reveal(page, 'preview');
    await reveal(page, 'archive-records');

    // Every record row shows a mini card; ready rows carry type, stage dots and the No.
    const rows = await page.locator('.entry .mini-art .mini-card').evaluateAll(cards => cards.map(c => ({
      locked: c.classList.contains('is-locked'), type: c.dataset.type, stage: Number(c.dataset.stage),
      dots: c.querySelectorAll('.mc-dots b.on').length, no: c.querySelector('.mc-band em')?.textContent || '',
      ratio: c.getBoundingClientRect().height / c.getBoundingClientRect().width,
    })));
    assert.ok(rows.length >= 5, 'mini cards in the archive list');
    const types = await page.evaluate(() => CardexCore.TYPES.map(t => t.id));
    for (const row of rows) {
      assert.ok(Math.abs(row.ratio - 1.4) < .03, 'mini card is 5:7');
      if (row.locked) continue;
      assert.ok(types.includes(row.type));
      assert.ok(row.stage >= 1 && row.stage <= 3);
      assert.equal(row.dots, row.stage, 'stage dots');
      assert.equal(row.no, 'No.' + String(types.indexOf(row.type) * 3 + row.stage).padStart(3, '0'), 'collection number');
    }
    assert.ok(rows.some(r => r.locked), 'pending records show the locked frame');
    assert.ok(rows.some(r => !r.locked), 'analyzed records show their card');

    // Ready card: 1080×1512 art with header, window, info band; probability stays in <desc>.
    await page.locator('[data-open=sample-1]').click(); await unseal(page);
    const svg = await page.locator('.flip-trigger .art-card').evaluate(el => ({
      w: el.getAttribute('width'), h: el.getAttribute('height'), box: el.getAttribute('viewBox'),
      status: el.dataset.cardStatus, type: el.dataset.cardType, stage: Number(el.dataset.cardStage),
      text: [...el.querySelectorAll('text')].map(t => t.textContent), desc: el.querySelector('desc').textContent,
      ids: [...el.querySelectorAll('[id]')].map(n => n.id), html: el.outerHTML,
    }));
    assert.deepEqual([svg.w, svg.h, svg.box], ['1080', '1512', '0 0 1080 1512']);
    assert.equal(svg.status, 'ready');
    assert.ok(svg.text.some(t => t.startsWith('MOMENT CARD')));
    assert.ok(svg.text.includes('Emotion'));
    assert.ok(svg.text.includes('No.' + String(types.indexOf(svg.type) * 3 + svg.stage).padStart(3, '0')));
    assert.ok(svg.text.some(t => /^\d{4}\.\d{2}\.\d{2}$/.test(t)), 'dotted date');
    assert.match(svg.desc, /분류 확률 \d+%/);
    assert.match(svg.desc, /감정의 강도를 뜻하지 않아요/);
    assert.match(svg.desc, /예시 · 실제 입력 분석 아님/, 'example records are labelled');
    assert.ok(!svg.html.includes('var(--'), 'standalone colors for PNG export');
    assert.ok(svg.text.every(t => Array.from(t).length <= 20), 'info band lines are truncated');
    // Card ids are unique per render (the share preview embeds a second copy).
    assert.equal(new Set(svg.ids).size, svg.ids.length);
    const scene = await page.locator('.flip-scene').boundingBox();
    assert.ok(Math.abs(scene.height / scene.width - 1.4) < .01, 'flip scene is 5:7');
    const download = page.waitForEvent('download'); await reveal(page, 'download');
    const bytes = fs.readFileSync(await (await download).path());
    assert.equal(bytes.readUInt32BE(16), 1080); assert.equal(bytes.readUInt32BE(20), 1512);
    await page.screenshot({path: path.join(evidence, 'card-ready.png')});

    // Share preview embeds the card at 5:7 next to the page card without id clashes.
    await reveal(page, 'share');
    const ids = await page.evaluate(() => [...document.querySelectorAll('svg [id]')].map(n => n.id));
    assert.equal(new Set(ids).size, ids.length, 'no duplicate SVG ids on the share page');
    assert.match(await page.locator('.share-art').evaluate(el => el.outerHTML), /viewBox="0 0 1080 1512"/);

    // Pending card: locked frame, no collection number.
    await reveal(page, 'archive-records');
    const pendingId = await page.locator('.entry:has(.mini-card.is-locked)').first().getAttribute('data-open');
    await page.locator(`[data-open="${pendingId}"]`).click(); await unseal(page);
    const pending = await page.locator('.flip-trigger .art-card').evaluate(el => ({status: el.dataset.cardStatus, text: [...el.querySelectorAll('text')].map(t => t.textContent)}));
    assert.equal(pending.status, 'pending');
    assert.ok(pending.text.includes('Locked') && pending.text.includes('분석 대기 중') && pending.text.includes('?'));
    assert.ok(!pending.text.some(t => t.startsWith('No.')));
    await page.screenshot({path: path.join(evidence, 'card-pending.png')});

    // Phones: the card keeps 5:7 and fits the viewport width.
    await page.setViewportSize({width: 390, height: 844});
    await page.waitForFunction(() => parseInt(document.documentElement.style.getPropertyValue('--app-height')) === innerHeight);
    await page.waitForTimeout(150);
    const phone = await page.locator('.flip-scene').boundingBox();
    assert.ok(phone.width <= 390 && Math.abs(phone.height / phone.width - 1.4) < .01);
    assert.deepEqual(errors, []);
    console.log('PASS: 5:7 moment card (header, window, band, No., dotted date, desc probability, unique ids), PNG 1080x1512, share embed, pending frame, mini cards in rows, phones; evidence: ' + evidence);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
