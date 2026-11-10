// Included inside the app closure by the standalone builder.
let storage, loading = true, storeReady = false, generation = 0, savedGeneration = 0;
let persistTimer, lastStorageError, storageMessage = '기록을 불러오는 중…';
const snapshot = () => ({ text: state.text, date: state.date, sessions: state.sessions,
  policy: state.policy, currentEntryId: state.currentEntryId || null, savedText: state.savedText ?? null });
function showStorage(message) {
  storageMessage = message;
  const el = app.querySelector('#save-status');
  if (el) el.textContent = message;
  const retry = app.querySelector('[data-action=retry-save]');
  if (retry) retry.hidden = storeReady && !lastStorageError;
}
function markChanged() {
  generation++;
  showStorage('아직 저장되지 않은 변경이 있어요.');
}
function schedulePersist() {
  markChanged();
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => { void persist(); }, 500);
}
async function persist() {
  clearTimeout(persistTimer);
  const savingGeneration = generation;
  showStorage('초안 저장 중');
  try {
    if (!storeReady) throw Error('저장소를 사용할 수 없어요. 재시도하거나 내용을 복사해 주세요.');
    await storage.save(snapshot());
    savedGeneration = Math.max(savedGeneration, savingGeneration);
    if (state.status === lastStorageError) {
      state.error = false;
      state.status = '';
      const feedback = app.querySelector('#feedback');
      if (feedback) { feedback.textContent = ''; feedback.setAttribute('role', 'status'); }
    }
    lastStorageError = null;
    showStorage(generation === savedGeneration ? '초안 저장됨' : '최근 변경을 저장 중이에요.');
    return true;
  } catch (error) {
    lastStorageError = error.message;
    state.error = true;
    state.status = error.message;
    showStorage(error.message);
    const feedback = app.querySelector('#feedback');
    if (feedback) { feedback.textContent = error.message; feedback.setAttribute('role', 'alert'); }
    return false;
  }
}
async function restore() {
  loading = true;
  render();
  try {
    const candidate = DiaryStorage.create(window.indexedDB);
    const data = await candidate.load();
    // Never replace a memory-only draft with data that appeared while storage was unavailable.
    if (generation !== savedGeneration && data) throw Error('보관된 기록이 있어요. 현재 내용을 복사한 뒤 새로고침해 주세요.');
    storage = candidate;
    storeReady = true;
    if (data) {
      const { text, date, sessions, policy, currentEntryId, savedText } = data;
      Object.assign(state, { text, date, sessions, policy, currentEntryId, savedText });
    }
    showStorage('자동 저장 준비됨');
    if (generation !== savedGeneration) await persist();
  } catch (error) {
    storeReady = false;
    state.error = true;
    state.status = '저장소를 열지 못했어요. 메모리에서 계속 작성할 수 있어요. ' + error.message;
    showStorage(state.status);
  } finally { loading = false; render(); }
}
window.addEventListener('beforeunload', e => {
  if (generation !== savedGeneration) { e.preventDefault(); e.returnValue = ''; }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && generation !== savedGeneration && !loading) void persist();
});
