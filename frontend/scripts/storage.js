/* Main diary storage. Display preferences remain in their existing localStorage keys. */
(function (root, factory) {
  const api = factory(typeof module === 'object' ? require('./diary-core.js') : root.DiaryCore);
  if (typeof module === 'object') module.exports = api;
  else root.DiaryStorage = api;
})(globalThis, function (D) {
  'use strict';
  const DB_NAME = 'moment-diary-main';
  const fail = () => { throw Error('저장된 기록 형식을 확인할 수 없어요. 원본 저장소는 변경하지 않았어요.'); };
  function validateSnapshot(value) {
    if (!value || value.schemaVersion !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 0) fail();
    const { text, date, sessions, policy, currentEntryId, savedText } = value;
    const day = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) &&
      Number.isFinite(Date.parse(v + 'T12:00:00Z')) && new Date(v + 'T12:00:00Z').toISOString().slice(0, 10) === v;
    if (typeof text !== 'string' || Array.from(text).length > D.LIMIT || text.includes('\0') || !day(date) ||
        !['single', 'multi'].includes(policy) || !Array.isArray(sessions) || sessions.length > D.MAX_RECORDS ||
        !(savedText === null || typeof savedText === 'string' && Array.from(savedText).length <= D.LIMIT) ||
        !(currentEntryId === null || typeof currentEntryId === 'string')) fail();
    const ids = new Set();
    const records = sessions.map(r => {
      if (!r || typeof r.id !== 'string' || !r.id || ids.has(r.id) || !day(r.recordDate) ||
          !Number.isSafeInteger(r.version) || r.version < 1 ||
          !['createdAt', 'updatedAt'].every(k => typeof r[k] === 'string' && Number.isFinite(Date.parse(r[k])))) fail();
      ids.add(r.id);
      try { if (typeof r.text !== 'string') fail(); D.validate([{ text: r.text }]); } catch { fail(); }
      // Persisted real records have no supported inference contract yet.
      return { id: r.id, text: r.text, recordDate: r.recordDate, version: r.version,
        createdAt: r.createdAt, updatedAt: r.updatedAt, analysis: { status: 'pending' } };
    });
    if (currentEntryId !== null && !ids.has(currentEntryId)) fail();
    return { schemaVersion: 1, revision: value.revision, text, date, sessions: records, policy, currentEntryId, savedText };
  }
  function create(indexedDB) {
    let db, revision = 0, blocked = false, conflicted = false, queue = Promise.resolve();
    async function load() {
      if (db || blocked) throw Error('저장소는 이미 초기화되었어요. 새로고침해 주세요.');
      try {
        db = await new Promise((resolve, reject) => {
          const request = indexedDB.open(DB_NAME, 1);
          let settled = false;
          request.onupgradeneeded = () => request.result.createObjectStore('data');
          request.onsuccess = () => { if (settled) request.result.close(); else { settled = true; resolve(request.result); } };
          request.onerror = () => { settled = true; reject(request.error); };
          request.onblocked = () => { settled = true; reject(Error('다른 탭을 닫고 새로고침해 주세요.')); };
        });
        db.onversionchange = () => { blocked = true; db.close(); };
        const stored = await new Promise((resolve, reject) => {
          const tx = db.transaction('data', 'readonly');
          const read = tx.objectStore('data').get('state');
          tx.oncomplete = () => resolve(read.result);
          tx.onabort = tx.onerror = () => reject(tx.error || Error('저장소를 읽지 못했어요.'));
        });
        if (stored === undefined) return null;
        const data = validateSnapshot(stored);
        revision = data.revision;
        return data;
      } catch (error) { blocked = true; throw error; }
    }
    function save(snapshot) {
      const captured = structuredClone(snapshot);
      const operation = queue.then(() => {
        if (conflicted) throw Error('다른 탭에서 변경됐어요. 내용을 복사한 뒤 새로고침해 주세요.');
        if (!db || blocked) throw Error('저장소를 사용할 수 없어요. 내용을 복사한 뒤 새로고침해 주세요.');
        const value = validateSnapshot({ ...captured, schemaVersion: 1, revision: revision + 1 });
        return new Promise((resolve, reject) => {
          const tx = db.transaction('data', 'readwrite'), store = tx.objectStore('data');
          const read = store.get('state');
          let failure;
          read.onsuccess = () => {
            if ((read.result?.revision ?? 0) !== revision) {
              conflicted = true;
              failure = Error('다른 탭에서 변경됐어요. 내용을 복사한 뒤 새로고침해 주세요.');
              tx.abort();
            } else {
              try { store.put(value, 'state'); }
              catch (error) { failure = error; tx.abort(); }
            }
          };
          tx.oncomplete = () => { revision = value.revision; resolve(); };
          tx.onabort = tx.onerror = () => reject(failure || tx.error || Error('저장하지 못했어요. 용량을 확인하고 재시도해 주세요.'));
        });
      });
      queue = operation.catch(() => {});
      return operation;
    }
    return { load, save };
  }
  return { DB_NAME, validateSnapshot, create };
});
