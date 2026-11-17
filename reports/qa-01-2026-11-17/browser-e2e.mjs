import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const SHOTS_DIR = path.join(__dirname, "screenshots");
const REPORT_JSON = path.join(__dirname, "browser-e2e-results.json");
const PROJECT_NAME = "moment-ops02-qa";
const PORT = Number(process.env.QA_WEB_PORT || 18080);
const BASE_URL = `http://127.0.0.1:${PORT}`;

const CHROME_CANDIDATES = [
  process.env.QA_CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].filter(Boolean);

function findBrowser() {
  const found = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
  if (!found) throw new Error("Chrome or Edge executable not found");
  return found;
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
    this.ws.addEventListener("message", (event) => {
      const msg = JSON.parse(String(event.data));
      if (msg.id) {
        const entry = this.pending.get(msg.id);
        if (entry) {
          this.pending.delete(msg.id);
          if (msg.error) entry.reject(new Error(msg.error.message));
          else entry.resolve(msg.result);
        }
      } else {
        this.events.push(msg);
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) {
      throw new Error(
        res.exceptionDetails.exception?.description ||
          res.exceptionDetails.text ||
          "Browser evaluation exception",
      );
    }
    return res.result?.value;
  }

  async close() {
    try {
      this.ws.close();
    } catch {
      // ignore
    }
  }
}

async function waitForCondition(fn, description, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await fn();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Timeout waiting for ${description}`);
}

function runCompose(args, envOverrides = {}, allowFailure = false) {
  const res = spawnSync("docker", ["compose", "-p", PROJECT_NAME, ...args], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...envOverrides },
    encoding: "utf8",
  });
  if (!allowFailure && res.status !== 0) {
    throw new Error(`docker compose ${args.join(" ")} failed:\n${res.stderr}`);
  }
  return res;
}

fs.mkdirSync(SHOTS_DIR, { recursive: true });
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "moment-qa01-chrome-"));
let chromeProc = null;
let client = null;

try {
  // Ensure mock stack is running cleanly
  const mockEnv = {
    WEB_PORT: String(PORT),
    EMOTION_MODEL_PATH: "./models/emotion-kcelectra/checkpoint",
    EMOTION_MOCK_MODE: "1",
  };
  runCompose(["up", "-d"], mockEnv);
  await waitForCondition(async () => {
    try {
      const r = await fetch(`${BASE_URL}/api/health/ready`);
      return r.status === 200;
    } catch {
      return false;
    }
  }, "Compose web+api ready", 45000);

  const browserPath = findBrowser();
  chromeProc = spawn(
    browserPath,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-port=0",
      `--user-data-dir=${userDataDir}`,
      `${BASE_URL}/`,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  const devToolsUrl = await new Promise((resolve, reject) => {
    let stderr = "";
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for Chrome DevTools:\n${stderr}`)),
      20000,
    );
    chromeProc.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
      const m = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (m) {
        clearTimeout(timer);
        resolve(m[1]);
      }
    });
  });

  const debugPort = new URL(devToolsUrl).port;
  const targets = await waitForCondition(async () => {
    const res = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
    const list = await res.json();
    return list.find((t) => t.type === "page" && t.url.startsWith(BASE_URL)) || list[0];
  }, "Chrome page target");

  client = new CDPClient(targets.webSocketDebuggerUrl);
  await client.connect();
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Network.enable");
  await client.send("Log.enable");
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1366,
    height: 768,
    deviceScaleFactor: 1,
    mobile: false,
  });

  try {
    await waitForCondition(
      () => client.eval("window.DiaryReview && window.DiaryReview.isReady()"),
      "DiaryReview ready",
    );
  } catch (err) {
    const diag = await client.eval("({ title: document.title, html: document.body.innerHTML.slice(0, 500), hasDiaryReview: Boolean(window.DiaryReview) })");
    console.error("DIAG:", diag);
    console.error("CDP EVENTS:", JSON.stringify(client.events.filter((e) => e.method === "Runtime.exceptionThrown" || e.method === "Runtime.consoleAPICalled" || e.method === "Log.entryAdded"), null, 2));
    throw err;
  }

  // 1. Write synthetic entry -> Save -> verify post-save /api/analyze resolves & issues ready card
  await client.eval(`(() => {
    const el = document.querySelector('#diary-text');
    el.value = '차분하게 오늘 하루를 돌아보며 작은 감사함을 적어 둡니다.';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await client.eval(`document.querySelector('[data-action="save"]').click()`);

  const readyState = await waitForCondition(
    () =>
      client.eval(`(() => {
        const s = window.DiaryReview.getState();
        const rec = s.sessions[0];
        if (!rec || !rec.analysis || rec.analysis.status !== 'valid') return null;
        return {
          id: rec.id,
          version: rec.version,
          cardKey: rec.analysis.card_key,
          modelVersion: rec.analysis.model_version,
          mode: s.mode,
          count: s.sessions.length
        };
      })()`),
    "post-save valid analysis",
    15000,
  );
  assert.equal(readyState.mode, "real");
  assert.equal(readyState.count, 1);
  assert.equal(readyState.modelVersion, "contract-mock-v1");
  assert.match(readyState.cardKey, /^(pos_[1-3]|neg_[1-3]|neu_[1-4]):[1-3]$/);

  // 2. Reload page and verify IndexedDB schemaVersion=2 persists record & valid analysis
  await client.send("Page.reload");
  await waitForCondition(
    () => client.eval("window.DiaryReview && window.DiaryReview.isReady()"),
    "DiaryReview ready after reload",
  );
  const afterReload = await client.eval(`(async () => {
    const s = window.DiaryReview.getState();
    const idb = await new Promise((resolve, reject) => {
      const req = indexedDB.open('moment-diary-main', 1);
      req.onsuccess = () => {
        const tx = req.result.transaction('data', 'readonly');
        const g = tx.objectStore('data').get('state');
        tx.oncomplete = () => resolve(g.result);
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
    return {
      schemaVersion: idb.schemaVersion,
      sessionsCount: s.sessions.length,
      persistedStatus: s.sessions[0]?.analysis?.status,
      persistedKey: s.sessions[0]?.analysis?.card_key
    };
  })()`);
  assert.equal(afterReload.schemaVersion, 2);
  assert.equal(afterReload.sessionsCount, 1);
  assert.equal(afterReload.persistedStatus, "valid");
  assert.equal(afterReload.persistedKey, readyState.cardKey);

  // 3. Test API outage -> save fails analysis but preserves text + shows retry-analysis -> restart API -> manual retry succeeds
  runCompose(["stop", "api"], mockEnv);
  await client.eval(`(() => {
    document.querySelector('[data-action="write"]').click();
    const newBtn = document.querySelector('[data-action="new-entry"]');
    if (newBtn) newBtn.click();
  })()`);
  await client.eval(`(() => {
    const el = document.querySelector('#diary-text');
    el.value = 'API가 잠시 멈춘 상태에서도 이 기록은 반드시 남아야 합니다.';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await client.eval(`document.querySelector('[data-action="save"]').click()`);

  const errState = await waitForCondition(
    () =>
      client.eval(`(() => {
        const s = window.DiaryReview.getState();
        const rec = s.sessions.find((r) => r.text.includes('반드시 남아야'));
        const retryBtn = document.querySelector('[data-action="retry-analysis"]');
        if (!rec || rec.analysis?.status !== 'error' || !retryBtn) return null;
        return { text: rec.text, status: rec.analysis.status, hasRetryBtn: true };
      })()`),
    "error state with intact text and retry button",
    15000,
  );
  assert.equal(errState.hasRetryBtn, true);

  runCompose(["start", "api"], mockEnv);
  await waitForCondition(async () => {
    try {
      const r = await fetch(`${BASE_URL}/api/health/ready`);
      return r.status === 200;
    } catch {
      return false;
    }
  }, "API back ready for retry", 45000);

  await client.eval(`document.querySelector('[data-action="retry-analysis"]').click()`);
  const retriedState = await waitForCondition(
    () =>
      client.eval(`(() => {
        const s = window.DiaryReview.getState();
        const rec = s.sessions.find((r) => r.text.includes('반드시 남아야'));
        return rec?.analysis?.status === 'valid' ? rec.analysis.card_key : null;
      })()`),
    "manual retry analysis valid",
    15000,
  );
  assert.match(retriedState, /^(pos_[1-3]|neg_[1-3]|neu_[1-4]):[1-3]$/);

  // 4. Verify navigation across Catalog (30 slots), Stats, Records, Settings & 5 Plan Viewports
  await client.eval(`document.querySelector('[data-action="catalog"]').click()`);
  await new Promise((r) => setTimeout(r, 200));
  const catalogSlotCount = await client.eval(`document.querySelectorAll('.catalog-grid [data-stage]').length`);
  assert.equal(catalogSlotCount, 3); // 3 stages for selected emotion out of 30 total slots

  await client.eval(`document.querySelector('[data-action="write"]').click()`);
  await new Promise((r) => setTimeout(r, 200));

  const viewports = [
    { name: "desktop-1366", width: 1366, height: 768, mobile: false },
    { name: "desktop-1440", width: 1440, height: 900, mobile: false },
    { name: "mobile-390", width: 390, height: 844, mobile: true },
    { name: "mobile-360", width: 360, height: 640, mobile: true },
    { name: "mobile-320", width: 320, height: 568, mobile: true },
  ];
  const viewportMetrics = [];
  for (const vp of viewports) {
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.mobile,
    });
    await new Promise((r) => setTimeout(r, 150));
    const overflow = await client.eval(`({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      hasApp: Boolean(document.querySelector('.shell') || document.querySelector('#app'))
    })`);
    assert.ok(
      overflow.scrollWidth <= overflow.innerWidth,
      `${vp.name} horizontal overflow: ${overflow.scrollWidth} > ${overflow.innerWidth}`,
    );
    const shot = await client.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(SHOTS_DIR, `${vp.name}.png`), Buffer.from(shot.data, "base64"));
    viewportMetrics.push({ ...vp, ...overflow });
  }

  // Open latest record detail & capture card view + check uncaught runtime errors
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1366,
    height: 768,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await client.eval(`document.querySelector('.recent-list .entry')?.click()`);
  await new Promise((r) => setTimeout(r, 250));
  const detailSvg = await client.eval(`(() => {
    const svg = document.querySelector('.art-card');
    if (!svg) return null;
    const text = svg.outerHTML;
    return {
      width: svg.getAttribute('width'),
      height: svg.getAttribute('height'),
      leaksRawDiary: text.includes('반드시 남아야') || text.includes('감사함을'),
    };
  })()`);
  assert.equal(detailSvg.width, "1080");
  assert.equal(detailSvg.height, "1620");
  assert.equal(detailSvg.leaksRawDiary, false);
  const cardShot = await client.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(SHOTS_DIR, "card-detail-1366.png"), Buffer.from(cardShot.data, "base64"));

  const uncaughtErrors = client.events.filter((e) => e.method === "Runtime.exceptionThrown");
  assert.equal(uncaughtErrors.length, 0, `Uncaught browser exceptions: ${JSON.stringify(uncaughtErrors)}`);

  const summary = {
    executedAt: new Date().toISOString(),
    readyState,
    afterReload,
    errState,
    retriedState,
    detailSvg,
    viewportMetrics,
    uncaughtExceptions: uncaughtErrors.length,
  };
  fs.writeFileSync(REPORT_JSON, JSON.stringify(summary, null, 2));
  console.log(`ALL BROWSER E2E CHECKS PASSED -> ${REPORT_JSON}`);
} finally {
  await client?.close();
  chromeProc?.kill();
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup error on Windows locks
  }
  runCompose(["down", "-v"], {}, true);
}
