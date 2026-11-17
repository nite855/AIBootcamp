const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");

async function loadModules() {
  const snapshotMod = await import(
    pathToFileURL(path.join(ROOT, "src/services/snapshotStorage.mjs")).href
  );
  const clientMod = await import(
    pathToFileURL(path.join(ROOT, "src/services/analysisClient.mjs")).href
  );
  const coordinatorMod = await import(
    pathToFileURL(path.join(ROOT, "src/services/analysisCoordinator.mjs")).href
  );
  const policyMod = await import(
    pathToFileURL(path.join(ROOT, "src/domain/cardPolicy.mjs")).href
  );
  return { snapshotMod, clientMod, coordinatorMod, policyMod };
}

function createFakeIndexedDB(initialState = undefined) {
  const backing = new Map();
  if (initialState !== undefined) {
    backing.set("state", structuredClone(initialState));
  }

  function open() {
    const req = {};
    queueMicrotask(() => {
      const db = {
        close() {},
        transaction(_storeName, _mode) {
          const tx = { error: null, oncomplete: null, onabort: null, onerror: null };
          const pendingWrites = [];
          let aborted = false;

          tx.abort = () => {
            aborted = true;
            queueMicrotask(() => tx.onabort && tx.onabort());
          };

          const objectStore = () => ({
            get(key) {
              const getReq = { result: undefined, onsuccess: null };
              queueMicrotask(() => {
                const raw = backing.get(key);
                getReq.result = raw === undefined ? undefined : structuredClone(raw);
                if (getReq.onsuccess) getReq.onsuccess();
                if (!aborted) {
                  queueMicrotask(() => {
                    if (aborted) return;
                    for (const [k, v] of pendingWrites) {
                      backing.set(k, structuredClone(v));
                    }
                    if (tx.oncomplete) tx.oncomplete();
                  });
                }
              });
              return getReq;
            },
            put(value, key) {
              pendingWrites.push([key, value]);
            },
          });

          tx.objectStore = objectStore;
          return tx;
        },
      };
      req.result = db;
      if (backing.size === 0 && req.onupgradeneeded) {
        req.onupgradeneeded({ target: req });
      }
      if (req.onsuccess) req.onsuccess();
    });
    return req;
  }

  return {
    backing,
    indexedDB: { open },
  };
}

function makeProbMap(policyMod, overrides = {}) {
  const keys = [...policyMod.EMOTION_IDS];
  const base = Object.fromEntries(keys.map((k) => [k, 0]));
  const assignedSum = Object.entries(overrides).reduce((acc, [k, v]) => {
    base[k] = v;
    return acc + v;
  }, 0);
  const restKeys = keys.filter((k) => !(k in overrides));
  const each = Number(((1 - assignedSum) / restKeys.length).toFixed(6));
  for (const k of restKeys) base[k] = each;
  const drift = Number((1 - Object.values(base).reduce((a, b) => a + b, 0)).toFixed(6));
  base[restKeys[0]] = Number((base[restKeys[0]] + drift).toFixed(6));
  return base;
}

function makeAnalyzeResponse(policyMod, { recordId, version, requestId, overrides }) {
  const probabilities = makeProbMap(policyMod, overrides);
  const card = policyMod.evaluateCardProbabilities(probabilities);
  return {
    status: "valid",
    record_id: recordId,
    version,
    request_id: requestId,
    taxonomy_version: policyMod.TAXONOMY_VERSION,
    card_policy_version: card.card_policy_version,
    model_version: "mock-test-v1",
    truncated: false,
    probabilities,
    dominant_emotion: card.dominant_emotion,
    dominant_ratio: card.dominant_ratio,
    ties: card.ties,
    card_stage: card.card_stage,
    card_key: card.card_key,
  };
}

test("snapshotStorage migrates v1 snapshot to v2 preserving record fields and favorites", async () => {
  const { snapshotMod } = await loadModules();
  const legacyV1 = {
    schemaVersion: 1,
    revision: 4,
    text: "임시 초안",
    date: "2026-11-17",
    policy: "single",
    currentEntryId: "rec-1",
    savedText: "기분이 맑은 하루였다.",
    sessions: [
      {
        id: "rec-1",
        favorite: true,
        text: "기분이 맑은 하루였다.",
        recordDate: "2026-11-17",
        version: 2,
        createdAt: "2026-11-17T08:00:00.000Z",
        updatedAt: "2026-11-17T09:00:00.000Z",
      },
    ],
  };

  const fake = createFakeIndexedDB(legacyV1);
  const storage = snapshotMod.createSnapshotStorage(fake.indexedDB);
  const loaded = await storage.load();

  assert.equal(loaded.schemaVersion, 2);
  assert.equal(loaded.migratedFrom, 1);
  assert.equal(loaded.revision, 4);
  assert.equal(loaded.text, "임시 초안");
  assert.equal(loaded.policy, "single");
  assert.equal(loaded.sessions.length, 1);
  assert.equal(loaded.sessions[0].favorite, true);
  assert.equal(loaded.sessions[0].version, 2);
  assert.deepEqual(loaded.sessions[0].analysis, { status: "pending" });
});

test("snapshotStorage preserves valid v2 analysis and degrades incompatible analysis to pending", async () => {
  const { snapshotMod, policyMod } = await loadModules();
  const probabilities = makeProbMap(policyMod, { pos_1: 0.72 });
  const card = policyMod.evaluateCardProbabilities(probabilities);

  const v2 = {
    schemaVersion: 2,
    revision: 7,
    text: "",
    date: "2026-11-17",
    policy: "multi",
    currentEntryId: null,
    savedText: null,
    sessions: [
      {
        id: "rec-valid",
        favorite: true,
        text: "기쁜 소식을 들었다.",
        recordDate: "2026-11-17",
        version: 1,
        createdAt: "2026-11-17T08:00:00.000Z",
        updatedAt: "2026-11-17T08:00:00.000Z",
        analysis: {
          status: "valid",
          version: 1,
          taxonomy_version: policyMod.TAXONOMY_VERSION,
          card_policy_version: card.card_policy_version,
          model_version: "mock-test-v1",
          truncated: false,
          probabilities,
          dominant_emotion: card.dominant_emotion,
          dominant_ratio: card.dominant_ratio,
          ties: card.ties,
          card_stage: card.card_stage,
          card_key: card.card_key,
        },
      },
      {
        id: "rec-stale",
        favorite: false,
        text: "수정된 본문",
        recordDate: "2026-11-17",
        version: 2,
        createdAt: "2026-11-17T08:00:00.000Z",
        updatedAt: "2026-11-17T08:10:00.000Z",
        analysis: {
          status: "valid",
          version: 1,
          taxonomy_version: policyMod.TAXONOMY_VERSION,
          card_policy_version: card.card_policy_version,
          truncated: false,
          probabilities,
          card_stage: card.card_stage,
          card_key: card.card_key,
        },
      },
      {
        id: "rec-truncated",
        favorite: false,
        text: "잘린 분석",
        recordDate: "2026-11-17",
        version: 1,
        createdAt: "2026-11-17T08:00:00.000Z",
        updatedAt: "2026-11-17T08:00:00.000Z",
        analysis: {
          status: "valid",
          version: 1,
          taxonomy_version: policyMod.TAXONOMY_VERSION,
          card_policy_version: card.card_policy_version,
          truncated: true,
          probabilities,
          card_stage: card.card_stage,
          card_key: card.card_key,
        },
      },
    ],
  };

  const fake = createFakeIndexedDB(v2);
  const storage = snapshotMod.createSnapshotStorage(fake.indexedDB);
  const loaded = await storage.load();

  assert.equal(loaded.sessions[0].analysis.status, "valid");
  assert.equal(loaded.sessions[0].analysis.dominant_emotion, "pos_1");
  assert.equal(loaded.sessions[0].analysis.card_stage, 3);

  // Version mismatch or truncated old analysis resets to pending without deleting the record.
  assert.equal(loaded.sessions[1].text, "수정된 본문");
  assert.deepEqual(loaded.sessions[1].analysis, { status: "pending" });
  assert.equal(loaded.sessions[2].text, "잘린 분석");
  assert.deepEqual(loaded.sessions[2].analysis, { status: "pending" });
});

test("snapshotStorage protects against future schemaVersion and multi-tab revision conflict", async () => {
  const { snapshotMod } = await loadModules();
  const future = { schemaVersion: 3, revision: 1, text: "keep me", date: "2026-11-17", sessions: [] };
  const fakeFuture = createFakeIndexedDB(future);
  const sFuture = snapshotMod.createSnapshotStorage(fakeFuture.indexedDB);

  await assert.rejects(() => sFuture.load(), /원본 저장소는 변경하지 않았어요/);
  assert.deepEqual(fakeFuture.backing.get("state"), future);

  const initialV2 = {
    schemaVersion: 2,
    revision: 1,
    text: "tab1",
    date: "2026-11-17",
    policy: "multi",
    currentEntryId: null,
    savedText: null,
    sessions: [],
  };
  const fakeTabs = createFakeIndexedDB(initialV2);
  const tabA = snapshotMod.createSnapshotStorage(fakeTabs.indexedDB);
  const tabB = snapshotMod.createSnapshotStorage(fakeTabs.indexedDB);

  await tabA.load();
  await tabB.load();
  await tabB.save({ ...initialV2, text: "tabB-wins" });

  await assert.rejects(() => tabA.save({ ...initialV2, text: "tabA-stale" }), /다른 탭/);
  assert.equal(fakeTabs.backing.get("state").text, "tabB-wins");
  assert.equal(fakeTabs.backing.get("state").revision, 2);
});

test("analysisClient validates contract fields and request/response identity", async () => {
  const { clientMod, policyMod } = await loadModules();

  const seenBodies = [];
  const okFetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    seenBodies.push(body);
    return {
      ok: true,
      status: 200,
      async json() {
        return makeAnalyzeResponse(policyMod, {
          recordId: body.record_id,
          version: body.version,
          requestId: body.request_id,
          overrides: { pos_2: 0.5 },
        });
      },
    };
  };

  const ok = await clientMod.requestRecordAnalysis({
    recordId: "r-1",
    version: 1,
    requestId: "req-1",
    text: "평온한 산책이었다.",
    fetchImpl: okFetch,
  });

  assert.equal(ok.ok, true);
  assert.equal(seenBodies[0].record_id, "r-1");
  assert.equal(seenBodies[0].version, 1);
  assert.equal(seenBodies[0].request_id, "req-1");
  assert.equal(ok.analysis.status, "valid");
  assert.equal(ok.analysis.dominant_emotion, "pos_2");
  assert.equal(ok.analysis.card_stage, 2);

  const mismatched = clientMod.validateApiResponsePayload(
    makeAnalyzeResponse(policyMod, {
      recordId: "r-1",
      version: 1,
      requestId: "req-wrong",
      overrides: { pos_1: 0.8 },
    }),
    { recordId: "r-1", version: 1, requestId: "req-1" },
  );
  assert.equal(mismatched.ok, false);
  assert.equal(mismatched.errorCode, "STALE_RESPONSE");
});

test("analysisCoordinator blocks stale responses on edit, delete, and superseded retry", async () => {
  const { coordinatorMod, policyMod } = await loadModules();

  // 1) Slow response ignored when record is edited (version++ before resolve)
  let record = {
    id: "rec-1",
    version: 1,
    text: "처음 쓴 글",
    analysis: { status: "pending" },
  };
  let releaseV1;
  const slowFetchV1 = (_url, init) =>
    new Promise((resolve) => {
      const body = JSON.parse(init.body);
      releaseV1 = () =>
        resolve({
          ok: true,
          status: 200,
          async json() {
            return makeAnalyzeResponse(policyMod, {
              recordId: body.record_id,
              version: body.version,
              requestId: body.request_id,
              overrides: { neg_1: 0.8 },
            });
          },
        });
    });

  let seq = 0;
  const coord = coordinatorMod.createAnalysisCoordinator({
    fetchImpl: slowFetchV1,
    requestIdFactory: () => `req-${++seq}`,
  });

  const applied = [];
  const pV1 = coord.runRecordAnalysis({
    record: { ...record },
    getRecordById: () => record,
    onApplyAnalysis: (_r, nextAnalysis) => {
      applied.push(nextAnalysis);
      record.analysis = nextAnalysis;
    },
  });

  // User edits record -> version becomes 2 while v1 request is in flight
  record = { ...record, version: 2, text: "고친 글" };
  releaseV1();
  const outV1 = await pV1;
  assert.equal(outV1.ignored, true);
  assert.equal(applied.length, 0);
  assert.equal(record.analysis.status, "pending");

  // 2) Slow response ignored when record is deleted
  let deleted = false;
  let releaseDelete;
  const pDel = coord.runRecordAnalysis({
    record,
    getRecordById: () => (deleted ? null : record),
    fetchOverride: (_url, init) =>
      new Promise((resolve) => {
        const body = JSON.parse(init.body);
        releaseDelete = () =>
          resolve({
            ok: true,
            status: 200,
            async json() {
              return makeAnalyzeResponse(policyMod, {
                recordId: body.record_id,
                version: body.version,
                requestId: body.request_id,
                overrides: { pos_1: 0.7 },
              });
            },
          });
      }),
    onApplyAnalysis: () => {
      throw new Error("deleted record response must not apply");
    },
  });
  deleted = true;
  releaseDelete();
  const outDel = await pDel;
  assert.equal(outDel.ignored, true);

  // 3) Concurrent retry cancels older request_id; newer request wins
  deleted = false;
  const resolvers = new Map();
  const racingCoord = coordinatorMod.createAnalysisCoordinator({
    requestIdFactory: () => `race-${++seq}`,
    fetchImpl: (_url, init) => {
      const body = JSON.parse(init.body);
      return new Promise((resolve) => {
        resolvers.set(body.request_id, () =>
          resolve({
            ok: true,
            status: 200,
            async json() {
              return makeAnalyzeResponse(policyMod, {
                recordId: body.record_id,
                version: body.version,
                requestId: body.request_id,
                overrides: body.request_id.endsWith(String(seq))
                  ? { pos_1: 0.75 }
                  : { neg_2: 0.75 },
              });
            },
          }),
        );
      });
    },
  });

  const pSlow = racingCoord.runRecordAnalysis({
    record,
    getRecordById: () => record,
    onApplyAnalysis: (_r, nextAnalysis) => {
      record.analysis = nextAnalysis;
    },
  });
  const firstReqId = `race-${seq}`;

  const pFast = racingCoord.runRecordAnalysis({
    record,
    getRecordById: () => record,
    onApplyAnalysis: (_r, nextAnalysis) => {
      record.analysis = nextAnalysis;
    },
  });
  const secondReqId = `race-${seq}`;

  // Second request finishes first, then older slow request resolves
  resolvers.get(secondReqId)();
  const outFast = await pFast;
  resolvers.get(firstReqId)();
  const outSlow = await pSlow;

  assert.equal(outFast.ignored, false);
  assert.equal(outSlow.ignored, true);
  assert.equal(record.analysis.dominant_emotion, "pos_1");
});

test("analysisCoordinator keeps text intact on API error and allows manual retry without auto-retry", async () => {
  const { coordinatorMod, policyMod } = await loadModules();
  const record = {
    id: "rec-err",
    version: 1,
    text: "오래 남기고 싶은 기록 본문",
    analysis: { status: "pending" },
  };
  let calls = 0;
  let shouldFail = true;

  const coord = coordinatorMod.createAnalysisCoordinator({
    fetchImpl: async (_url, init) => {
      calls += 1;
      const body = JSON.parse(init.body);
      if (shouldFail) {
        return {
          ok: false,
          status: 503,
          async json() {
            return { detail: { code: "model_unavailable", message: "모델 로딩 중이에요." } };
          },
        };
      }
      return {
        ok: true,
        status: 200,
        async json() {
          return makeAnalyzeResponse(policyMod, {
            recordId: body.record_id,
            version: body.version,
            requestId: body.request_id,
            overrides: { pos_3: 0.7 },
          });
        },
      };
    },
  });

  const first = await coord.runRecordAnalysis({
    record,
    getRecordById: () => record,
    onApplyAnalysis: (_r, nextAnalysis) => {
      record.analysis = nextAnalysis;
    },
  });

  // Only one API call (no infinite automatic retry); record text intact
  assert.equal(calls, 1);
  assert.equal(first.ok, false);
  assert.equal(record.analysis.status, "error");
  assert.equal(record.analysis.retryable, true);
  assert.equal(record.text, "오래 남기고 싶은 기록 본문");

  // Manual retry succeeds cleanly
  shouldFail = false;
  const retry = await coord.runRecordAnalysis({
    record,
    getRecordById: () => record,
    onApplyAnalysis: (_r, nextAnalysis) => {
      record.analysis = nextAnalysis;
    },
  });
  assert.equal(calls, 2);
  assert.equal(retry.ok, true);
  assert.equal(record.analysis.status, "valid");
  assert.equal(record.analysis.dominant_emotion, "pos_3");
});

test("store and UI components wire post-save analysis, manual retry, and backup isolation", () => {
  const storeSource = fs.readFileSync(
    path.join(ROOT, "src/composables/useDiaryStore.js"),
    "utf8",
  );
  const cardSource = fs.readFileSync(
    path.join(ROOT, "src/components/EmotionCard.vue"),
    "utf8",
  );
  const homeSource = fs.readFileSync(
    path.join(ROOT, "src/views/HomeView.vue"),
    "utf8",
  );
  const backupSource = fs.readFileSync(
    path.join(ROOT, "src/services/backupService.js"),
    "utf8",
  );

  // Server record persistence occurs before post-save analysis call
  assert.match(storeSource, /await (?:create|update)AccountRecord[\s\S]*?void analyzeRecord\(savedEntry\)/);
  assert.match(storeSource, /await updateAccountRecord\(entry\.id[\s\S]*?void analyzeRecord\(entry\)/);
  assert.match(storeSource, /cancelRecordAnalysis/);
  assert.match(storeSource, /cancelAllAnalyses/);
  assert.match(storeSource, /retryAnalysis/);

  // UI distinguishes storage retry vs analysis retry
  assert.match(cardSource, /data-action="retry-save"/);
  assert.match(cardSource, /data-action="retry-analysis"/);
  assert.match(homeSource, /data-action="retry-analysis"/);

  // Backup v1 never leaks analysis into JSON export
  assert.doesNotMatch(backupSource, /analysis/);
});
