// 2026-11-24 bundle E and follow-up fixes: a new screen opens at the top with its own document.title,
// zoom-aware height guards on wide desktops, share quotes wrapped at spaces with "…" and the closing
// quote kept, a positive "분석 확률 표시" switch, plain catalog legend, "다시 시도" wording,
// the storage warning on phones, foil hints only beside open cards and "도감에서 보기".
// Plain Node script.
const assert = require('node:assert/strict'), path = require('node:path'), os = require('node:os');
const { pathToFileURL } = require('node:url');
const { executablePath, reveal, unseal } = require('./browser-runtime.cjs');
const { chromium } = require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(), 'aibootcamp-frontend-review/node_modules/playwright'));
const URL = process.env.CARDEX_TEST_URL || pathToFileURL(path.resolve(__dirname, '../index.html')).href;

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    // Phone: titles, scroll reset, storage warning, hints, card actions, share quote.
    {
      const context = await browser.newContext({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true });
      const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(URL); await page.waitForFunction(() => DiaryReview.isReady());
      assert.equal(await page.title(), '기록 · 오늘의 모먼트');
      const warn = page.locator('#privacy');
      assert.equal(await warn.isVisible(), true, 'storage warning visible on phones');
      assert.match(await warn.innerText(), /브라우저 데이터를 지우면 함께 사라져요/);
      await page.locator('#diary-text').blur(); // the phone tab bar hides while typing (mobile-input.cjs)
      await page.waitForTimeout(300);

      // First-run catalog: no foil hint over locked slots.
      await reveal(page, 'catalog');
      assert.equal(await page.title(), '도감 · 오늘의 모먼트');
      assert.equal(await page.locator('.catalog-head .card-effect-hint').count(), 0);
      await reveal(page, 'review-month');
      assert.equal(await page.locator('.stats-head .card-effect-hint').count(), 0, 'empty month: no hint');

      // Profile → demo switch far down the page → the records list → a card page that opens at the top.
      await reveal(page, 'settings');
      assert.equal(await page.title(), '프로필 · 오늘의 모먼트');
      await reveal(page, 'preview');
      assert.equal(await page.evaluate(() => scrollY), 0, 'the records list opens at the top');
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      await page.locator('[data-open=sample-1]').click(); await unseal(page);
      assert.equal(await page.title(), '카드 · 오늘의 모먼트');
      const card = await page.locator('.flip-trigger').boundingBox();
      assert.ok(card.y >= 0 && card.y + card.height <= 667, `card fully on screen (${card.y.toFixed(0)}…${(card.y + card.height).toFixed(0)})`);
      assert.equal(await page.locator('[data-action=card-catalog]').first().innerText(), '도감에서 보기');

      // Catalog with open cards shows the hint; the legend is plain language.
      await reveal(page, 'catalog');
      assert.equal(await page.locator('.catalog-head .card-effect-hint').count(), 1);
      assert.match(await page.locator('.catalog-legend').innerText(), /확신 정도예요.*감정이 얼마나 강했는지와는 달라요/);
      assert.doesNotMatch(await page.locator('.catalog-legend').innerText(), /분류 확률 구간/);

      // Share: positive probability switch; long quotes wrap at spaces and keep the closing quote.
      await page.locator('.slot:not(.is-locked) .mini-card').first().click();
      await page.locator('#card-detail[open] [data-share-record]').click();
      assert.equal(await page.title(), '카드 공유 · 오늘의 모먼트');
      assert.match(await page.locator('label:has([data-share-opt=prob])').innerText(), /분석 확률 표시/);
      assert.equal(await page.locator('[data-share-opt=prob]').isChecked(), false);
      const quote = '오늘은 바람이 많이 불어서 우산이 뒤집혔지만 그래도 웃으면서 집까지 걸어왔다';
      await page.locator('#share-sentence').fill(quote);
      await page.locator('#share-sentence').press('Tab');
      const lines = async format => {
        await page.locator(`[data-share-format=${format}]`).click();
        return page.locator('.share-art-frame svg text').evaluateAll(xs => {
          const t = xs.find(x => x.textContent.includes('“'));
          return t ? [...t.querySelectorAll('tspan')].map(s => s.textContent) : [];
        });
      };
      const typed = Array.from(quote).slice(0, 40).join('');
      for (const format of ['card', 'record', 'mixed']) {
        const got = await lines(format);
        assert.ok(got.length > 0, `${format}: quote drawn`);
        assert.match(got.at(-1), /”$/, `${format}: closing quote kept (${got.join(' / ')})`);
        const joined = got.join(' ');
        if (joined.includes('…')) assert.match(got.at(-1), /…”$/, `${format}: ellipsis before the quote`);
        else assert.equal(joined, `“${typed.trim()}”`, `${format}: wrapped only at spaces`);
      }
      assert.ok((await lines('card')).join('').includes('…'), 'the two-line "카드 중심" format needs the ellipsis');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      await context.close();
    }

    // Wide desktop (zoomed 16:9 stage): the today card keeps its 240–420px design height in stage pixels.
    {
      const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
      await page.goto(URL); await page.waitForFunction(() => DiaryReview.isReady());
      await page.locator('#diary-text').fill('넓은 화면 점검');
      await reveal(page, 'save');
      const m = await page.evaluate(() => {
        const zoom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--stage-zoom')) || 1;
        const stage = document.querySelector('.today-stage');
        const app = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-height'));
        return { zoom, height: stage ? parseFloat(getComputedStyle(stage).height) : null, app, bottom: document.documentElement.scrollHeight - innerHeight };
      });
      assert.ok(m.zoom > 1, 'stage is zoomed at 1920');
      const expected = Math.min(420, Math.max(240, m.app / m.zoom - 480));
      assert.ok(Math.abs(m.height - expected) <= 1, `today stage ${m.height} = clamp(240, ${m.app}/${m.zoom} - 480, 420)`);
      await page.close();
    }
    console.log('PASS: per-screen titles and top scroll, card fully visible on open, zoom-aware today stage, share quote wrap/ellipsis/closing quote, 분석 확률 표시, plain legend, phone storage warning, hints only with cards, 도감에서 보기');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
