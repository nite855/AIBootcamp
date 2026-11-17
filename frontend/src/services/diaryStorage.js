import { createSnapshotStorage } from "./snapshotStorage.mjs";

export function createDiaryStorage(indexedDB = window.indexedDB) {
  return createSnapshotStorage(indexedDB);
}
