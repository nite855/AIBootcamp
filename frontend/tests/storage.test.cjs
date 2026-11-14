const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateSnapshot, DB_NAME } = require('../scripts/storage.js');
const fixture = () => ({ schemaVersion: 1, revision: 1, text: '초안', date: '2026-11-09',
  policy: 'single', currentEntryId: 'one', savedText: '기록', sessions: [{ id: 'one', text: '기록',
    recordDate: '2026-11-09', version: 1, createdAt: '2026-11-09T12:00:00Z', updatedAt: '2026-11-09T12:00:00Z',
    analysis: { status: 'valid', probabilities: {} } }] });
test('main storage is isolated and persisted inference is invalidated', () => {
  assert.equal(DB_NAME, 'moment-diary-main');
  const data = validateSnapshot(fixture());
  assert.deepEqual(data.sessions[0].analysis, { status: 'pending' });
  assert.equal(data.text, '초안');
});
test('malformed versions, dates, records and dangling IDs are rejected', () => {
  for (const change of [
    d => d.schemaVersion = 2, d => d.revision = -1, d => d.date = '2026-02-30',
    d => d.policy = 'unknown', d => d.text = 'x'.repeat(10001), d => d.text = '\0',
    d => d.sessions.push(d.sessions[0]), d => d.sessions[0].text = '',
    d => d.sessions[0].version = 0, d => d.sessions[0].createdAt = 'invalid',
    d => d.currentEntryId = 'missing', d => d.sessions = Array.from({ length: 31 }, () => d.sessions[0]),
  ]) { const d = fixture(); change(d); assert.throws(() => validateSnapshot(d)); }
});
test('empty diary and maximum length draft are accepted', () => {
  const d = fixture(); Object.assign(d, { sessions: [], currentEntryId: null, savedText: null, text: 'x'.repeat(10000) });
  assert.equal(validateSnapshot(d).text.length, 10000);
});

function persistenceHarness() {
  const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
  const saves = [], events = {}, state = { text: '', date: '2026-11-09', sessions: [], policy: 'single' };
  let resolveLoad;
  const store = { load: () => new Promise(resolve => { resolveLoad = resolve; }),
    save: snapshot => new Promise((resolve, reject) => saves.push({ snapshot, resolve, reject })) };
  const context = vm.createContext({ state, app: { querySelector: () => null }, render() {},
    window: { addEventListener: (name, fn) => events[name] = fn },
    document: { addEventListener() {} }, DiaryStorage: { create: () => store }, setTimeout, clearTimeout });
  const source = fs.readFileSync(path.join(__dirname, '../scripts/persistence.js'), 'utf8');
  vm.runInContext(source + '\nglobalThis.api = { restore, persist, markChanged, status:()=>({loading,generation,savedGeneration,storageMessage}) };', context);
  return { api: context.api, state, saves, events, loaded: data => resolveLoad(data) };
}
test('restoration blocks mutation until the original snapshot is loaded', async () => {
  const h = persistenceHarness(), restoring = h.api.restore();
  assert.equal(h.api.status().loading, true);
  h.loaded(fixture()); await restoring;
  assert.equal(h.api.status().loading, false);
  assert.equal(h.state.text, '초안');
});
test('an older save completion cannot mark a newer draft as saved', async () => {
  const h = persistenceHarness(), loading = h.api.restore(); h.loaded(null); await loading;
  h.state.text = 'first'; h.api.markChanged(); const first = h.api.persist();
  h.state.text = 'latest'; h.api.markChanged(); const latest = h.api.persist();
  h.saves[0].resolve(); await first;
  assert.equal(h.api.status().savedGeneration, 1);
  assert.notEqual(h.api.status().storageMessage, '초안 저장됨');
  let warned = false;
  h.events.beforeunload({ preventDefault() { warned = true; } }); assert.equal(warned, true);
  h.saves[1].resolve(); await latest;
  assert.equal(h.api.status().savedGeneration, 2);
  assert.equal(h.saves[1].snapshot.text, 'latest');
  assert.equal(h.api.status().storageMessage, '초안 저장됨');
  warned = false; h.events.beforeunload({ preventDefault() { warned = true; } }); assert.equal(warned, false);
});
test('failed writes preserve the draft and successful retry clears the storage error', async () => {
  const h = persistenceHarness(), loading = h.api.restore(); h.loaded(null); await loading;
  h.state.text = 'keep me'; h.api.markChanged(); const failed = h.api.persist();
  h.saves[0].reject(Error('quota exceeded')); assert.equal(await failed, false);
  assert.equal(h.state.text, 'keep me'); assert.equal(h.state.error, true);
  const retry = h.api.persist(); h.saves[1].resolve(); assert.equal(await retry, true);
  assert.equal(h.state.error, false); assert.equal(h.api.status().storageMessage, '초안 저장됨');
});
