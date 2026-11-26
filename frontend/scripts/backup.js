/* Portable records only. Drafts, display settings and example analysis stay local. */
(function(root, factory) {
  const api = factory(typeof module === 'object' ? require('./storage.js') : root.DiaryStorage);
  if (typeof module === 'object') module.exports = api;
  else root.MomentBackup = api;
})(globalThis, function(Storage) {
  'use strict';
  const FORMAT = 'moment-benchmark-backup', MAX_BYTES = 5 * 1024 * 1024;
  function records(entries) {
    const value = Storage.validateSnapshot({ schemaVersion:1, revision:0, text:'', date:'2026-01-01',
      sessions:entries, policy:'single', currentEntryId:null, savedText:null });
    return value.sessions.map(({analysis, ...entry}) => entry);
  }
  function create(entries) {
    return {format:FORMAT, version:1, exportedAt:new Date().toISOString(), entries:records(entries)};
  }
  function parse(text) {
    if (new TextEncoder().encode(text).length > MAX_BYTES) throw Error('백업 파일은 5MiB 이하여야 해요.');
    let file;
    try { file = JSON.parse(text); } catch { throw Error('올바른 JSON 백업 파일을 선택해 주세요.'); }
    if (!file || file.format !== FORMAT || file.version !== 1 ||
      typeof file.exportedAt !== 'string' || !Number.isFinite(Date.parse(file.exportedAt)))
      throw Error('지원하지 않는 백업 형식 또는 버전이에요.');
    return records(file.entries);
  }
  function merge(current, incoming) {
    const existing = records(current), additions = [], conflicts = [];
    let duplicates = 0;
    const byId = new Map(existing.map(r => [r.id, r]));
    for (const entry of records(incoming)) {
      const old = byId.get(entry.id);
      if (!old) additions.push(entry);
      else if (JSON.stringify(old) === JSON.stringify(entry)) duplicates++;
      else conflicts.push(entry.id);
    }
    const entries = [...existing, ...additions];
    const overLimit = entries.length > 30;
    return {entries, added:additions.length, duplicates, conflicts:conflicts.length, overLimit,
      allowed:!conflicts.length && !overLimit};
  }
  return {FORMAT, MAX_BYTES, create, parse, merge};
});
