import {
  CARD_POLICY_VERSION,
  TAXONOMY_VERSION,
  evaluateCardProbabilities,
} from "../domain/cardPolicy.mjs";

export const DB_NAME = "moment-diary-main";
export const CURRENT_SCHEMA_VERSION = 2;
const LIMIT = 10000;
const MAX_RECORDS = 100;

const fail = () => {
  throw Error("저장된 기록 형식을 확인할 수 없어요. 원본 저장소는 변경하지 않았어요.");
};

const isValidDay = (v) =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(v + "T12:00:00Z")) &&
  new Date(v + "T12:00:00Z").toISOString().slice(0, 10) === v;

const isValidRecordText = (text) => {
  if (typeof text !== "string" || text.includes("\0")) return false;
  const trimmed = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  if (!trimmed || !/[\p{L}\p{N}]/u.test(trimmed)) return false;
  return Array.from(trimmed).length <= LIMIT;
};

export function normalizePersistedAnalysis(analysis, recordVersion) {
  if (!analysis || typeof analysis !== "object") {
    return { status: "pending" };
  }
  if (analysis.status === "error") {
    if (analysis.version !== recordVersion) {
      return { status: "pending" };
    }
    return {
      status: "error",
      version: recordVersion,
      errorCode: typeof analysis.errorCode === "string" ? analysis.errorCode : "ANALYSIS_ERROR",
      message: typeof analysis.message === "string" ? analysis.message : "분석을 완료하지 못했어요.",
    };
  }
  if (analysis.status !== "valid") {
    return { status: "pending" };
  }
  if (
    analysis.version !== recordVersion ||
    analysis.taxonomy_version !== TAXONOMY_VERSION ||
    analysis.truncated === true
  ) {
    return { status: "pending" };
  }
  if (analysis.card_policy_version && analysis.card_policy_version !== CARD_POLICY_VERSION) {
    return { status: "pending" };
  }
  try {
    const evaluated = evaluateCardProbabilities(analysis.probabilities);
    if (analysis.card_stage !== undefined && analysis.card_stage !== evaluated.card_stage) {
      return { status: "pending" };
    }
    if (analysis.card_key !== undefined && analysis.card_key !== evaluated.card_key) {
      return { status: "pending" };
    }
    return {
      status: "valid",
      version: recordVersion,
      taxonomy_version: TAXONOMY_VERSION,
      model_version:
        typeof analysis.model_version === "string" && analysis.model_version
          ? analysis.model_version
          : "unknown",
      request_id: typeof analysis.request_id === "string" ? analysis.request_id : undefined,
      probabilities: analysis.probabilities,
      truncated: false,
      dominant_emotion: evaluated.dominant_emotion,
      dominant_ratio: evaluated.dominant_ratio,
      ties: evaluated.ties,
      card_stage: evaluated.card_stage,
      card_key: evaluated.card_key,
      card_policy_version: CARD_POLICY_VERSION,
    };
  } catch {
    return { status: "pending" };
  }
}

export function validateSnapshot(value) {
  if (
    !value ||
    ![1, CURRENT_SCHEMA_VERSION].includes(value.schemaVersion) ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0
  ) {
    fail();
  }

  const { text, date, sessions, policy, currentEntryId, savedText } = value;
  if (typeof text === "string" && Array.from(text).length > LIMIT) {
    throw Error(
      "초안이 10,000자를 넘어 자동 저장하지 못했어요. 원문은 화면에 그대로 있어요. 분량을 줄이면 다시 저장돼요.",
    );
  }

  if (
    typeof text !== "string" ||
    Array.from(text).length > LIMIT ||
    text.includes("\0") ||
    !isValidDay(date) ||
    !["single", "multi"].includes(policy) ||
    !Array.isArray(sessions) ||
    sessions.length > MAX_RECORDS ||
    !(savedText === null || (typeof savedText === "string" && Array.from(savedText).length <= LIMIT)) ||
    !(currentEntryId === null || typeof currentEntryId === "string")
  ) {
    fail();
  }

  const isLegacyV1 = value.schemaVersion === 1;
  const ids = new Set();
  const records = sessions.map((r) => {
    if (
      !r ||
      (r.favorite !== undefined && typeof r.favorite !== "boolean") ||
      typeof r.id !== "string" ||
      !r.id ||
      ids.has(r.id) ||
      !isValidDay(r.recordDate) ||
      !Number.isSafeInteger(r.version) ||
      r.version < 1 ||
      !["createdAt", "updatedAt"].every(
        (k) => typeof r[k] === "string" && Number.isFinite(Date.parse(r[k])),
      ) ||
      !isValidRecordText(r.text)
    ) {
      fail();
    }
    ids.add(r.id);

    const analysis = isLegacyV1
      ? { status: "pending" }
      : normalizePersistedAnalysis(r.analysis, r.version);

    return {
      favorite: r.favorite ?? false,
      id: r.id,
      text: r.text,
      recordDate: r.recordDate,
      version: r.version,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      analysis,
    };
  });

  if (currentEntryId !== null && !ids.has(currentEntryId)) {
    fail();
  }

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    migratedFrom: isLegacyV1 ? 1 : undefined,
    revision: value.revision,
    text,
    date,
    sessions: records,
    policy,
    currentEntryId,
    savedText,
  };
}

export function createSnapshotStorage(indexedDB) {
  let db = null;
  let revision = 0;
  let blocked = false;
  let conflicted = false;
  let queue = Promise.resolve();

  async function load() {
    if (db || blocked) {
      throw Error("저장소는 이미 초기화되었어요. 새로고침해 주세요.");
    }
    try {
      db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        let settled = false;
        request.onupgradeneeded = () => request.result.createObjectStore("data");
        request.onsuccess = () => {
          if (settled) request.result.close();
          else {
            settled = true;
            resolve(request.result);
          }
        };
        request.onerror = () => {
          settled = true;
          reject(request.error);
        };
        request.onblocked = () => {
          settled = true;
          reject(Error("다른 탭을 닫고 새로고침해 주세요."));
        };
      });
      db.onversionchange = () => {
        blocked = true;
        db.close();
      };
      const stored = await new Promise((resolve, reject) => {
        const tx = db.transaction("data", "readonly");
        const read = tx.objectStore("data").get("state");
        tx.oncomplete = () => resolve(read.result);
        tx.onabort = tx.onerror = () => reject(tx.error || Error("저장소를 읽지 못했어요."));
      });
      if (stored === undefined) return null;
      const data = validateSnapshot(stored);
      revision = data.revision;
      return data;
    } catch (error) {
      blocked = true;
      throw error;
    }
  }

  function save(snapshot) {
    const captured = structuredClone(snapshot);
    const operation = queue.then(() => {
      if (conflicted) {
        throw Error("다른 탭에서 변경됐어요. 내용을 복사한 뒤 새로고침해 주세요.");
      }
      if (!db || blocked) {
        throw Error("저장소를 사용할 수 없어요. 내용을 복사한 뒤 새로고침해 주세요.");
      }
      const value = validateSnapshot({
        ...captured,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        revision: revision + 1,
      });
      // Omit transient migratedFrom metadata when writing schema v2.
      const { migratedFrom: _m, ...persistedValue } = value;
      return new Promise((resolve, reject) => {
        const tx = db.transaction("data", "readwrite");
        const store = tx.objectStore("data");
        const read = store.get("state");
        let failure;
        read.onsuccess = () => {
          if ((read.result?.revision ?? 0) !== revision) {
            conflicted = true;
            failure = Error("다른 탭에서 변경됐어요. 내용을 복사한 뒤 새로고침해 주세요.");
            tx.abort();
          } else {
            try {
              store.put(persistedValue, "state");
            } catch (error) {
              failure = error;
              tx.abort();
            }
          }
        };
        tx.oncomplete = () => {
          revision = persistedValue.revision;
          resolve();
        };
        tx.onabort = tx.onerror = () =>
          reject(failure || tx.error || Error("저장하지 못했어요. 용량을 확인하고 재시도해 주세요."));
      });
    });
    queue = operation.catch(() => {});
    return operation;
  }

  return { load, save };
}
