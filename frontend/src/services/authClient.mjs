/**
 * JWT Access Token (in-memory only) + HttpOnly Refresh Cookie client for /api/auth/*
 * and authenticated API calls.
 */

let accessToken = null;
let refreshPromise = null;
let sessionExpiredHandler = null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token) {
  accessToken = token || null;
}

export function clearAccessToken() {
  accessToken = null;
}

export function onSessionExpired(handler) {
  sessionExpiredHandler = typeof handler === "function" ? handler : null;
}

function extractErrorMessage(body, fallback) {
  if (!body) return fallback;
  if (typeof body.detail === "string" && body.detail) return body.detail;
  if (typeof body.detail?.message === "string" && body.detail.message) return body.detail.message;
  if (Array.isArray(body.detail) && body.detail[0]?.msg) {
    return String(body.detail[0].msg);
  }
  if (typeof body.message === "string" && body.message) return body.message;
  return fallback;
}

export class ApiError extends Error {
  constructor(status, code, message, body = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export async function refreshSession({ fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== "function") {
    throw new ApiError(0, "FETCH_UNAVAILABLE", "네트워크 요청을 보낼 수 없는 환경이에요.");
  }
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const response = await fetchImpl("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      clearAccessToken();
      throw new ApiError(
        response.status,
        body?.code || `HTTP_${response.status}`,
        extractErrorMessage(body, "로그인이 필요합니다."),
        body,
      );
    }
    setAccessToken(body?.access_token || null);
    return body;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export async function authorizedFetch(
  url,
  options = {},
  { fetchImpl = globalThis.fetch, retryOn401 = true } = {},
) {
  if (typeof fetchImpl !== "function") {
    throw new ApiError(0, "FETCH_UNAVAILABLE", "네트워크 요청을 보낼 수 없는 환경이에요.");
  }

  const send = () => {
    const headers = new Headers(options.headers || {});
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
    return fetchImpl(url, {
      ...options,
      headers,
      credentials: "include",
    });
  };

  let response = await send();
  if (response.status === 401 && retryOn401) {
    try {
      await refreshSession({ fetchImpl });
      response = await send();
    } catch (error) {
      clearAccessToken();
      sessionExpiredHandler?.(error);
      throw error;
    }
  }
  return response;
}

async function jsonRequest(url, options = {}, { auth = false, fetchImpl = globalThis.fetch } = {}) {
  const runner = auth
    ? (u, opts) => authorizedFetch(u, opts, { fetchImpl })
    : (u, opts) => fetchImpl(u, { ...opts, credentials: "include" });

  const response = await runner(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      body?.code || body?.detail?.code || `HTTP_${response.status}`,
      extractErrorMessage(body, "요청 처리 중 오류가 발생했어요."),
      body,
    );
  }
  return body;
}

export function fetchConsentPolicies({ fetchImpl = globalThis.fetch } = {}) {
  return jsonRequest("/api/auth/consent-policies", { method: "GET" }, { auth: false, fetchImpl });
}

export async function registerAccount(
  { loginId, email, password, nickname = null, consents },
  { fetchImpl = globalThis.fetch } = {},
) {
  const data = await jsonRequest(
    "/api/auth/register",
    {
      method: "POST",
      body: JSON.stringify({
        login_id: loginId,
        email,
        password,
        nickname: nickname || null,
        consents,
      }),
    },
    { auth: false, fetchImpl },
  );
  setAccessToken(data?.access_token || null);
  return data;
}

export async function loginAccount({ loginId, password }, { fetchImpl = globalThis.fetch } = {}) {
  const data = await jsonRequest(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify({
        login_id: loginId,
        password,
      }),
    },
    { auth: false, fetchImpl },
  );
  setAccessToken(data?.access_token || null);
  return data;
}

export async function logoutAccount({ fetchImpl = globalThis.fetch } = {}) {
  try {
    await jsonRequest("/api/auth/logout", { method: "POST" }, { auth: false, fetchImpl });
  } finally {
    clearAccessToken();
  }
}

export function fetchMe({ fetchImpl = globalThis.fetch } = {}) {
  return jsonRequest("/api/auth/me", { method: "GET" }, { auth: true, fetchImpl });
}

export async function submitConsents(consents, { fetchImpl = globalThis.fetch } = {}) {
  const data = await jsonRequest(
    "/api/auth/consents",
    {
      method: "PUT",
      body: JSON.stringify({ consents }),
    },
    { auth: true, fetchImpl },
  );
  if (data?.access_token) {
    setAccessToken(data.access_token);
  }
  return data;
}

export async function withdrawAccount(password, { fetchImpl = globalThis.fetch } = {}) {
  const data = await jsonRequest(
    "/api/auth/withdraw",
    {
      method: "POST",
      body: JSON.stringify({
        password,
        confirm_withdrawal: true,
      }),
    },
    { auth: true, fetchImpl },
  );
  clearAccessToken();
  return data;
}
