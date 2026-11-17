import { computed, reactive, ref, toRaw } from "vue";
import {
  ACCOUNT_MAX_RECORDS,
  CardexCore,
  DiaryCards,
  DiaryCore,
  MomentRecordId,
  cardLabel,
} from "../domain/index.js";
import { createDiaryStorage } from "../services/diaryStorage.js";
import {
  BACKUP_MAX_BYTES,
  parseBackupText,
  planBackupMerge,
  triggerBackupDownload,
} from "../services/backupService.js";
import { exportCardPng } from "../services/cardRenderer.js";
import { createAnalysisCoordinator } from "../services/analysisCoordinator.mjs";
import {
  createAccountRecord,
  deleteAccountRecord,
  deleteAllAccountRecords,
  fetchAccountRecords,
  fetchCollectedCards,
  fetchDeleteImpact,
  importAccountRecords,
  setAccountRecordFavorite,
  updateAccountRecord,
} from "../services/recordsClient.mjs";

/** Recursively unwrap Vue reactive proxies into plain objects/arrays before structuredClone or serialization. */
function toPlain(value) {
  const raw = toRaw(value);
  if (Array.isArray(raw)) {
    return raw.map(toPlain);
  }
  if (raw && typeof raw === "object") {
    const proto = Object.getPrototypeOf(raw);
    if (proto === Object.prototype || proto === null) {
      const out = {};
      for (const [key, entry] of Object.entries(raw)) {
        out[key] = toPlain(entry);
      }
      return out;
    }
  }
  return raw;
}

export function localDate(d = new Date()) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

let singleton = null;

export function useDiaryStore() {
  if (singleton) return singleton;

  const state = reactive({
    view: "write",
    mode: "real",
    catalogType: "pos_1",
    catalogStage: null,
    cardFilter: null,
    recordTab: "text",
    policy: "single",
    text: "",
    date: localDate(),
    page: 0,
    search: "",
    favoritesOnly: false,
    sortOldest: false,
    emotionFilter: "",
    archiveTab: "records",
    statsTab: "count",
    month: localDate().slice(0, 7),
    statsDate: "",
    dateFilter: "",
    returnToStats: false,
    entryFrom: "write",
    selected: null,
    editing: false,
    sessions: [],
    currentEntryId: null,
    savedText: null,
    preview: false,
    status: "",
    error: false,
    busy: false,
    deleteConfirm: false,
    clearDraftConfirm: false,
    clearAllConfirm: false,
  });

  const collectedCards = ref([]);
  const legacyMigrationEntries = ref([]);
  const loading = ref(true);
  const storeReady = ref(false);
  const lastStorageError = ref(null);
  const storageMessage = ref("계정 기록을 불러오는 중…");
  const savingRetry = ref(false);
  const generation = ref(0);
  const savedGeneration = ref(0);
  const incomingBackup = ref(null);
  const backupPlan = ref(null);
  const restoringBackup = ref(false);
  const celebration = ref(null);
  const analyzingIds = ref(new Set());

  const infoModal = ref({ open: false, title: "", copy: "", isPrompt: false, promptOffset: 0 });
  const confirmModal = ref({
    open: false,
    title: "삭제 확인",
    copy: "",
    accept: "삭제",
    resolve: null,
  });
  const readFullModal = ref({ open: false, date: "", text: "" });
  const themeDialogState = ref({ open: false, themeId: null, mode: "light" });

  let activeUserId = null;
  let persistTimer = null;
  let toastTimer = 0;
  let celebrateTimer = 0;
  let openerReturnEl = null;
  const seenSlots = { real: null };
  const analysisCoordinator = createAnalysisCoordinator({
    onAnalyzingChange: (nextSet) => {
      analyzingIds.value = nextSet;
    },
  });

  const activeRecords = () => state.sessions;

  const compareRecords = (a, b) =>
    b.recordDate.localeCompare(a.recordDate) ||
    (b.createdAt || "").localeCompare(a.createdAt || "");

  const currentRecord = computed(
    () => activeRecords().find((r) => r.id === state.selected) || null,
  );

  const currentTab = computed(() => {
    if (state.view === "write") return "today";
    if (state.view === "settings" || state.view === "themes") return "settings";
    if (state.view === "entry") return state.entryFrom === "write" ? "today" : "records";
    if (state.view === "history") {
      if (state.archiveTab === "stats") return "review";
      if (state.archiveTab === "catalog") return "catalog";
      return "records";
    }
    return "today";
  });

  function draftStorageKey(userId = activeUserId) {
    return userId ? `moment:draft:${userId}` : null;
  }

  function legacyMigratedKey(userId = activeUserId) {
    return userId ? `moment:legacy-migrated:${userId}` : null;
  }

  function queryRecords({ month = "", date = "" } = {}) {
    return activeRecords()
      .filter(
        (x) =>
          (!month || x.recordDate.startsWith(month)) &&
          (!date || x.recordDate === date) &&
          (!state.cardFilter ||
            (() => {
              const c = DiaryCards.resolve(x);
              return (
                c.type === state.cardFilter.type &&
                c.stage === state.cardFilter.stage &&
                c.status === "ready"
              );
            })()),
      )
      .slice()
      .sort(compareRecords);
  }

  function announce(text) {
    if (typeof document === "undefined") return;
    const el = document.getElementById("announcer");
    if (el) el.textContent = text;
  }

  function showMiniToast(text) {
    if (typeof document === "undefined") return;
    let el = document.getElementById("moment-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "moment-toast";
      el.setAttribute("aria-hidden", "true");
      document.body.append(el);
    }
    el.textContent = "✓ " + text;
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
  }

  function markChanged() {
    generation.value++;
    storageMessage.value = "아직 저장되지 않은 변경이 있어요.";
  }

  function celebrateUnlocks() {
    if (loading.value || !storeReady.value) return;
    const keys = DiaryCards.unlockedKeys(activeRecords());
    if (seenSlots.real === null) {
      seenSlots.real = keys;
      return;
    }
    const fresh = DiaryCards.newlyUnlocked(seenSlots.real, keys);
    seenSlots.real = Array.from(new Set([...(seenSlots.real || []), ...keys]));
    if (fresh.length && document.documentElement.dataset.motion !== "off") {
      const [type, stage] = fresh[0].split(":");
      const info = CardexCore.type(type);
      celebration.value = {
        type,
        stage,
        title: fresh.length > 1 ? `새 카드 ${fresh.length}장을 만났어요` : "새 카드를 만났어요",
        subtitle: `${info.name} · ${stage}단계${fresh.length > 1 ? ` 외 ${fresh.length - 1}장` : ""}`,
        leaving: false,
      };
      clearTimeout(celebrateTimer);
      celebrateTimer = setTimeout(() => {
        if (celebration.value) celebration.value.leaving = true;
        setTimeout(() => {
          celebration.value = null;
        }, 500);
      }, 3200);
    }
  }

  function saveLocalDraft() {
    const key = draftStorageKey();
    if (!key || typeof localStorage === "undefined") return true;
    const payload = {
      text: state.text,
      date: state.date,
      policy: state.policy,
      currentEntryId: state.currentEntryId || null,
      savedText: state.savedText ?? null,
    };
    localStorage.setItem(key, JSON.stringify(payload));
    return true;
  }

  function loadLocalDraft(userId) {
    const key = draftStorageKey(userId);
    if (!key || typeof localStorage === "undefined") return null;
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async function persist() {
    clearTimeout(persistTimer);
    const savingGeneration = generation.value;
    storageMessage.value = "초안 저장 중";
    try {
      saveLocalDraft();
      savedGeneration.value = Math.max(savedGeneration.value, savingGeneration);
      if (state.status === lastStorageError.value) {
        state.error = false;
        state.status = "";
      }
      lastStorageError.value = null;
      storageMessage.value =
        generation.value === savedGeneration.value
          ? "초안 저장됨"
          : "최근 변경을 저장 중이에요.";
      return true;
    } catch (error) {
      lastStorageError.value = error.message;
      state.error = true;
      state.status = error.message;
      storageMessage.value = error.message;
      return false;
    }
  }

  function schedulePersist() {
    markChanged();
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      void persist();
    }, 400);
  }

  async function refreshCollectedCards() {
    try {
      const data = await fetchCollectedCards();
      collectedCards.value = Array.isArray(data?.cards) ? data.cards : [];
    } catch {
      // Keep UI responsive; CatalogView computes slots from activeRecords() as well.
    }
  }

  async function checkLegacyIndexedDb(userId) {
    const flagKey = legacyMigratedKey(userId);
    if (
      typeof window === "undefined" ||
      !window.indexedDB ||
      (flagKey && typeof localStorage !== "undefined" && localStorage.getItem(flagKey))
    ) {
      legacyMigrationEntries.value = [];
      return;
    }
    try {
      const storage = createDiaryStorage(window.indexedDB);
      const data = await storage.load();
      if (data?.sessions?.length) {
        legacyMigrationEntries.value = data.sessions;
      } else {
        legacyMigrationEntries.value = [];
      }
    } catch {
      legacyMigrationEntries.value = [];
    }
  }

  async function restore(userId = activeUserId) {
    if (!userId) {
      resetAccountState();
      return;
    }
    activeUserId = userId;
    loading.value = true;
    storeReady.value = false;
    lastStorageError.value = null;
    storageMessage.value = "계정 기록을 불러오는 중…";
    try {
      const [recordsRes, cardsRes] = await Promise.all([
        fetchAccountRecords(),
        fetchCollectedCards(),
      ]);
      state.sessions = recordsRes.records;
      collectedCards.value = Array.isArray(cardsRes?.cards) ? cardsRes.cards : [];

      const draft = loadLocalDraft(userId);
      state.text = typeof draft?.text === "string" ? draft.text : "";
      state.date = localDate();
      state.policy = draft?.policy === "multi" ? "multi" : "single";
      state.currentEntryId =
        draft?.currentEntryId && state.sessions.some((r) => r.id === draft.currentEntryId)
          ? draft.currentEntryId
          : null;
      state.savedText = state.currentEntryId ? draft?.savedText ?? null : null;

      storeReady.value = true;
      storageMessage.value = "계정 저장 준비됨";
      seenSlots.real = DiaryCards.unlockedKeys(state.sessions);
      await checkLegacyIndexedDb(userId);
    } catch (error) {
      storeReady.value = false;
      lastStorageError.value = error.message;
      state.error = true;
      state.status = error.message || "계정 기록을 불러오지 못했어요.";
      storageMessage.value = state.status;
    } finally {
      loading.value = false;
    }
  }

  function resetAccountState({ clearDraft = false } = {}) {
    clearTimeout(persistTimer);
    analysisCoordinator.cancelAllAnalyses();
    if (clearDraft && activeUserId && typeof localStorage !== "undefined") {
      const key = draftStorageKey(activeUserId);
      if (key) localStorage.removeItem(key);
    }
    activeUserId = null;
    state.sessions = [];
    state.text = "";
    state.savedText = null;
    state.currentEntryId = null;
    state.selected = null;
    state.view = "write";
    state.editing = false;
    state.deleteConfirm = false;
    state.clearDraftConfirm = false;
    state.clearAllConfirm = false;
    state.error = false;
    state.status = "";
    collectedCards.value = [];
    legacyMigrationEntries.value = [];
    incomingBackup.value = null;
    backupPlan.value = null;
    seenSlots.real = null;
    storeReady.value = false;
    loading.value = false;
    storageMessage.value = "로그인이 필요해요.";
  }

  async function migrateLegacyRecords() {
    if (!legacyMigrationEntries.value.length) return;
    loading.value = true;
    try {
      const res = await importAccountRecords(legacyMigrationEntries.value);
      const flagKey = legacyMigratedKey();
      if (flagKey && typeof localStorage !== "undefined") {
        localStorage.setItem(flagKey, new Date().toISOString());
      }
      legacyMigrationEntries.value = [];
      await restore(activeUserId);
      state.error = false;
      state.status = `브라우저에 있던 기록 ${res.added}편을 계정으로 가져왔어요.`;
      showMiniToast("기록을 가져왔어요");
    } catch (error) {
      state.error = true;
      state.status = error.message || "기존 기록 가져오기에 실패했어요.";
    } finally {
      loading.value = false;
    }
  }

  function dismissLegacyMigration() {
    const flagKey = legacyMigratedKey();
    if (flagKey && typeof localStorage !== "undefined") {
      localStorage.setItem(flagKey, "dismissed");
    }
    legacyMigrationEntries.value = [];
  }

  function askConfirm(copy, opener = null, { title = "삭제 확인", accept = "삭제" } = {}) {
    openerReturnEl = opener || (typeof document !== "undefined" ? document.activeElement : null);
    return new Promise((resolve) => {
      confirmModal.value = {
        open: true,
        title,
        copy,
        accept,
        resolve: (accepted) => {
          confirmModal.value.open = false;
          openerReturnEl?.focus?.({ preventScroll: true });
          openerReturnEl = null;
          resolve(accepted);
        },
      };
    });
  }

  function openInfo(title, copy, opener = null, isPrompt = false) {
    openerReturnEl = opener || (typeof document !== "undefined" ? document.activeElement : null);
    infoModal.value = {
      open: true,
      title,
      copy: isPrompt
        ? `${DiaryCore.writingPrompt(state.date, 0)}\n\n질문은 참고용이에요. 떠오르는 대로 자유롭게 적어 보세요.`
        : copy,
      isPrompt,
      promptOffset: 0,
    };
  }

  function nextWritingPrompt() {
    infoModal.value.promptOffset += 1;
    const prompt = DiaryCore.writingPrompt(state.date, infoModal.value.promptOffset);
    infoModal.value.copy = `${prompt}\n\n질문은 참고용이에요. 떠오르는 대로 자유롭게 적어 보세요.`;
    announce(prompt);
  }

  function closeInfo() {
    infoModal.value.open = false;
    openerReturnEl?.focus?.({ preventScroll: true });
    openerReturnEl = null;
  }

  function openReadFull(record, opener = null) {
    if (!record) return;
    openerReturnEl = opener || (typeof document !== "undefined" ? document.activeElement : null);
    readFullModal.value = {
      open: true,
      date: record.recordDate,
      text: record.text,
    };
  }

  function closeReadFull() {
    readFullModal.value.open = false;
    openerReturnEl?.focus?.({ preventScroll: true });
    openerReturnEl = null;
  }

  function openThemePreview(themeId, mode, opener = null) {
    openerReturnEl = opener || (typeof document !== "undefined" ? document.activeElement : null);
    themeDialogState.value = {
      open: true,
      themeId,
      mode,
    };
  }

  function closeThemePreview() {
    themeDialogState.value.open = false;
    openerReturnEl?.focus?.({ preventScroll: true });
    openerReturnEl = null;
  }

  function navigateTab(tabId) {
    if (loading.value) return;
    state.editing = false;
    state.deleteConfirm = false;
    state.error = false;
    state.status = "";
    if (tabId === "today") {
      state.date = localDate();
      state.view = "write";
    } else if (tabId === "records") {
      state.view = "history";
      state.archiveTab = "records";
      state.dateFilter = "";
      state.cardFilter = null;
    } else if (tabId === "review") {
      state.view = "history";
      state.archiveTab = "stats";
      state.cardFilter = null;
    } else if (tabId === "catalog") {
      state.view = "history";
      state.archiveTab = "catalog";
      state.cardFilter = null;
    } else if (tabId === "settings") {
      state.view = "settings";
    }
  }

  function openRecord(id) {
    if (state.view !== "entry") {
      state.entryFrom = state.view === "write" ? "write" : "history";
    }
    state.selected = id;
    state.recordTab = "card";
    state.view = "entry";
    state.editing = false;
    state.deleteConfirm = false;
  }

  async function saveRecord() {
    if (loading.value) return false;
    state.error = false;
    state.status = "";
    try {
      const v = DiaryCore.validate([{ text: state.text }]);
      state.date = localDate();
      const previous =
        state.policy === "single"
          ? state.sessions.filter((x) => x.recordDate === state.date).at(-1)
          : state.sessions.find((x) => x.id === state.currentEntryId);
      if (!previous && state.sessions.length >= ACCOUNT_MAX_RECORDS) {
        throw Error(`기록은 계정당 최대 ${ACCOUNT_MAX_RECORDS}편까지 보관할 수 있어요.`);
      }

      let savedEntry;
      if (previous) {
        analysisCoordinator.cancelRecordAnalysis(previous.id);
        savedEntry = await updateAccountRecord(previous.id, {
          text: v.records[0].text,
          recordDate: previous.recordDate || state.date,
        });
        Object.assign(previous, savedEntry);
        savedEntry = previous;
      } else {
        const candidateId = MomentRecordId.create();
        savedEntry = await createAccountRecord({
          id: candidateId,
          text: v.records[0].text,
          recordDate: state.date,
          favorite: false,
        });
        state.sessions.push({
          ...savedEntry,
          analysis: { status: "pending" },
        });
        savedEntry = state.sessions[state.sessions.length - 1];
      }

      state.savedText = state.text;
      state.currentEntryId = savedEntry.id;
      state.selected = savedEntry.id;
      state.preview = false;
      state.view = "write";
      state.status = "기록을 계정에 저장했어요. 감정을 분석하고 있어요…";

      markChanged();
      await persist();
      showMiniToast("저장했어요");
      await refreshCollectedCards();
      void analyzeRecord(savedEntry);
      celebrateUnlocks();
      return true;
    } catch (e) {
      state.error = true;
      state.status = e.message;
      document.getElementById("diary-text")?.focus();
      return false;
    }
  }

  async function startNewEntry() {
    if (loading.value) return;
    state.text = "";
    state.savedText = null;
    state.currentEntryId = null;
    state.date = localDate();
    state.view = "write";
    state.error = false;
    state.status = "";
    markChanged();
    await persist();
  }

  async function analyzeRecord(record) {
    if (!record) {
      return { ignored: true, ok: false };
    }
    return analysisCoordinator.runRecordAnalysis({
      record,
      getRecordById: (id) => state.sessions.find((r) => r.id === id) || null,
      isRealMode: () => Boolean(activeUserId),
      isActiveRecord: (item) => Boolean(item),
      onApplyAnalysis: async (currentRecord, nextAnalysis) => {
        currentRecord.analysis = nextAnalysis;
        await refreshCollectedCards();
        if (nextAnalysis.status === "valid") {
          state.error = false;
          state.status = "감정 분석을 마쳤어요.";
          celebrateUnlocks();
        } else if (!lastStorageError.value) {
          state.error = true;
          state.status =
            nextAnalysis.message || "감정 분석에 실패했어요. 기록은 안전하게 보관돼요.";
        }
      },
    });
  }

  async function retryAnalysis(recordId) {
    if (loading.value) return false;
    const target = state.sessions.find((r) => r.id === recordId);
    if (!target || analysisCoordinator.isAnalyzing(target.id)) return false;
    target.analysis = { status: "pending" };
    state.error = false;
    state.status = "감정을 다시 분석하고 있어요…";
    const outcome = await analyzeRecord(target);
    return Boolean(outcome?.ok);
  }

  async function retrySave() {
    if (loading.value) return;
    if (!storeReady.value) {
      await restore(activeUserId);
      return;
    }
    savingRetry.value = true;
    try {
      await persist();
    } finally {
      savingRetry.value = false;
    }
  }

  async function clearDraft(opener = null) {
    if (loading.value) return;
    const accepted = await askConfirm("초안만 지웁니다. 저장된 기록은 유지됩니다.", opener);
    if (!accepted) return;
    state.text = "";
    state.savedText = null;
    state.currentEntryId = null;
    state.clearDraftConfirm = false;
    state.error = false;
    state.status = "";
    markChanged();
    await persist();
  }

  async function deleteAllRecords(opener = null) {
    if (loading.value) return;
    const hasUnlocked =
      collectedCards.value.length > 0 ||
      state.sessions.some((r) => DiaryCards.resolve(r).status === "ready");

    const accepted1 = await askConfirm(
      hasUnlocked
        ? "계정의 모든 기록과 초안을 삭제합니다. 수집·해금된 카드 도감 기록도 함께 삭제됩니다."
        : "계정의 모든 기록과 초안을 삭제합니다. 화면 설정은 유지됩니다.",
      opener,
    );
    if (!accepted1) return;

    if (hasUnlocked) {
      const accepted2 = await askConfirm(
        "전체 기록을 삭제하면 지금까지 해금한 감정 카드 도감 기록도 모두 삭제되어 미발견 상태로 돌아갑니다. 정말 모두 삭제할까요?",
        opener,
        { title: "해금 기록 포함 전체 삭제 2차 확인", accept: "기록·해금 기록 모두 삭제" },
      );
      if (!accepted2) return;
    }

    try {
      analysisCoordinator.cancelAllAnalyses();
      await deleteAllAccountRecords({ confirmCardDeletion: true });
      state.text = "";
      state.savedText = null;
      state.currentEntryId = null;
      state.sessions = [];
      collectedCards.value = [];
      state.selected = null;
      state.clearAllConfirm = false;
      state.error = false;
      state.status = "모든 기록과 해금된 카드 기록을 삭제했어요.";
      seenSlots.real = [];
      markChanged();
      await persist();
      showMiniToast("모두 삭제했어요");
    } catch (error) {
      state.error = true;
      state.status = error.message || "전체 삭제에 실패했어요.";
    }
  }

  async function saveEditedRecord(nextText) {
    if (loading.value) return false;
    state.error = false;
    state.status = "";
    try {
      DiaryCore.validate([{ text: nextText }]);
      const entry = currentRecord.value;
      if (!entry) return false;
      analysisCoordinator.cancelRecordAnalysis(entry.id);

      const updated = await updateAccountRecord(entry.id, {
        text: nextText,
        recordDate: entry.recordDate,
      });
      Object.assign(entry, updated);
      entry.analysis = { status: "pending" };
      state.editing = false;
      state.status = "기록을 수정했어요. 감정을 분석하고 있어요…";
      if (state.currentEntryId === entry.id) {
        state.text = nextText;
        state.savedText = nextText;
      }
      markChanged();
      await persist();
      await refreshCollectedCards();
      seenSlots.real = DiaryCards.unlockedKeys(state.sessions);
      showMiniToast("저장했어요");
      void analyzeRecord(entry);
      return true;
    } catch (e) {
      state.error = true;
      state.status = e.message;
      return false;
    }
  }

  async function deleteCurrentRecord(opener = null) {
    if (loading.value) return;
    const index = state.sessions.findIndex((r) => r.id === state.selected);
    if (index < 0) return;
    const target = state.sessions[index];

    let impact = null;
    try {
      impact = await fetchDeleteImpact(target.id);
    } catch {
      const localCard = DiaryCards.resolve(target);
      impact = {
        has_card_unlock: localCard.status === "ready",
        will_relock_card:
          localCard.status === "ready" &&
          state.sessions.filter((r) => {
            const c = DiaryCards.resolve(r);
            return r.id !== target.id && c.status === "ready" && c.cardKey === localCard.cardKey;
          }).length === 0,
        remaining_records_with_card: 0,
      };
    }

    const label = impact.has_card_unlock ? cardLabel(target) : null;
    const firstCopy = impact.has_card_unlock
      ? `이 기록을 삭제합니다.\n연결된 감정 카드(${label}) 해금 기록도 함께 삭제됩니다.`
      : "이 기록을 삭제합니다. 통계와 도감에도 반영됩니다.";
    const accepted1 = await askConfirm(firstCopy, opener);
    if (!accepted1) return;

    if (impact.has_card_unlock) {
      const secondCopy = impact.will_relock_card
        ? `이 기록을 삭제하면 '${label}' 카드 해금 기록도 함께 삭제되어 도감에서 다시 미발견 상태로 돌아갑니다. 계속 삭제할까요?`
        : `이 기록을 삭제하면 이 기록으로 얻은 '${label}' 카드 해금 이력이 삭제됩니다(같은 카드를 해금한 다른 기록 ${impact.remaining_records_with_card}편은 유지). 계속 삭제할까요?`;
      const accepted2 = await askConfirm(secondCopy, opener, {
        title: "해금 기록 삭제 2차 확인",
        accept: "기록·해금 기록 삭제",
      });
      if (!accepted2) return;
    }

    try {
      analysisCoordinator.cancelRecordAnalysis(target.id);
      await deleteAccountRecord(target.id, { confirmCardDeletion: true });
      state.sessions.splice(index, 1);
      if (state.currentEntryId === target.id) {
        state.currentEntryId = null;
        state.savedText = null;
      }
      state.selected = null;
      state.view = state.entryFrom === "write" ? "write" : "history";
      state.deleteConfirm = false;
      await refreshCollectedCards();
      seenSlots.real = DiaryCards.unlockedKeys(state.sessions);
      state.error = false;
      state.status = impact.has_card_unlock
        ? "기록과 연결된 카드 해금 기록을 삭제했어요."
        : "기록을 삭제했어요.";
      markChanged();
      await persist();
      showMiniToast("삭제했어요");
    } catch (error) {
      state.error = true;
      state.status = error.message || "기록 삭제에 실패했어요.";
    }
  }

  async function toggleFavorite() {
    const r = currentRecord.value;
    if (!r || loading.value) return;
    const previous = Boolean(r.favorite);
    r.favorite = !previous;
    try {
      const updated = await setAccountRecordFavorite(r.id, r.favorite);
      Object.assign(r, updated);
    } catch (error) {
      r.favorite = previous;
      state.error = true;
      state.status = error.message || "즐겨찾기 변경에 실패했어요.";
    }
  }

  async function downloadCurrentCardPng() {
    const record = currentRecord.value;
    if (!record) return;
    const card = DiaryCards.resolve(record);
    if (!["ready", "blank"].includes(card.status) || state.busy) return;
    state.busy = true;
    state.error = false;
    try {
      await exportCardPng(record, "real", state.date);
      state.status = "카드 이미지 다운로드를 요청했어요.";
    } catch (e) {
      state.error = true;
      state.status = e.message;
    } finally {
      state.busy = false;
    }
  }

  async function setPolicy(nextPolicy) {
    if (loading.value || !["single", "multi"].includes(nextPolicy)) return;
    state.policy = nextPolicy;
    state.currentEntryId = null;
    state.error = false;
    state.status = "기록 방식을 바꿨어요. 기존 기록은 유지돼요.";
    markChanged();
    await persist();
  }

  function exportBackup() {
    try {
      triggerBackupDownload(state.sessions, localDate());
      state.error = false;
      state.status = "백업 파일 다운로드를 요청했어요.";
    } catch (error) {
      state.error = true;
      state.status = error.message;
    }
  }

  async function selectBackupFile(file) {
    incomingBackup.value = null;
    backupPlan.value = null;
    if (!file) return;
    try {
      if (file.size > BACKUP_MAX_BYTES) throw Error("백업 파일은 5MiB 이하여야 해요.");
      incomingBackup.value = parseBackupText(await file.text());
      backupPlan.value = planBackupMerge(state.sessions, incomingBackup.value);
      state.error = false;
      state.status = "복원 내용을 확인해 주세요. 아직 기록은 변경되지 않았어요.";
    } catch (error) {
      state.error = true;
      state.status = error.message;
    }
  }

  function cancelBackupImport() {
    incomingBackup.value = null;
    backupPlan.value = null;
  }

  async function confirmBackupImport() {
    if (!incomingBackup.value || restoringBackup.value) return;
    const plan = planBackupMerge(state.sessions, incomingBackup.value);
    backupPlan.value = plan;
    if (!plan.allowed || !plan.added) return;

    restoringBackup.value = true;
    loading.value = true;
    try {
      const existingIds = new Set(state.sessions.map((r) => r.id));
      const newEntries = incomingBackup.value.filter((r) => !existingIds.has(r.id));
      await importAccountRecords(newEntries);
      incomingBackup.value = null;
      backupPlan.value = null;
      await restore(activeUserId);
      state.status = "새 기록을 계정에 합쳤어요. 기존 기록과 초안은 유지했어요.";
      state.error = false;
    } catch (error) {
      state.error = true;
      state.status = error.message;
    } finally {
      restoringBackup.value = false;
      loading.value = false;
    }
  }

  function initGlobalListeners() {
    if (typeof window === "undefined") return () => {};
    const updateSize = () => {
      document.documentElement.style.setProperty(
        "--app-height",
        (window.visualViewport?.height || window.innerHeight) + "px",
      );
      if (window.visualViewport) {
        document.documentElement.classList.toggle(
          "keyboard-open",
          window.visualViewport.height < window.innerHeight * 0.75,
        );
      }
    };
    const onFocus = () => {
      if (state.view === "write" && state.date !== localDate()) {
        state.date = localDate();
      }
    };
    const onBeforeUnload = (e) => {
      if (generation.value !== savedGeneration.value) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const onVisibilityChange = () => {
      if (
        document.visibilityState === "hidden" &&
        generation.value !== savedGeneration.value &&
        !loading.value
      ) {
        void persist();
      }
    };
    const onHashChange = () => {
      history.replaceState(null, "", location.pathname + location.search);
    };

    updateSize();
    if (location.hash) onHashChange();
    window.visualViewport?.addEventListener("resize", updateSize);
    window.addEventListener("resize", updateSize);
    window.addEventListener("focus", onFocus);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("hashchange", onHashChange);

    window.DiaryReview = Object.freeze({
      getState: () => structuredClone(toPlain(state)),
      isReady: () => !loading.value,
      localDate,
    });

    return () => {
      window.visualViewport?.removeEventListener("resize", updateSize);
      window.removeEventListener("resize", updateSize);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("hashchange", onHashChange);
    };
  }

  singleton = {
    state,
    collectedCards,
    legacyMigrationEntries,
    loading,
    storeReady,
    lastStorageError,
    storageMessage,
    savingRetry,
    generation,
    savedGeneration,
    incomingBackup,
    backupPlan,
    restoringBackup,
    celebration,
    analyzingIds,
    infoModal,
    confirmModal,
    readFullModal,
    themeDialogState,
    activeRecords,
    compareRecords,
    currentRecord,
    currentTab,
    queryRecords,
    announce,
    restore,
    resetAccountState,
    migrateLegacyRecords,
    dismissLegacyMigration,
    persist,
    schedulePersist,
    markChanged,
    askConfirm,
    openInfo,
    nextWritingPrompt,
    closeInfo,
    openReadFull,
    closeReadFull,
    openThemePreview,
    closeThemePreview,
    navigateTab,
    openRecord,
    saveRecord,
    startNewEntry,
    retrySave,
    retryAnalysis,
    isAnalyzingRecord: (id) => analyzingIds.value.has(id),
    clearDraft,
    deleteAllRecords,
    saveEditedRecord,
    deleteCurrentRecord,
    toggleFavorite,
    downloadCurrentCardPng,
    setPolicy,
    exportBackup,
    selectBackupFile,
    cancelBackupImport,
    confirmBackupImport,
    initGlobalListeners,
  };

  return singleton;
}
