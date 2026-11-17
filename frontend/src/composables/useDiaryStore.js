import { computed, reactive, ref } from "vue";
import {
  CardexCore,
  DiaryCards,
  DiaryCore,
  MomentRecordId,
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

export function localDate(d = new Date()) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function createExampleRecords() {
  return Array.from({ length: 65 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - Math.floor(i / 2));
    return {
      id: "sample-" + i,
      text: [
        "퇴근길에 작은 꽃을 샀다. 별일 없는 하루에도 좋아하는 순간이 있었다.",
        "오랜만에 친구와 산책했다. 천천히 이야기하니 마음이 가벼워졌다.",
        "바쁜 하루 끝, 따뜻한 차 한 잔으로 나를 돌봤다.",
      ][i % 3],
      recordDate: localDate(d),
      createdAt: d.toISOString(),
      updatedAt: d.toISOString(),
      version: 1,
      analysis:
        i === 0
          ? { status: "pending" }
          : i === 63
            ? { status: "error" }
            : {
                status: "valid",
                version: i === 64 ? 0 : 1,
                taxonomy_version: CardexCore.TAXONOMY,
                probabilities: Object.fromEntries(
                  CardexCore.IDS.map((id, j) => {
                    if (i === 61) {
                      return [id, 1 / CardexCore.IDS.length];
                    }
                    if (i === 62) {
                      return [id, j < 2 ? 0.35 : 0.3 / (CardexCore.IDS.length - 2)];
                    }
                    const score =
                      [0.25, 0.5, 0.85][Math.floor((i - 1) / CardexCore.IDS.length) % 3];
                    return [
                      id,
                      j === (i - 1) % CardexCore.IDS.length
                        ? score
                        : (1 - score) / (CardexCore.IDS.length - 1),
                    ];
                  }),
                ),
              },
    };
  });
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

  const examples = reactive(createExampleRecords());
  const loading = ref(true);
  const storeReady = ref(false);
  const lastStorageError = ref(null);
  const storageMessage = ref("기록을 불러오는 중…");
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

  let storage = null;
  let persistTimer = null;
  let undoTimer = null;
  let toastTimer = 0;
  let celebrateTimer = 0;
  let openerReturnEl = null;
  let pendingDeleted = null;
  const seenSlots = { real: null, example: null };
  const analysisCoordinator = createAnalysisCoordinator({
    onAnalyzingChange: (nextSet) => {
      analyzingIds.value = nextSet;
    },
  });

  const activeRecords = () => (state.mode === "example" ? examples : state.sessions);

  const compareRecords = (a, b) =>
    b.recordDate.localeCompare(a.recordDate) ||
    (b.createdAt || "").localeCompare(a.createdAt || "");

  const currentRecord = computed(() =>
    activeRecords().find((r) => r.id === state.selected) || null,
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

  function hideUndo() {
    clearTimeout(undoTimer);
    undoTimer = null;
    pendingDeleted = null;
    if (typeof document === "undefined") return;
    const toast = document.getElementById("toast");
    if (toast) toast.hidden = true;
  }

  function showUndo(deleted) {
    if (typeof document === "undefined") return;
    const toast = document.getElementById("toast");
    if (!toast) return;
    hideUndo();
    pendingDeleted = deleted;
    const copyEl = toast.querySelector("#toast-copy");
    if (copyEl) copyEl.textContent = "기록을 삭제했어요.";
    toast.hidden = false;

    const arm = () => {
      clearTimeout(undoTimer);
      undoTimer = setTimeout(hideUndo, 8000);
    };
    toast.onmouseenter = toast.onfocusin = () => clearTimeout(undoTimer);
    toast.onmouseleave = toast.onfocusout = arm;
    arm();

    const undoBtn = toast.querySelector("[data-toast-undo]");
    if (undoBtn) {
      undoBtn.onclick = async () => {
        const snap = pendingDeleted;
        hideUndo();
        if (!snap) return;
        if (state.mode !== snap.mode || activeRecords().some((r) => r.id === snap.entry.id)) return;
        if (snap.mode === "real" && state.sessions.length >= DiaryCore.MAX_RECORDS) {
          state.error = true;
          state.status = "보관 한도 30편에 도달해 되돌릴 수 없어요.";
          return;
        }
        activeRecords().splice(
          Math.min(Math.max(snap.index, 0), activeRecords().length),
          0,
          snap.entry,
        );
        if (snap.mode === "real" && snap.currentEntryId === snap.entry.id) {
          state.currentEntryId = snap.currentEntryId;
          state.savedText = snap.savedText;
        }
        state.error = false;
        state.status = "삭제한 기록을 되돌렸어요.";
        if (snap.mode === "real") {
          markChanged();
          if (!(await persist())) {
            state.status = "되돌린 기록을 저장하지 못했어요. 저장 재시도를 눌러 주세요.";
          }
        }
        announce(state.status);
      };
    }
  }

  function snapshot() {
    return {
      text: state.text,
      date: state.date,
      sessions: state.sessions,
      policy: state.policy,
      currentEntryId: state.currentEntryId || null,
      savedText: state.savedText ?? null,
    };
  }

  function markChanged() {
    generation.value++;
    storageMessage.value = "아직 저장되지 않은 변경이 있어요.";
  }

  function celebrateUnlocks() {
    const mode = state.mode;
    if (mode === "real" && (loading.value || !storeReady.value)) return;
    const keys = DiaryCards.unlockedKeys(activeRecords());
    if (mode === "real" && seenSlots.real === null) {
      seenSlots.real = keys;
      return;
    }
    const fresh = DiaryCards.newlyUnlocked(seenSlots[mode], keys);
    seenSlots[mode] = Array.from(new Set([...(seenSlots[mode] || []), ...keys]));
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

  async function persist() {
    clearTimeout(persistTimer);
    const savingGeneration = generation.value;
    storageMessage.value = "초안 저장 중";
    try {
      if (!storeReady.value || !storage) {
        throw Error("저장소를 사용할 수 없어요. 재시도하거나 내용을 복사해 주세요.");
      }
      await storage.save(snapshot());
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
    }, 500);
  }

  async function restore() {
    loading.value = true;
    try {
      const candidate = createDiaryStorage(window.indexedDB);
      const data = await candidate.load();
      if (generation.value !== savedGeneration.value && data) {
        throw Error("보관된 기록이 있어요. 현재 내용을 복사한 뒤 새로고침해 주세요.");
      }
      storage = candidate;
      storeReady.value = true;
      if (data) {
        state.text = data.text;
        state.date = data.date;
        state.sessions = data.sessions;
        state.policy = data.policy;
        state.currentEntryId = data.currentEntryId;
        state.savedText = data.savedText;
      }
      storageMessage.value = "자동 저장 준비됨";
      if (generation.value !== savedGeneration.value || data?.migratedFrom === 1) {
        await persist();
      }
    } catch (error) {
      storeReady.value = false;
      state.error = true;
      state.status =
        "저장소를 열지 못했어요. 메모리에서 계속 작성할 수 있어요. " + error.message;
      storageMessage.value = state.status;
    } finally {
      loading.value = false;
      celebrateUnlocks();
    }
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

  async function saveRecord(opener = null) {
    if (loading.value) return false;
    if (state.mode === "example") {
      const accepted = await askConfirm(
        "예시 모드를 끄고 지금 쓴 내용을 실제 기록으로 저장합니다. 예시 기록은 실제 기록에 섞이지 않아요.",
        opener,
        { title: "실제 기록으로 저장", accept: "실제 기록으로 저장" },
      );
      if (!accepted) return false;
    }
    state.error = false;
    state.status = "";
    try {
      const v = DiaryCore.validate([{ text: state.text }]);
      state.mode = "real";
      state.date = localDate();
      const now = new Date().toISOString();
      const previous =
        state.policy === "single"
          ? state.sessions.filter((x) => x.recordDate === state.date).at(-1)
          : state.sessions.find((x) => x.id === state.currentEntryId);
      if (!previous && state.sessions.length >= DiaryCore.MAX_RECORDS) {
        throw Error("기록은 최대 30편까지 보관할 수 있어요.");
      }
      const entry = {
        id: previous?.id || MomentRecordId.create(),
        favorite: previous?.favorite ?? false,
        text: v.records[0].text,
        recordDate: previous?.recordDate || state.date,
        version: (previous?.version || 0) + 1,
        analysis: { status: "pending" },
        createdAt: previous?.createdAt || now,
        updatedAt: now,
      };
      if (previous) {
        analysisCoordinator.cancelRecordAnalysis(previous.id);
        Object.assign(previous, entry);
      } else {
        state.sessions.push(entry);
      }
      const savedTarget = previous || entry;

      state.savedText = state.text;
      state.currentEntryId = entry.id;
      state.selected = entry.id;
      state.status = "기록을 저장 중이에요. 감정 분석은 준비 중이에요.";
      state.preview = false;
      state.view = "write";

      markChanged();
      if (await persist()) {
        state.status = "기록을 저장했어요. 감정을 분석하고 있어요…";
        showMiniToast("저장했어요");
        void analyzeRecord(savedTarget);
      }
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
    if (state.mode === "real") {
      markChanged();
      await persist();
    }
  }

  async function analyzeRecord(record) {
    if (!record || state.mode !== "real") {
      return { ignored: true, ok: false };
    }
    return analysisCoordinator.runRecordAnalysis({
      record,
      getRecordById: (id) => state.sessions.find((r) => r.id === id) || null,
      isRealMode: () => state.mode === "real",
      isActiveRecord: (item) => Boolean(item) && pendingDeleted?.entry?.id !== item.id,
      onApplyAnalysis: async (currentRecord, nextAnalysis) => {
        currentRecord.analysis = nextAnalysis;
        markChanged();
        const saved = await persist();
        if (nextAnalysis.status === "valid") {
          if (saved) {
            state.error = false;
            state.status = "감정 분석을 마쳤어요.";
          }
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
    if (loading.value || state.mode !== "real") return false;
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
      await restore();
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
    hideUndo();
    const accepted = await askConfirm(
      "실제 기록 전체와 초안을 삭제합니다. 표시 설정과 예시 기록은 유지됩니다.",
      opener,
    );
    if (!accepted) return;
    analysisCoordinator.cancelAllAnalyses();
    state.text = "";
    state.savedText = null;
    state.currentEntryId = null;
    state.sessions = [];
    state.selected = null;
    state.clearAllConfirm = false;
    state.error = false;
    state.status = "";
    markChanged();
    await persist();
    celebrateUnlocks();
  }

  async function saveEditedRecord(nextText) {
    if (loading.value) return false;
    state.error = false;
    state.status = "";
    try {
      DiaryCore.validate([{ text: nextText }]);
      const entry = currentRecord.value;
      if (!entry) return false;
      if (state.mode === "real") {
        analysisCoordinator.cancelRecordAnalysis(entry.id);
      }
      Object.assign(entry, {
        text: nextText,
        updatedAt: new Date().toISOString(),
        version: (entry.version || 1) + 1,
        analysis: { status: "pending" },
      });
      state.editing = false;
      state.status = state.mode === "example" ? "예시를 수정했어요." : "기록을 수정했어요.";
      if (state.mode === "real" && state.currentEntryId === entry.id) {
        state.text = nextText;
        state.savedText = nextText;
      }
      if (state.mode === "real") {
        markChanged();
        if (await persist()) {
          state.status = "기록을 수정했어요. 감정을 분석하고 있어요…";
          showMiniToast("저장했어요");
          void analyzeRecord(entry);
        }
      }
      celebrateUnlocks();
      return true;
    } catch (e) {
      state.error = true;
      state.status = e.message;
      return false;
    }
  }

  async function deleteCurrentRecord(opener = null) {
    if (loading.value) return;
    const accepted = await askConfirm(
      "이 기록을 삭제합니다. 통계와 도감에도 반영됩니다.",
      opener,
    );
    if (!accepted) return;

    const list = activeRecords();
    const index = list.findIndex((r) => r.id === state.selected);
    if (index < 0) return;

    if (state.mode === "real") {
      analysisCoordinator.cancelRecordAnalysis(list[index].id);
    }
    const deleted = {
      entry: structuredClone(list[index]),
      index,
      mode: state.mode,
      currentEntryId: state.currentEntryId,
      savedText: state.savedText,
    };
    list.splice(index, 1);
    if (state.mode === "real" && state.currentEntryId === state.selected) {
      state.currentEntryId = null;
      state.savedText = null;
    }
    state.view = state.entryFrom === "write" ? "write" : "history";
    state.deleteConfirm = false;
    showUndo(deleted);

    if (state.mode === "real") {
      markChanged();
      if (await persist()) {
        state.status = "기록을 삭제했어요.";
        showMiniToast("삭제했어요");
      }
    }
    celebrateUnlocks();
  }

  async function toggleFavorite() {
    const r = currentRecord.value;
    if (!r || loading.value) return;
    const previous = Boolean(r.favorite);
    r.favorite = !previous;
    if (state.mode === "real") {
      markChanged();
      if (!(await persist())) {
        r.favorite = previous;
      }
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
      await exportCardPng(record, state.mode, state.date);
      state.status =
        state.mode === "example"
          ? "예시 이미지 다운로드를 요청했어요."
          : "카드 이미지 다운로드를 요청했어요.";
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

  function toggleExampleMode() {
    if (loading.value) return;
    hideUndo();
    state.mode = state.mode === "real" ? "example" : "real";
    state.selected =
      activeRecords().find((r) => DiaryCards.resolve(r).status === "ready")?.id || null;
    state.view = "history";
    state.archiveTab = "records";
    state.page = 0;
    state.cardFilter = null;
    state.dateFilter = "";
    state.error = false;
    state.status = "";
    celebrateUnlocks();
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
      clearTimeout(persistTimer);
      if (generation.value !== savedGeneration.value && !(await persist())) {
        throw Error("현재 변경을 먼저 저장해 주세요.");
      }
      if (!storeReady.value || !storage) {
        throw Error("저장소를 사용할 수 없어요. 기존 기록은 유지됩니다.");
      }
      analysisCoordinator.cancelAllAnalyses();
      const mergedEntries = plan.entries.map((r) => ({
        ...r,
        analysis: r.analysis || { status: "pending" },
      }));
      await storage.save({ ...snapshot(), sessions: mergedEntries });
      state.sessions = mergedEntries;
      incomingBackup.value = null;
      backupPlan.value = null;
      state.status = "새 기록을 합쳤어요. 기존 기록과 초안은 유지했어요.";
      state.error = false;
      celebrateUnlocks();
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
      getState: () => structuredClone({ ...state, sessions: state.sessions.map((s) => ({ ...s })) }),
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
    examples,
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
    toggleExampleMode,
    exportBackup,
    selectBackupFile,
    cancelBackupImport,
    confirmBackupImport,
    initGlobalListeners,
  };

  return singleton;
}
