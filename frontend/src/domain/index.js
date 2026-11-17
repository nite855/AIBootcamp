// Side-effect imports execute the UMD factories in ESM mode (typeof module === "undefined"),
// attaching domain APIs onto globalThis while keeping frontend/scripts/*.js untouched.
import "./core9.js";
import "../../scripts/diary-core.js";
import "../../scripts/statistics.js";
import "../../scripts/record-id.js";
import "../../scripts/storage.js";
import "../../scripts/backup.js";

import {
  CARD_POLICY_VERSION,
  STAGE_LABELS,
  createDiaryCards,
  evaluateCardProbabilities,
} from "./cardPolicy.mjs";

export const ACCOUNT_MAX_RECORDS = 100;
const NEAR_LIMIT_THRESHOLD = 10;

const baseDiaryCore = globalThis.DiaryCore;
const baseBackup = globalThis.MomentBackup;

export const CardexCore = globalThis.CardexCore;
export const DiaryCore = Object.freeze({
  ...baseDiaryCore,
  MAX_RECORDS: ACCOUNT_MAX_RECORDS,
  recordLimitState(count) {
    const n = Number.isSafeInteger(count) && count > 0 ? count : 0;
    const remaining = Math.max(0, ACCOUNT_MAX_RECORDS - n);
    return {
      count: n,
      remaining,
      level: remaining === 0 ? "full" : remaining <= NEAR_LIMIT_THRESHOLD ? "near" : "ok",
    };
  },
  validate(records) {
    if (!records.length) {
      throw Error("입력 내용이 없습니다. 일기나 게시물을 붙여넣어 주세요.");
    }
    if (records.length > ACCOUNT_MAX_RECORDS) {
      throw Error(`기록은 계정당 최대 ${ACCOUNT_MAX_RECORDS}개까지 보관할 수 있습니다.`);
    }
    return baseDiaryCore.validate(records);
  },
});
export const DiaryCards = createDiaryCards(CardexCore);
export const DiaryStatistics = globalThis.DiaryStatistics;
export const MomentRecordId = globalThis.MomentRecordId;
export const DiaryStorage = globalThis.DiaryStorage;
export const MomentBackup = Object.freeze({
  ...baseBackup,
  merge(current, incoming) {
    const existing = Array.isArray(current) ? current : [];
    const incomingList = Array.isArray(incoming) ? incoming : [];
    const byId = new Map(existing.map((r) => [r.id, r]));
    const additions = [];
    const conflicts = [];
    let duplicates = 0;
    for (const entry of incomingList) {
      const old = byId.get(entry.id);
      if (!old) additions.push(entry);
      else if (
        old.text === entry.text &&
        old.recordDate === entry.recordDate &&
        Boolean(old.favorite) === Boolean(entry.favorite)
      ) {
        duplicates += 1;
      } else {
        conflicts.push(entry.id);
      }
    }
    const entries = [...existing, ...additions];
    const overLimit = entries.length > ACCOUNT_MAX_RECORDS;
    return {
      entries,
      added: additions.length,
      duplicates,
      conflicts: conflicts.length,
      overLimit,
      allowed: conflicts.length === 0 && !overLimit,
    };
  },
});

export { CARD_POLICY_VERSION, STAGE_LABELS, evaluateCardProbabilities };

export function cardLabel(record) {
  const c = DiaryCards.resolve(record);
  if (c.status === "ready") {
    const emotion = CardexCore.type(c.type);
    const parent = CardexCore.parent(emotion.parent);
    return `${parent.name} · ${emotion.name} ${c.stage}단계`;
  }
  if (c.status === "error") return "분석 실패";
  return "분석 대기";
}
