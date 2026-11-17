import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const PROJECT_NAME = "moment-ops02-qa";
const PORT = Number(process.env.QA_WEB_PORT || 18080);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const REPORT_JSON = path.join(__dirname, "ops02-results.json");

function runCompose(args, envOverrides = {}, allowFailure = false) {
  const res = spawnSync("docker", ["compose", "-p", PROJECT_NAME, ...args], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...envOverrides },
    encoding: "utf8",
  });
  if (!allowFailure && res.status !== 0) {
    throw new Error(
      `docker compose ${args.join(" ")} failed (${res.status}):\n${res.stdout}\n${res.stderr}`,
    );
  }
  return res;
}

async function waitForHttp(url, expectedStatuses, timeoutMs = 45000) {
  const start = Date.now();
  let lastError = null;
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (expectedStatuses.includes(response.status)) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status} from ${url}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timeout waiting for ${url}: ${lastError?.message || "unknown"}`);
}

async function waitForHealthState(service, desired, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const id = execFileSync(
      "docker",
      ["compose", "-p", PROJECT_NAME, "ps", "-q", service],
      { cwd: REPO_ROOT, encoding: "utf8" },
    ).trim();
    if (id) {
      const status = execFileSync(
        "docker",
        ["inspect", "--format", "{{.State.Health.Status}}", id],
        { encoding: "utf8" },
      ).trim();
      if (status === desired) return status;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Timeout waiting for ${service} healthcheck -> ${desired}`);
}

const results = {
  executedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  checks: [],
};

function recordCheck(name, details) {
  results.checks.push({ name, passed: true, details });
  console.log(`PASS: ${name}`);
}

try {
  // Clean any prior test project first
  runCompose(["down", "-v"], {}, true);

  // 1. Check behavior when host model directory is missing:
  // Docker Compose sets create_host_path: false, though Docker Desktop on Windows may still auto-create
  // an empty bind directory. Verify whether Compose blocks it or api still fails closed (503 not_ready).
  const missingRel = "./models/nonexistent-ops02-check";
  const missingAbs = path.join(REPO_ROOT, missingRel);
  if (fs.existsSync(missingAbs)) {
    fs.rmSync(missingAbs, { recursive: true, force: true });
  }
  const missingRes = runCompose(
    ["up", "-d", "web", "api"],
    {
      WEB_PORT: String(PORT),
      EMOTION_MODEL_PATH: missingRel,
      EMOTION_MOCK_MODE: "0",
    },
    true,
  );
  const hostPathCreated = fs.existsSync(missingAbs);
  let emptyMountReadyStatus = null;
  if (missingRes.status === 0) {
    const r = await waitForHttp(`${BASE_URL}/api/health/ready`, [503], 30000);
    emptyMountReadyStatus = r.status;
  }
  runCompose(["down", "-v"], {}, true);
  if (fs.existsSync(missingAbs)) {
    fs.rmSync(missingAbs, { recursive: true, force: true });
  }
  if (missingRes.status === 0) {
    assert.equal(emptyMountReadyStatus, 503, "Empty model dir must stay 503 not_ready");
  }
  recordCheck("missing_model_host_path_behavior", {
    composeExitCode: missingRes.status,
    dockerDesktopAutoCreatedEmptyDir: hostPathCreated,
    emptyMountReadyStatus,
    failClosedProtected: missingRes.status !== 0 || emptyMountReadyStatus === 503,
  });

  // 2. Start stack with legacy 6-label model mounted read-only & mock disabled
  const prodEnv = {
    WEB_PORT: String(PORT),
    EMOTION_MODEL_PATH: "./models/emotion-kcelectra/checkpoint",
    EMOTION_MOCK_MODE: "0",
  };
  runCompose(["up", "-d"], prodEnv);

  const rootRes = await waitForHttp(`${BASE_URL}/`, [200]);
  const rootHtml = await rootRes.text();
  assert.ok(rootHtml.includes('<div id="app">'), "SPA root HTML must serve even while api not ready");
  assert.match(rootRes.headers.get("cache-control") || "", /no-cache/);

  const manifestRes = await waitForHttp(`${BASE_URL}/assets/cards/manifest.json`, [200]);
  const manifestJson = await manifestRes.json();
  assert.equal(manifestJson.cards.length, 30);
  assert.match(manifestRes.headers.get("cache-control") || "", /no-cache/);

  const missingAssetRes = await fetch(`${BASE_URL}/assets/nonexistent-check-404.png`);
  assert.equal(missingAssetRes.status, 404, "Missing /assets/ file must return 404, not SPA HTML");

  // Confirm port 8000 is not directly published to host
  let directApiReachable = true;
  try {
    await fetch("http://127.0.0.1:8000/api/health/live", {
      signal: AbortSignal.timeout(1000),
    });
  } catch {
    directApiReachable = false;
  }
  assert.equal(directApiReachable, false, "api port 8000 must remain internal to Compose network");

  const liveRes = await waitForHttp(`${BASE_URL}/api/health/live`, [200]);
  assert.deepEqual(await liveRes.json(), { status: "live" });

  const notReadyRes = await waitForHttp(`${BASE_URL}/api/health/ready`, [503]);
  const notReadyBody = await notReadyRes.json();
  assert.equal(notReadyBody.status, "not_ready");
  assert.equal(notReadyBody.model_loaded, false);
  assert.match(notReadyBody.detail || "", /10감정 모델이 아닙니다|6개/);

  const analyzeNotReadyRes = await fetch(`${BASE_URL}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      record_id: "ops-1",
      version: 1,
      request_id: "req-ops-1",
      text: "오늘 기록은 잘 남아야 해요.",
    }),
  });
  assert.equal(analyzeNotReadyRes.status, 503);
  const analyzeNotReadyJson = await analyzeNotReadyRes.json();
  assert.equal(analyzeNotReadyJson.code, "MODEL_NOT_READY");

  // Verify read-only model mount & no host source / .env baked into api container
  const roProbe = runCompose(
    [
      "exec",
      "-T",
      "api",
      "python",
      "-c",
      "from pathlib import Path; import os; " +
        "ro = False\n" +
        "try:\n  Path('/models/checkpoint/.write_probe').write_text('x')\n" +
        "except OSError:\n  ro = True\n" +
        "assert ro, 'checkpoint mount must be read-only'; " +
        "assert not Path('/app/src').exists(); " +
        "assert not Path('/app/static').exists(); " +
        "assert not Path('/app/.env').exists(); " +
        "print('ISOLATION_OK')",
    ],
    prodEnv,
  );
  assert.match(roProbe.stdout, /ISOLATION_OK/);

  const apiUnhealthyStatus = await waitForHealthState("api", "unhealthy", 60000);
  recordCheck("invalid_model_not_ready_and_isolation", {
    notReadyDetail: notReadyBody.detail,
    analyze503Code: analyzeNotReadyJson.code,
    apiHealthStatus: apiUnhealthyStatus,
    missingAssetStatus: missingAssetRes.status,
    directPort8000Published: directApiReachable,
  });

  // 3. Switch to EMOTION_MOCK_MODE=1 to verify ready healthcheck, Nginx proxy & validation errors
  const mockEnv = {
    WEB_PORT: String(PORT),
    EMOTION_MODEL_PATH: "./models/emotion-kcelectra/checkpoint",
    EMOTION_MOCK_MODE: "1",
  };
  runCompose(["up", "-d", "--force-recreate", "api"], mockEnv);

  const readyRes = await waitForHttp(`${BASE_URL}/api/health/ready`, [200], 45000);
  const readyJson = await readyRes.json();
  assert.equal(readyJson.status, "ready");
  assert.equal(readyJson.model_loaded, true);
  assert.equal(readyJson.model_version, "contract-mock-v1");

  const apiHealthy = await waitForHealthState("api", "healthy", 60000);
  const webHealthy = await waitForHealthState("web", "healthy", 60000);

  const validRes = await fetch(`${BASE_URL}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      record_id: "ops-2",
      version: 1,
      request_id: "req-ops-2",
      text: "맑은 바람이 불던 산책길이었다.",
    }),
  });
  assert.equal(validRes.status, 200);
  const validJson = await validRes.json();
  assert.equal(validJson.status, "valid");
  assert.equal(validJson.card_policy_version, "card-stage-strict-gt-v1");
  assert.equal(Object.keys(validJson.probabilities).length, 10);

  const emptyRes = await fetch(`${BASE_URL}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      record_id: "ops-3",
      version: 1,
      request_id: "req-ops-3",
      text: "   \n  ",
    }),
  });
  assert.equal(emptyRes.status, 422);

  const overLimitRes = await fetch(`${BASE_URL}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      record_id: "ops-4",
      version: 1,
      request_id: "req-ops-4",
      text: "가".repeat(10001),
    }),
  });
  assert.equal(overLimitRes.status, 422);

  const exactLimitRes = await fetch(`${BASE_URL}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      record_id: "ops-5",
      version: 1,
      request_id: "req-ops-5",
      text: "가".repeat(10000),
    }),
  });
  assert.equal(exactLimitRes.status, 200);

  recordCheck("mock_mode_ready_proxy_and_422_limits", {
    readyJson,
    apiHealthy,
    webHealthy,
    validCardKey: validJson.card_key,
    emptyStatus: emptyRes.status,
    overLimitStatus: overLimitRes.status,
    exactLimitStatus: exactLimitRes.status,
  });

  // 4. Restart recovery & API down resilience (web must remain available, nginx recovers DNS)
  runCompose(["restart", "api"], mockEnv);
  await waitForHttp(`${BASE_URL}/api/health/ready`, [200], 45000);
  const afterRestartRes = await fetch(`${BASE_URL}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      record_id: "ops-restart",
      version: 1,
      request_id: "req-restart",
      text: "재시작 이후에도 분석 연결이 회복돼요.",
    }),
  });
  assert.equal(afterRestartRes.status, 200);

  runCompose(["stop", "api"], mockEnv);
  const webWhileApiDown = await fetch(`${BASE_URL}/`);
  assert.equal(webWhileApiDown.status, 200, "Web writing screen must stay up when API stops");
  const apiWhileDown = await fetch(`${BASE_URL}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      record_id: "ops-down",
      version: 1,
      request_id: "req-down",
      text: "API가 꺼졌을 때 오류 확인",
    }),
  });
  assert.ok([502, 503, 504].includes(apiWhileDown.status), `Expected 502/503/504, got ${apiWhileDown.status}`);

  recordCheck("api_restart_recovery_and_outage_isolation", {
    postRestartStatus: afterRestartRes.status,
    webStatusWhenApiStopped: webWhileApiDown.status,
    apiStatusWhenApiStopped: apiWhileDown.status,
  });

  fs.writeFileSync(REPORT_JSON, JSON.stringify(results, null, 2));
  console.log(`ALL OPS-02 CHECKS PASSED -> ${REPORT_JSON}`);
} finally {
  if (!process.env.KEEP_OPS02_STACK) {
    runCompose(["down", "-v"], {}, true);
  }
}
