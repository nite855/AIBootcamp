// Tap-to-flip card reveal after saving and grade effects on every card surface. Plain Node script.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const {pathToFileURL} = require('node:url');
const {executablePath, reveal, unseal} = require('./browser-runtime.cjs');
const {chromium} = require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(), 'aibootcamp-frontend-review/node_modules/playwright'));

(async () => {
  const browser = await chromium.launch({headless: true, executablePath});
  const evidence = fs.mkdtempSync(path.join(os.tmpdir(), 'moment-card-grade-'));
  try {
    const page = await browser.newPage({viewport: {width: 1366, height: 768}});
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForFunction(() => DiaryReview.isReady());
    const click = action => reveal(page, action);
    const view = () => page.evaluate(() => DiaryReview.getState().view);

    // Empty or over-limit text never leaves the editor or seals a card.
    await reveal(page, 'save', {stay: true});
    assert.equal(await view(), 'write', 'empty save stays on the editor');
    assert.equal(await page.locator('.mystery-card').count(), 0);

    // Save → card page with the "분석 대기" panel: real records are never analyzed yet, so there is no draw.
    await page.locator('#diary-text').fill('카드 등급 검사 PRIVATE_GRADE_TEXT');
    await reveal(page, 'save', {stay: true});
    await page.waitForFunction(() => DiaryReview.getState().sessions.length === 1);
    await page.waitForFunction(() => DiaryReview.getState().view === 'entry');
    const wait = page.locator('.wait-panel');
    await wait.waitFor();
    assert.equal(await page.locator('.mystery-card, .grade-burst, .seal-hint').count(), 0, 'no draw for a pending card');
    assert.match(await wait.innerText(), /기록은 잘 저장됐어요/);
    assert.match(await wait.innerText(), /감정 분석이 끝나면 카드가 열려요/);
    assert.deepEqual(await wait.locator('.wait-steps li').evaluateAll(xs => xs.map(x => x.className)), ['is-done', 'is-current', '']);
    assert.equal(await wait.locator('[aria-current=step]').innerText().then(t => t.trim()), '감정 읽기');
    assert.equal(await page.locator('.card-box').getAttribute('data-reveal'), 'pending');
    assert.equal(await page.locator('.card-info').isVisible(), false);
    assert.equal(await page.locator('.card-info').evaluate(el => el.inert), true);
    assert.equal(await page.locator('.flip-scene').isVisible(), true, 'the locked pending card stays visible');
    const waitBox = await wait.boundingBox(), cardBox = await page.locator('.flip-scene').boundingBox();
    assert.ok(waitBox.y >= cardBox.y + cardBox.height, 'copy sits under the stage (Figma second pass)');
    const stageBox = await page.locator('.card-stage').boundingBox(), stepsBox = await wait.locator('.wait-steps').boundingBox();
    assert.ok(stepsBox.y < stageBox.y + 80 && stepsBox.x < stageBox.x + 80, 'step chips in the stage corner');
    await page.screenshot({path: path.join(evidence, 'wait-1366.png')});
    // A re-render keeps the panel while the writer stays on the page.
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    assert.equal(await page.locator('.wait-panel').count(), 1);
    // The card itself still flips with a grade pulse.
    await page.locator('.flip-trigger').click();
    assert.equal(await page.locator('.card-box.grade-pulse').count(), 1);
    assert.equal(await page.locator('.card-box[data-grade="pending"] .grade-aura').count(), 1);
    // "기록으로 돌아가기" returns to the editor.
    await page.keyboard.press('Escape');
    await page.locator('[data-wait-action=write]').click();
    assert.equal(await view(), 'write');
    assert.equal(await page.locator('.recent-list .recent-tile[data-grade="pending"]').count(), 1);
    // Today's panel shows the saved day's card (pending frame, no sealed "?" reveal there).
    assert.equal(await page.locator('.today-panel .today-card[data-grade="pending"] .art-card').count(), 1);
    assert.ok(!(await page.locator('main').innerText()).includes('오늘의 카드가 도착했어요'));
    await page.locator('.recent-list [data-open]').first().click();
    assert.equal(await page.locator('.mystery-card, .wait-panel').count(), 0, 'no panel when reopening');
    assert.equal(await page.locator('.card-info').isVisible(), true);
    // Saving the same day again (new version) shows the panel once more; "도감 보기" opens the catalog.
    await click('write');
    await page.locator('#diary-text').fill('카드 등급 검사 수정본');
    await reveal(page, 'save', {stay: true});
    await page.locator('.wait-panel').waitFor();
    await page.locator('[data-wait-action=catalog]').click();
    assert.equal(await page.evaluate(() => DiaryReview.getState().archiveTab), 'catalog');

    // Example mode: stage 3 gets rays + flash + 22 particles; stage 1 gets 10 and no flash.
    await click('settings');
    await click('preview');
    await click('catalog');
    assert.ok(await page.locator('.slot[data-grade^="stage-"]').count() > 0, 'unlocked slots carry a grade');
    assert.equal(await page.locator('.slot.is-locked[data-grade]').count(), 0, 'locked slots have no grade');
    assert.equal(await page.locator('.slot[data-grade^="stage-"]:not([data-emotion])').count(), 0, 'unlocked slots carry their emotion');
    assert.ok(await page.locator('.slot[data-emotion]').evaluateAll(l => new Set(l.map(e => getComputedStyle(e).getPropertyValue('--grade').trim())).size) > 1, 'slots glow in different emotion colors');
    await page.locator('[data-catalog-filter="pos_1"]').click();
    await page.locator('.slot[data-stage="3"]').click();
    assert.equal(await page.locator('#card-detail[open] .detail-card[data-grade="stage-3"] .grade-sheen').count(), 1);
    await page.screenshot({path: path.join(evidence, 'detail-stage3.png')});
    await page.locator('#card-detail[open] [data-open]').first().click();
    // The draw runs on its own and always the same way: charge → rise → burst → result. Tapping does nothing.
    await page.locator('.card-box.is-sealed[data-reveal="stage-3"][data-phase="charge"]').waitFor();
    assert.equal(await page.locator('.mystery-card').evaluate(el => el.tagName), 'DIV', 'the sealed card is not a button');
    assert.equal(await page.locator('[data-draw-skip]').count(), 0, 'no skip button');
    assert.match(await page.locator('#seal-hint-title').innerText(), /카드로 만들고 있어요/);
    // The legend names the effect per grade; the color belongs to the emotion.
    assert.match(await page.locator('.seal-legend').getAttribute('aria-label'), /색은 감정, 공개 효과는 등급/);
    assert.match(await page.locator('.draw-caption').innerText(), /^감정 읽는 중 · [0-9]+%$/);
    assert.deepEqual(await page.locator('.seal-legend li').evaluateAll(l => l.map(li => li.dataset.effect)), ['blank', 'stage-1', 'stage-2', 'stage-3']);
    // The preview grows with the grade but stays neutral (no emotion color before the burst).
    assert.equal(await page.locator('.card-box').evaluate(el => getComputedStyle(el).getPropertyValue('--draw-power').trim()), '1');
    assert.equal(await page.locator('.card-box').evaluate(el => getComputedStyle(el).getPropertyValue('--draw-beat').trim()), '.7s');
    await page.locator('.mystery-card').click({force: true});
    assert.equal(await page.locator('.card-box.is-flipping').count(), 0, 'tapping never shortcuts the draw');
    await page.locator('.card-box.is-sealed[data-phase="rise"]').waitFor({timeout: 2500});
    assert.match(await page.locator('#seal-hint-title').innerText(), /곧 열려요/);
    await page.locator('.grade-flash').waitFor({state: 'attached', timeout: 2500});
    assert.equal(await page.locator('.grade-burst .grade-particles i').count(), 28);
    assert.equal(await page.locator('.grade-burst .grade-ring-2').count(), 1, 'holographic second ring');
    assert.notEqual(await page.locator('.grade-flash').evaluate(el => el.style.getPropertyValue('--flash')), '', 'flash tinted with the emotion color');
    await page.waitForTimeout(800);
    await page.screenshot({path: path.join(evidence, 'flip-stage3.png')});
    await page.waitForFunction(() => !document.querySelector('.card-box.is-flipping'), null, {timeout: 5000});
    assert.equal(await page.locator('.card-box[data-grade="stage-3"]').count(), 1);
    // The halo takes the emotion's card color (data-emotion → --card-deep-*).
    const emo = await page.locator('.card-box').evaluate(el => [el.dataset.emotion, getComputedStyle(el).getPropertyValue('--grade').trim(), getComputedStyle(document.documentElement).getPropertyValue('--card-deep-' + el.dataset.emotion.replace('_', '-')).trim()]);
    assert.match(emo[0], /^(pos|neg|neu)_[123]$/);
    assert.equal(emo[1], emo[2], 'halo color = emotion deep color');
    await page.screenshot({path: path.join(evidence, 'revealed-stage3.png')});
    // F9: the halo lives inside .flip-inner and follows the card when it tilts (no flat outline left behind).
    assert.equal(await page.locator('.grade-aura').evaluate(el => el.parentElement.className), 'flip-inner');
    const auraFollows = async () => {
      await page.evaluate(() => { const t = document.querySelector('.tilt-layer'); t.style.setProperty('--tilt-x', '8deg'); t.style.setProperty('--tilt-y', '-9deg'); });
      await page.waitForTimeout(300);
      const [a, f] = await page.evaluate(() => ['.grade-aura', '.flip-front'].map(s => { const r = document.querySelector(s).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, r.width, r.height]; }));
      await page.evaluate(() => { const t = document.querySelector('.tilt-layer'); t.style.setProperty('--tilt-x', '0deg'); t.style.setProperty('--tilt-y', '0deg'); });
      a.forEach((v, i) => assert.ok(Math.abs(v - f[i]) <= (i < 2 ? 3 : 12), `halo follows the tilted card (${a.map(Math.round)} vs ${f.map(Math.round)})`));
    };
    // 2026-11-22: the halo hugs the card (no gap) with the card's own corner radius (SVG rx 96 of 1080),
    // and every outer ring is concentric: radius - inset = card radius.
    const ringsHug = async label => {
      const g = await page.evaluate(() => {
        const px = v => parseFloat(v) || 0;
        const aura = document.querySelector('.grade-aura'), front = document.querySelector('.flip-front');
        const a = aura.getBoundingClientRect(), f = front.getBoundingClientRect();
        const rings = ['::before', '::after'].map(p => getComputedStyle(aura, p)).filter(cs => cs.content !== 'none' && cs.display !== 'none')
          .map(cs => [px(cs.borderTopLeftRadius), -px(cs.top)]);
        return {a: [a.x, a.y, a.width, a.height], f: [f.x, f.y, f.width, f.height], r: px(getComputedStyle(aura).borderTopLeftRadius), fr: px(getComputedStyle(front).borderTopLeftRadius), rings, grade: aura.closest('.card-box').dataset.grade};
      });
      const want = g.f[2] * 96 / 1080;
      g.a.forEach((v, i) => assert.ok(Math.abs(v - g.f[i]) <= 1, `${label}: halo box = card box (${g.a.map(Math.round)} vs ${g.f.map(Math.round)})`));
      assert.ok(Math.abs(g.r - want) <= 1, `${label}: halo radius ${g.r} = card radius ${want.toFixed(1)}`);
      assert.ok(Math.abs(g.fr - want) <= 1, `${label}: card face radius ${g.fr} = SVG radius ${want.toFixed(1)}`);
      for (const [r, inset] of g.rings) assert.ok(Math.abs(r - inset - want) <= 1, `${label}: ${g.grade} ring concentric (r ${r} - inset ${inset} vs ${want.toFixed(1)})`);
    };
    await ringsHug('desktop');

    await click('catalog');
    const stage1 = page.locator('.slot[data-grade="stage-1"]').first();
    await page.locator('[data-catalog-filter="all"]').click().catch(() => {});
    if (await stage1.count()) {
      await stage1.click();
      await page.locator('#card-detail[open] [data-open]').first().click();
      if (await page.locator('.mystery-card').count()) {
        assert.equal(await page.locator('.card-box').getAttribute('data-reveal'), 'stage-1');
        assert.equal(await page.locator('.card-box').evaluate(el => getComputedStyle(el).getPropertyValue('--draw-power').trim()), '.5');
        await page.locator('.card-box.is-flipping').waitFor({timeout: 4000});
        assert.equal(await page.locator('.grade-burst .grade-particles i').count(), 10);
        assert.equal(await page.locator('.grade-flash').count(), 0, 'flash is stage 3 only');
        await page.waitForFunction(() => !document.querySelector('.card-box.is-flipping'), null, {timeout: 5000});
      }
    }

    // Share preview and the new-card popup follow the grade.
    await click('share');
    assert.match(await page.locator('.share-art-frame').getAttribute('data-grade'), /^(stage-[123]|blank)$/);
    await click('share-close');
    await page.evaluate(() => {
      const el = document.createElement('div'); el.id = 'probe'; el.className = 'moment-celebrate'; el.dataset.grade = 'stage-2'; document.body.append(el);
    });
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('probe')).getPropertyValue('--grade').trim()), '#9b74ff', 'grade color stays as the fallback');
    await page.evaluate(() => document.getElementById('probe').remove());
    // Every sub-emotion gets its own glow color, whatever the grade.
    const glows = await page.evaluate(() => ['pos_1', 'pos_2', 'pos_3', 'neg_1', 'neg_2', 'neg_3', 'neu_1', 'neu_2', 'neu_3'].map(type => {
      const el = document.createElement('div'); el.dataset.grade = 'stage-2'; el.dataset.emotion = type; document.body.append(el);
      const c = getComputedStyle(el).getPropertyValue('--grade').trim(); el.remove(); return c;
    }));
    assert.equal(new Set(glows).size, 9, 'nine distinct emotion glows: ' + glows.join(','));
    assert.ok(!glows.includes('#9b74ff'));
    // 2026-11-22: stage 1 and stage 2 must look different at rest — stage 1 a still glow, stage 2 a solid
    // double ring with a running light; blank/pending and sealed cards get no ring.
    const ladder = await page.evaluate(() => {
      const probe = (grade, extra = '') => {
        const box = document.createElement('div'); box.className = 'card-box ' + extra; box.dataset.grade = grade; box.dataset.emotion = 'pos_1';
        const aura = document.createElement('span'); aura.className = 'grade-aura'; box.append(aura); document.body.append(box);
        const b = getComputedStyle(aura, '::before'), a = getComputedStyle(aura, '::after');
        const out = {before: b.content !== 'none' && b.display !== 'none' ? b.borderTopStyle + '/' + b.outlineStyle : 'none', after: a.content !== 'none' ? a.animationName : 'none', anim: getComputedStyle(aura).animationName};
        box.remove(); return out;
      };
      const slot = grade => {
        const s = document.createElement('div'); s.className = 'slot'; s.dataset.grade = grade; s.dataset.emotion = 'pos_1';
        const t = document.createElement('span'); t.className = 'slot-thumb'; s.append(t); document.body.append(s);
        const shadow = getComputedStyle(t).boxShadow; s.remove(); return shadow.split(/,(?![^(]*\))/).length;
      };
      const rim = grade => { const s = document.createElement('div'); s.className = 'slot'; s.dataset.grade = grade; document.body.append(s); const c = getComputedStyle(s, '::before'); const r = c.content !== 'none' ? c.animationName : 'none'; s.remove(); return r; };
      return {s1: probe('stage-1'), s2: probe('stage-2'), blank: probe('blank'), pending: probe('pending'), sealed: probe('stage-2', 'is-sealed'), slot1: slot('stage-1'), slot2: slot('stage-2'), rim2: rim('stage-2'), rim3: rim('stage-3')};
    });
    assert.equal(ladder.s1.before, 'none', 'stage 1: no ring');
    assert.equal(ladder.s1.after, 'none', 'stage 1: no running light');
    assert.equal(ladder.s1.anim, 'none', 'stage 1: still glow');
    assert.equal(ladder.s2.before, 'solid/solid', 'stage 2: solid double ring');
    assert.equal(ladder.s2.after, 'grade-orbit', 'stage 2: light runs around the ring');
    assert.equal(ladder.s2.anim, 'grade-breathe', 'stage 2: breathing glow');
    for (const k of ['blank', 'pending', 'sealed']) assert.equal(ladder[k].before, 'none', `${k}: no stage 2 ring`);
    assert.equal(ladder.blank.after, 'none');
    assert.equal(ladder.pending.after, 'none');
    assert.equal(ladder.rim3, 'grade-holo-spin', 'catalog slot: stage 3 holographic rim');
    assert.equal(ladder.rim2, 'none', 'catalog slot: no holo rim below stage 3');
    assert.ok(ladder.slot2 >= 3 && ladder.slot2 > ladder.slot1, `catalog slot: stage 2 double outline (${ladder.slot1} vs ${ladder.slot2} layers)`);

    // Phone width: sealed card fits without horizontal overflow.
    await page.setViewportSize({width: 390, height: 844});
    await click('archive-records');
    const unseen = await page.evaluate(() => {
      const s = DiaryReview.getState();
      // An analyzed card that has not played its draw yet (pending example cards open without one).
      return [...document.querySelectorAll('.entry-list [data-open]')].filter(b => /^stage-/.test(b.querySelector('[data-grade]')?.dataset.grade || '')).map(b => b.dataset.open).find(id => !s.revealed[`example:${id}`]);
    });
    if (unseen) {
      await page.locator(`.entry-list [data-open="${unseen}"]`).first().click();
      await page.locator('.mystery-card').waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no overflow while sealed (390)');
      const mHint = await page.locator('.seal-hint').boundingBox(), mCard = await page.locator('.flip-scene').boundingBox();
      assert.ok(mHint.y >= mCard.y + mCard.height - 1, 'hint sits below the card on phones');
      assert.ok(!(await page.locator('.seal-hint').innerText()).includes('분석 대기" 카드가 나와요'), 'no real-mode note in example mode');
      await page.screenshot({path: path.join(evidence, 'sealed-390.png')});
      // F9: no "new card" popup over the draw; the burst never widens the page.
      assert.equal(await page.locator('.moment-celebrate').count(), 0, 'no celebration popup while the draw plays');
      await page.locator('.card-box.is-flipping').waitFor({timeout: 4000});
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no overflow during the burst (390)');
      assert.ok(await unseal(page));
      await auraFollows();
      await ringsHug('phone');
      // The status chip sits above the card, not on it.
      const chip = await page.locator('.stage-chip').boundingBox(), card = await page.locator('.flip-scene').boundingBox();
      assert.ok(chip.y + chip.height <= card.y + 1, `stage chip above the card on phones (${chip.y + chip.height} <= ${card.y})`);
    }
    // F9: real save on a phone — the wait chips also stay off the card.
    {
      const fresh = await browser.newPage({viewport: {width: 390, height: 844}});
      await fresh.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
      await fresh.waitForFunction(() => DiaryReview.isReady());
      await fresh.locator('#diary-text').fill('모바일 대기 칩 검사');
      await reveal(fresh, 'save', {stay: true});
      await fresh.locator('.wait-panel').waitFor();
      const steps = await fresh.locator('.wait-steps').boundingBox(), card = await fresh.locator('.flip-scene').boundingBox();
      assert.ok(steps.y + steps.height <= card.y + 1, 'wait chips above the card on phones');
      assert.equal(await fresh.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await fresh.close();
    }
    assert.deepEqual(errors, []);
    console.log('PASS: save opens a sealed card, tap/Enter flip with grade effects, no reseal, grade on catalog/detail/share/badge/rows; evidence: ' + evidence);
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
