const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");

async function loadClients() {
  const authMod = await import(
    pathToFileURL(path.join(ROOT, "src/services/authClient.mjs")).href
  );
  const recordsMod = await import(
    pathToFileURL(path.join(ROOT, "src/services/recordsClient.mjs")).href
  );
  return { authMod, recordsMod };
}

test("authClient stores access token in memory, retries 401 via refresh, and clears on logout", async () => {
  const { authMod } = await loadClients();
  authMod.clearAccessToken();

  let callIndex = 0;
  const calls = [];
  const fakeFetch = async (url, init = {}) => {
    calls.push({ url, method: init.method, auth: init.headers?.get?.("Authorization") || null, credentials: init.credentials });
    callIndex += 1;
    if (url === "/api/auth/login") {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            access_token: "token-1",
            expires_in: 900,
            consent_required: false,
            missing_required_codes: [],
            user: { id: "u1", login_id: "alice01", email: "a@example.com", nickname: "alice01", is_adult_14_plus: true, created_at: "2026-11-17T00:00:00Z" },
            consents: [],
          };
        },
      };
    }
    if (url === "/api/records" && callIndex === 2) {
      return { ok: false, status: 401, async json() { return { detail: "expired" }; } };
    }
    if (url === "/api/auth/refresh") {
      return {
        ok: true,
        status: 200,
        async json() {
          return { access_token: "token-2", expires_in: 900, consent_required: false, missing_required_codes: [], user: { id: "u1", login_id: "alice01", email: "a@example.com", nickname: "alice01", is_adult_14_plus: true, created_at: "2026-11-17T00:00:00Z" }, consents: [] };
        },
      };
    }
    if (url === "/api/records" && callIndex === 4) {
      return { ok: true, status: 200, async json() { return { records: [], total_count: 0, max_records: 100 }; } };
    }
    if (url === "/api/auth/logout") {
      return { ok: true, status: 200, async json() { return { message: "ok" }; } };
    }
    throw new Error(`Unexpected call: ${url} #${callIndex}`);
  };

  await authMod.loginAccount({ loginId: "alice01", password: "Password123!" }, { fetchImpl: fakeFetch });
  assert.equal(authMod.getAccessToken(), "token-1");

  const res = await authMod.authorizedFetch("/api/records", { method: "GET" }, { fetchImpl: fakeFetch });
  assert.equal(res.status, 200);
  assert.equal(authMod.getAccessToken(), "token-2");
  assert.equal(calls[3].auth, "Bearer token-2");
  assert.equal(calls[2].credentials, "include");

  await authMod.logoutAccount({ fetchImpl: fakeFetch });
  assert.equal(authMod.getAccessToken(), null);
});

test("recordsClient sends confirm_card_deletion flag and normalizes server record DTO", async () => {
  const { authMod, recordsMod } = await loadClients();
  authMod.setAccessToken("token-ok");

  const requests = [];
  const fakeFetch = async (url, init = {}) => {
    requests.push({ url, method: init.method });
    if (url.startsWith("/api/records?") || url === "/api/records") {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            total_count: 1,
            max_records: 100,
            records: [
              {
                id: "rec-1",
                db_id: "uuid-1",
                text: "좋은 하루",
                record_date: "2026-11-17",
                version: 1,
                favorite: true,
                created_at: "2026-11-17T01:00:00Z",
                updated_at: "2026-11-17T01:00:00Z",
                analysis: { status: "pending" },
              },
            ],
          };
        },
      };
    }
    return { ok: true, status: 200, async json() { return { deleted_record_id: "rec-1", deleted_card_unlock: true, relocked_card_key: "pos_1:2" }; } };
  };

  const list = await recordsMod.fetchAccountRecords({ fetchImpl: fakeFetch });
  assert.equal(list.maxRecords, 100);
  assert.equal(list.records[0].recordDate, "2026-11-17");
  assert.equal(list.records[0].favorite, true);

  await recordsMod.deleteAccountRecord("rec-1", { confirmCardDeletion: true }, { fetchImpl: fakeFetch });
  assert.equal(requests[1].url, "/api/records/rec-1?confirm_card_deletion=true");
  assert.equal(requests[1].method, "DELETE");
  authMod.clearAccessToken();
});
