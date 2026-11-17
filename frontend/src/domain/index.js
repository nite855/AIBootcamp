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

export const CardexCore = globalThis.CardexCore;
export const DiaryCore = globalThis.DiaryCore;
export const DiaryCards = createDiaryCards(CardexCore);
export const DiaryStatistics = globalThis.DiaryStatistics;
export const MomentRecordId = globalThis.MomentRecordId;
export const DiaryStorage = globalThis.DiaryStorage;
export const MomentBackup = globalThis.MomentBackup;

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
