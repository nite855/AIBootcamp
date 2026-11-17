import {
  CARD_POLICY_VERSION,
  TAXONOMY_VERSION,
  evaluateCardProbabilities,
} from "../domain/cardPolicy.mjs";

export function isResponseCurrent({ activeRequests, record, expectedRecordId, expectedVersion, expectedRequestId }) {
  if (!record) return false;
  if (record.id !== expectedRecordId || record.version !== expectedVersion) return false;
  return activeRequests.get(expectedRecordId) === expectedRequestId;
}

export function validateApiResponsePayload(data, { recordId, version, requestId }) {
  if (!data || typeof data !== "object") {
    return {
      ok: false,
      errorCode: "INVALID_RESPONSE",
      message: "감정 분석 응답 형식을 확인할 수 없어요.",
      retryable: true,
    };
  }
  if (
    data.record_id !== recordId ||
    data.version !== version ||
    data.request_id !== requestId
  ) {
    return {
      ok: false,
      errorCode: "STALE_RESPONSE",
      message: "응답 식별자가 현재 기록과 일치하지 않아요.",
      retryable: false,
    };
  }
  if (data.taxonomy_version !== TAXONOMY_VERSION) {
    return {
      ok: false,
      errorCode: "TAXONOMY_MISMATCH",
      message: "지원하지 않는 감정 분류 버전이에요.",
      retryable: false,
    };
  }
  if (data.status !== "valid" || data.truncated === true) {
    return {
      ok: false,
      errorCode: data.error_code || (data.truncated ? "INPUT_TRUNCATED" : "ANALYSIS_UNISSUABLE"),
      message:
        data.message ||
        (data.truncated
          ? "모델 최대 입력 길이를 초과해 분석 카드를 만들지 못했어요."
          : "분석을 완료하지 못했어요."),
      retryable: !data.truncated,
    };
  }
  if (data.card_policy_version !== CARD_POLICY_VERSION) {
    return {
      ok: false,
      errorCode: "POLICY_MISMATCH",
      message: "카드 판정 정책 버전이 일치하지 않아요.",
      retryable: false,
    };
  }

  try {
    const evaluated = evaluateCardProbabilities(data.probabilities);
    if (
      data.dominant_emotion !== evaluated.dominant_emotion ||
      data.dominant_ratio !== evaluated.dominant_ratio ||
      !Array.isArray(data.ties) ||
      data.ties.length !== evaluated.ties.length ||
      data.ties.some((id, index) => id !== evaluated.ties[index]) ||
      data.card_stage !== evaluated.card_stage ||
      data.card_key !== evaluated.card_key
    ) {
      return {
        ok: false,
        errorCode: "INVALID_MODEL_OUTPUT",
        message: "카드 판정 값이 확률 분포와 일치하지 않아요.",
        retryable: true,
      };
    }
    return {
      ok: true,
      analysis: {
        status: "valid",
        version,
        taxonomy_version: TAXONOMY_VERSION,
        model_version: String(data.model_version || "unknown"),
        request_id: requestId,
        probabilities: data.probabilities,
        truncated: false,
        dominant_emotion: evaluated.dominant_emotion,
        dominant_ratio: evaluated.dominant_ratio,
        ties: evaluated.ties,
        card_stage: evaluated.card_stage,
        card_key: evaluated.card_key,
        card_policy_version: CARD_POLICY_VERSION,
      },
    };
  } catch {
    return {
      ok: false,
      errorCode: "INVALID_MODEL_OUTPUT",
      message: "분석 확률 검증에 실패했어요.",
      retryable: true,
    };
  }
}

export async function requestRecordAnalysis({
  recordId,
  version,
  requestId,
  text,
  fetchImpl = globalThis.fetch,
  signal,
  endpoint = "/api/analyze",
}) {
  if (typeof fetchImpl !== "function") {
    return {
      ok: false,
      errorCode: "FETCH_UNAVAILABLE",
      message: "분석 요청 기능을 사용할 수 없는 환경이에요.",
      retryable: true,
    };
  }

  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        record_id: recordId,
        version,
        request_id: requestId,
        text,
      }),
      signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      return { ok: false, aborted: true, errorCode: "ABORTED", message: "", retryable: false };
    }
    return {
      ok: false,
      errorCode: "NETWORK_ERROR",
      message: "감정 분석 서버에 연결하지 못했어요. 기록은 안전하게 보관됐어요.",
      retryable: true,
    };
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const code = body?.code || (response.status === 503 ? "MODEL_NOT_READY" : `HTTP_${response.status}`);
    const detail =
      typeof body?.detail === "string" && body.detail
        ? body.detail
        : response.status === 503
          ? "감정 분석 모델이 아직 준비되지 않았어요."
          : response.status === 422
            ? "분석 요청 형식을 확인해 주세요."
            : "감정 분석 중 오류가 발생했어요.";
    return {
      ok: false,
      status: response.status,
      errorCode: code,
      message: detail,
      retryable: response.status !== 422,
    };
  }

  return validateApiResponsePayload(body, { recordId, version, requestId });
}
