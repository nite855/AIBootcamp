// Silent browser demonstrations; phone profiles reproduce layout, not native OS UI.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { chromium } = require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(), 'aibootcamp-frontend-review/node_modules/playwright'));
const { executablePath, dismissCelebration, unseal, settleStats } = require('../tests/browser-runtime.cjs');
const root = path.resolve(__dirname, '../..');
const arg = name => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
const rehearsal = process.argv.includes('--rehearsal');
const duration = rehearsal ? 45 : 300;
const profiles = {
  desktop: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  galaxy: { viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  iphone: { viewport: { width: 402, height: 874 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const names = { desktop: 'desktop', galaxy: 'galaxy-s24', iphone: 'iphone-17-pro' };
const text = '오늘 팀 프로젝트 발표 준비를 마쳤다. 처음에는 긴장했지만 팀원들과 함께 정리하니 마음이 한결 가벼워졌다. 서로 부족한 부분을 채워 준 덕분에 뿌듯했고, 도와준 팀원들에게 고마웠다.';
const ffmpeg = process.env.CARDEX_FFMPEG || (() => {
  const dir = path.join(os.tmpdir(), 'moment-video-tools/imageio_ffmpeg/binaries');
  return fs.existsSync(dir) ? path.join(dir, fs.readdirSync(dir).find(f => /^ffmpeg.*\.exe$/.test(f)) || 'missing') : '';
})();
const out = path.resolve(arg('--out') || path.join(root, 'artifacts/demo-videos', new Date().toISOString().replace(/[:.]/g, '-')));
const selected = arg('--device') || 'all';
if (selected !== 'all' && !profiles[selected]) throw Error('Use --device all|desktop|galaxy|iphone');
if (!fs.existsSync(ffmpeg)) throw Error('Set CARDEX_FFMPEG to a full FFmpeg executable with libx264.');
if (fs.existsSync(out)) throw Error('Output already exists; choose a new --out directory.');
fs.mkdirSync(out, { recursive: true });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function command(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, args, { windowsHide: true });
    let stderr = '';
    child.stderr.on('data', b => { stderr = (stderr + b).slice(-6000); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(stderr) : reject(Error(stderr)));
  });
}
async function record(browser, device) {
  const dir = path.join(out, names[device]);
  fs.mkdirSync(dir, { recursive: true });
  const errors = [], evidence = [], downloads = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    const file = url.pathname === '/' ? path.join(root, 'frontend/index.html')
      : url.pathname.startsWith('/media/') ? path.join(dir, path.basename(url.pathname)) : null;
    if (!file || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', file.endsWith('.png') ? 'image/png' : 'text/html; charset=utf-8');
    fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const p = profiles[device];
  let context, page;
  try {
    context = await browser.newContext({ ...p, locale: 'ko-KR', timezoneId: 'Asia/Seoul', acceptDownloads: true,
      recordVideo: { dir, size: { width: p.viewport.width * p.deviceScaleFactor, height: p.viewport.height * p.deviceScaleFactor } } });
    page = await context.newPage();
  } catch (error) {
    await context?.close(); await new Promise(resolve => server.close(resolve)); throw error;
  }
  page.setDefaultTimeout(15000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const started = Date.now();
  const at = async seconds => pause(Math.max(0, started + seconds * duration / 300 * 1000 - Date.now()));
  const click = async action => {
    const el = page.locator(`[data-action="${action}"]:visible`).first();
    await el.scrollIntoViewIfNeeded(); await el.click();
    await pause(rehearsal ? 150 : 700);
  };
  const shot = async name => {
    await pause(250);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    assert.equal(overflow, false, `${device}/${name}: horizontal overflow`);
    const file = path.join(dir, `${name}.png`);
    await page.screenshot({ path: file }); evidence.push(file);
    console.log(JSON.stringify({ device, scene: name, elapsed: Math.round((Date.now() - started) / 1000) }));
  };
  async function exampleMode() {
    await click('settings');
    await click('preview');
    await dismissCelebration(page);
  }
  async function download(action, expected) {
    const event = page.waitForEvent('download'); await click(action);
    const d = await event, file = path.join(dir, d.suggestedFilename());
    await d.saveAs(file);
    const b = fs.readFileSync(file);
    assert.equal(b.subarray(1, 4).toString(), 'PNG');
    assert.deepEqual([b.readUInt32BE(16), b.readUInt32BE(20)], expected);
    downloads.push(file); return file;
  }
  try {
    await page.goto(url);
    await page.waitForFunction(() => window.DiaryReview?.isReady());
    await page.evaluate(() => CardexTheme.setTheme('clean'));
    await at(8);
    await page.locator('#diary-text').pressSequentially(text, { delay: rehearsal ? 1 : 125 });
    await page.locator('header .brand').focus();
    await shot('01-record');
    await at(42); await click('save');
    await page.locator('.wait-panel').waitFor();
    assert.equal(await page.evaluate(() => DiaryReview.getState().sessions.length), 1);
    await shot('02-saved-pending');
    await at(67); await page.locator('[data-wait-action="write"]').click();
    await at(75); await exampleMode();
    await shot('03-examples');
    await at(95);
    await page.locator('.entry-list [data-open="sample-1"]').click();
    await unseal(page);
    await shot('04-card');
    await at(127); await click('card-catalog');
    await page.locator('#card-detail[open]').waitFor();
    await shot('05-catalog');
    await at(150); await page.locator('#card-detail[open] [data-share-record]').click();
    await page.locator('#share-title').waitFor();
    await shot('06-share');
    await at(160); await page.locator('[data-share-opt="quote"]').click();
    await at(167); await page.locator('[data-share-opt="quote"]').click();
    await at(175); await download('share-download', [1080, 1350]);
    await at(187); const story = await download('share-story', [1080, 1920]);
    await shot('07-story-export');
    await at(198); await page.goto(`${url}media/${encodeURIComponent(path.basename(downloads[0]))}`);
    await shot('08-shared-png');
    await at(209); await page.goto(`${url}media/${encodeURIComponent(path.basename(story))}`);
    await shot('09-story-png');
    await at(219); await page.goto(url); await page.waitForFunction(() => window.DiaryReview?.isReady());
    await exampleMode();
    await at(225); await click('review-month'); await settleStats(page);
    await shot('10-statistics');
    for (const [second, selector, name] of [[240, '.stats-trend', '11-trend'], [255, '.stats-dist', '12-distribution'], [270, '.stats-calendar', '13-calendar']]) {
      await at(second); await page.locator(selector).scrollIntoViewIfNeeded(); await shot(name);
    }
    await at(285); await click('write');
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'smooth' }));
    await shot('14-return');
    await at(300);
    assert.deepEqual(errors, [], 'browser errors');
    await context.close();
    const raw = await page.video().path();
    const target = path.join(out, `${names[device]}.mp4`);
    await command(['-y', '-i', raw, '-an', '-vf', 'tpad=stop_mode=clone:stop_duration=300,fps=25,format=yuv420p', '-t', String(duration), '-c:v', 'libx264', '-preset', 'fast', '-crf', '19', '-movflags', '+faststart', target]);
    const metadata = await command(['-hide_banner', '-nostats', '-i', target, '-f', 'null', '-']);
    const time = metadata.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
    assert.ok(time, 'MP4 duration metadata');
    const actualDuration = +time[1] * 3600 + +time[2] * 60 + +time[3];
    assert.ok(Math.abs(actualDuration - duration) <= 1, 'duration within one second');
    assert.match(metadata, /Video: h264/);
    assert.match(metadata, /yuv420p/);
    assert.ok(!/Audio:/.test(metadata), 'silent video');
    const result = { device, profile: p, duration, actualDuration, video: target, bytes: fs.statSync(target).size, evidence, downloads, errors, emulated: device !== 'desktop' };
    fs.writeFileSync(path.join(dir, 'verification.json'), JSON.stringify(result, null, 2));
    return result;
  } finally { await context.close(); await new Promise(resolve => server.close(resolve)); }
}
(async () => {
  // Use the application's real download fallback; headless native OS sheets are not recorded.
  const browser = await chromium.launch({ headless: true, executablePath, args: ['--disable-features=WebShare'] });
  const results = [];
  try {
    for (const device of selected === 'all' ? Object.keys(profiles) : [selected]) results.push(await record(browser, device));
    fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ rehearsal, duration, results }, null, 2));
    console.log(JSON.stringify({ output: out, videos: results.map(r => r.video) }));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
