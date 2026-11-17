import { MomentBackup } from "../domain/index.js";

export const BACKUP_MAX_BYTES = MomentBackup.MAX_BYTES;

export function parseBackupText(text) {
  return MomentBackup.parse(text);
}

export function planBackupMerge(currentSessions, incomingEntries) {
  return MomentBackup.merge(currentSessions, incomingEntries);
}

export function createBackupPayload(sessions) {
  return MomentBackup.create(sessions);
}

export function triggerBackupDownload(sessions, dateStr) {
  const payload = createBackupPayload(sessions);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `moment-backup-${dateStr}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
