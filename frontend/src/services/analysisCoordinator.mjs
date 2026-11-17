import { isResponseCurrent, requestRecordAnalysis } from "./analysisClient.mjs";

function createRequestId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Race-guarded coordinator for post-save record emotion analysis requests.
 * Tracks the latest request_id and AbortController per record_id so edits,
 * deletions, or newer retries supersede older in-flight responses.
 */
export function createAnalysisCoordinator({
  fetchImpl = null,
  endpoint = "/api/analyze",
  requestIdFactory = createRequestId,
  onAnalyzingChange = null,
} = {}) {
  const activeRequests = new Map();
  const controllers = new Map();
  const analyzingIds = new Set();

  function notifyAnalyzing() {
    if (typeof onAnalyzingChange === "function") {
      onAnalyzingChange(new Set(analyzingIds));
    }
  }

  function cancelRecordAnalysis(recordId) {
    if (!recordId) return;
    activeRequests.delete(recordId);
    const controller = controllers.get(recordId);
    if (controller) {
      controllers.delete(recordId);
      try {
        controller.abort();
      } catch {
        // Ignore abort errors from non-standard environments.
      }
    }
    if (analyzingIds.delete(recordId)) {
      notifyAnalyzing();
    }
  }

  function cancelAllAnalyses() {
    for (const recordId of [...controllers.keys()]) {
      cancelRecordAnalysis(recordId);
    }
    activeRequests.clear();
    if (analyzingIds.size > 0) {
      analyzingIds.clear();
      notifyAnalyzing();
    }
  }

  async function runRecordAnalysis({
    record,
    getRecordById,
    isRealMode = () => true,
    isActiveRecord = (item) => Boolean(item),
    onApplyAnalysis,
    fetchOverride = null,
  }) {
    if (!record || !isRealMode()) {
      return { ignored: true, reason: "inactive-mode" };
    }

    const expectedRecordId = record.id;
    const expectedVersion = Number(record.version) || 1;
    const expectedText = String(record.text || "");
    const requestId = requestIdFactory();

    cancelRecordAnalysis(expectedRecordId);

    const controller =
      typeof AbortController === "function" ? new AbortController() : null;
    activeRequests.set(expectedRecordId, requestId);
    if (controller) controllers.set(expectedRecordId, controller);
    analyzingIds.add(expectedRecordId);
    notifyAnalyzing();

    const effectiveFetch = fetchOverride || fetchImpl || globalThis.fetch;
    let result;
    try {
      result = await requestRecordAnalysis({
        recordId: expectedRecordId,
        version: expectedVersion,
        requestId,
        text: expectedText,
        fetchImpl: effectiveFetch,
        signal: controller ? controller.signal : undefined,
        endpoint,
      });
    } finally {
      if (activeRequests.get(expectedRecordId) === requestId) {
        if (controllers.get(expectedRecordId) === controller) {
          controllers.delete(expectedRecordId);
        }
        analyzingIds.delete(expectedRecordId);
        notifyAnalyzing();
      }
    }

    const currentRecord =
      typeof getRecordById === "function" ? getRecordById(expectedRecordId) : record;
    const currentOk =
      isRealMode() &&
      isActiveRecord(currentRecord) &&
      isResponseCurrent({
        activeRequests,
        record: currentRecord,
        expectedRecordId,
        expectedVersion,
        expectedRequestId: requestId,
      });

    if (!currentOk) {
      return { ignored: true, reason: "stale-or-deleted" };
    }

    activeRequests.delete(expectedRecordId);
    if (result.aborted) {
      return { ignored: true, reason: "aborted" };
    }

    const nextAnalysis = result.ok
      ? result.analysis
      : {
          status: "error",
          version: expectedVersion,
          errorCode: result.errorCode || "analysis-error",
          message: result.message || "감정 분석에 실패했어요.",
          retryable: result.retryable !== false,
          failedAt: new Date().toISOString(),
        };

    if (typeof onApplyAnalysis === "function") {
      await onApplyAnalysis(currentRecord, nextAnalysis, result);
    }

    return {
      ignored: false,
      ok: Boolean(result.ok),
      analysis: nextAnalysis,
      result,
    };
  }

  return {
    activeRequests,
    isAnalyzing: (recordId) => analyzingIds.has(recordId),
    getAnalyzingIds: () => new Set(analyzingIds),
    cancelRecordAnalysis,
    cancelAllAnalyses,
    runRecordAnalysis,
  };
}
