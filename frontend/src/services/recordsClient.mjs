import { ApiError, authorizedFetch } from "./authClient.mjs";

function mapAnalysisFromServer(analysis) {
  if (!analysis || analysis.status === "pending") {
    return { status: "pending" };
  }
  if (analysis.status === "error") {
    return {
      status: "error",
      version: analysis.version,
      errorCode: analysis.error_code || "ANALYSIS_ERROR",
      message: analysis.message || "분석을 완료하지 못했어요.",
    };
  }
  return {
    status: "valid",
    version: analysis.version,
    taxonomy_version: analysis.taxonomy_version,
    model_version: analysis.model_version || "unknown",
    probabilities: analysis.probabilities,
    truncated: false,
    dominant_emotion: analysis.dominant_emotion,
    dominant_ratio: analysis.dominant_ratio,
    ties: analysis.ties,
    card_stage: analysis.card_stage,
    card_key: analysis.card_key,
    card_policy_version: analysis.card_policy_version,
  };
}

export function normalizeServerRecord(row) {
  return {
    id: row.id,
    dbId: row.db_id,
    text: row.text,
    recordDate: row.record_date,
    version: row.version,
    favorite: Boolean(row.favorite),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    analysis: mapAnalysisFromServer(row.analysis),
  };
}

async function apiJson(url, options = {}, { fetchImpl = globalThis.fetch } = {}) {
  const response = await authorizedFetch(
    url,
    {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    },
    { fetchImpl },
  );
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      typeof body?.detail === "string"
        ? body.detail
        : typeof body?.detail?.message === "string"
          ? body.detail.message
          : "서버 요청 처리에 실패했어요.";
    throw new ApiError(
      response.status,
      body?.code || body?.detail?.code || `HTTP_${response.status}`,
      detail,
      body,
    );
  }
  return body;
}

export async function fetchAccountRecords({ fetchImpl = globalThis.fetch } = {}) {
  const data = await apiJson("/api/records", { method: "GET" }, { fetchImpl });
  return {
    records: Array.isArray(data?.records) ? data.records.map(normalizeServerRecord) : [],
    totalCount: data?.total_count ?? 0,
    maxRecords: data?.max_records ?? 100,
  };
}

export async function createAccountRecord(
  { id, text, recordDate, favorite = false },
  { fetchImpl = globalThis.fetch } = {},
) {
  const row = await apiJson(
    "/api/records",
    {
      method: "POST",
      body: JSON.stringify({
        record_id: id,
        text,
        record_date: recordDate,
        favorite,
      }),
    },
    { fetchImpl },
  );
  return normalizeServerRecord(row);
}

export async function updateAccountRecord(
  recordId,
  { text, recordDate },
  { fetchImpl = globalThis.fetch } = {},
) {
  const row = await apiJson(
    `/api/records/${encodeURIComponent(recordId)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        text,
        record_date: recordDate,
      }),
    },
    { fetchImpl },
  );
  return normalizeServerRecord(row);
}

export async function setAccountRecordFavorite(
  recordId,
  favorite,
  { fetchImpl = globalThis.fetch } = {},
) {
  const row = await apiJson(
    `/api/records/${encodeURIComponent(recordId)}/favorite`,
    {
      method: "PATCH",
      body: JSON.stringify({ favorite: Boolean(favorite) }),
    },
    { fetchImpl },
  );
  return normalizeServerRecord(row);
}

export function fetchDeleteImpact(recordId, { fetchImpl = globalThis.fetch } = {}) {
  return apiJson(
    `/api/records/${encodeURIComponent(recordId)}/delete-impact`,
    { method: "GET" },
    { fetchImpl },
  );
}

export function deleteAccountRecord(
  recordId,
  { confirmCardDeletion = false } = {},
  { fetchImpl = globalThis.fetch } = {},
) {
  const qs = confirmCardDeletion ? "?confirm_card_deletion=true" : "";
  return apiJson(
    `/api/records/${encodeURIComponent(recordId)}${qs}`,
    { method: "DELETE" },
    { fetchImpl },
  );
}

export function deleteAllAccountRecords(
  { confirmCardDeletion = false } = {},
  { fetchImpl = globalThis.fetch } = {},
) {
  const qs = confirmCardDeletion ? "?confirm_card_deletion=true" : "";
  return apiJson(`/api/records${qs}`, { method: "DELETE" }, { fetchImpl });
}

export function importAccountRecords(entries, { fetchImpl = globalThis.fetch } = {}) {
  return apiJson(
    "/api/records/import",
    {
      method: "POST",
      body: JSON.stringify({
        entries: entries.map((e) => ({
          record_id: e.id,
          text: e.text,
          record_date: e.recordDate,
          favorite: Boolean(e.favorite),
          version: e.version || 1,
          created_at: e.createdAt || null,
          updated_at: e.updatedAt || null,
        })),
      }),
    },
    { fetchImpl },
  );
}

export function fetchCollectedCards({ fetchImpl = globalThis.fetch } = {}) {
  return apiJson("/api/cards", { method: "GET" }, { fetchImpl });
}
