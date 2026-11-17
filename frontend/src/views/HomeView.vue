<script setup>
import { computed, nextTick, ref } from "vue";
import { DiaryCards, DiaryCore, cardLabel } from "../domain/index.js";
import { OBJECT_ASSETS } from "../services/assets.js";
import { useDiaryStore } from "../composables/useDiaryStore.js";
import CharacterMark from "../components/CharacterMark.vue";
import RecordRow from "../components/RecordRow.vue";

const store = useDiaryStore();
const draftMoreRef = ref(null);
const draftMoreTriggerRef = ref(null);

const recentRecords = computed(() =>
  store.activeRecords().slice().sort(store.compareRecords).slice(0, 3),
);
const latestRecord = computed(() => recentRecords.value[0] || null);
const latestCard = computed(() => DiaryCards.resolve(latestRecord.value));
const latestAnalyzing = computed(() =>
  Boolean(latestRecord.value && store.isAnalyzingRecord(latestRecord.value.id)),
);
const latestStatusText = computed(() => {
  if (storageFailed.value) return "저장 확인이 필요해요";
  if (latestAnalyzing.value) return "감정 분석 중이에요…";
  if (latestCard.value.status === "ready") return "감정 분석을 마쳤어요";
  if (latestCard.value.status === "error") {
    return latestRecord.value?.analysis?.message || "감정 분석에 실패했어요 · 기록은 보관돼요";
  }
  return "기록을 보관했어요 · 분석은 준비 중";
});

const isSavedMulti = computed(
  () => store.state.policy === "multi" && store.state.savedText === store.state.text,
);

const storageFailed = computed(
  () => Boolean(!store.loading.value && (store.lastStorageError.value || !store.storeReady.value)),
);

const primaryAction = computed(() => {
  if (store.lastStorageError.value) return "retry-save";
  if (isSavedMulti.value) return "new-entry";
  return "save";
});

const primaryLabel = computed(() => {
  if (store.savingRetry.value) return "재시도 중…";
  if (store.lastStorageError.value) return "저장 재시도";
  if (isSavedMulti.value) return "새 기록 쓰기";
  return "기록 남기기";
});

const charCount = computed(() => {
  const s = DiaryCore.lengthState(store.state.text);
  const n = s.count.toLocaleString("ko-KR");
  const max = s.limit.toLocaleString("ko-KR");
  if (s.level === "over") {
    return {
      level: s.level,
      label: `${n} / ${max}자 · ${(s.count - s.limit).toLocaleString("ko-KR")}자 초과`,
    };
  }
  if (s.level === "warn") {
    return { level: s.level, label: `${n} / ${max}자 · 곧 한도예요` };
  }
  return { level: s.level, label: `${n} / ${max}자` };
});

const limitNotice = computed(() =>
  DiaryCore.recordLimitState(store.state.sessions.length),
);

function onDraftInput(event) {
  store.state.text = event.target.value;
  store.state.clearDraftConfirm = false;
  store.schedulePersist();
}

function handlePrimaryClick(event) {
  if (primaryAction.value === "retry-save") {
    void store.retrySave();
  } else if (primaryAction.value === "new-entry") {
    void store.startNewEntry();
  } else {
    void store.saveRecord(event.currentTarget);
  }
}

function closeDraftMore() {
  draftMoreRef.value?.hidePopover?.();
  draftMoreTriggerRef.value?.focus?.();
}

function onOpenHelpWrite() {
  const opener = draftMoreTriggerRef.value;
  closeDraftMore();
  store.openInfo("무엇을 쓸까요?", "", opener, true);
}

function onClearDraft() {
  const opener = draftMoreTriggerRef.value;
  closeDraftMore();
  void store.clearDraft(opener);
}

async function onGoBackupManage() {
  store.state.view = "settings";
  await nextTick();
  const details = document.querySelector(".backup-panel")?.closest("details");
  if (details) {
    details.open = true;
    details.querySelector("summary")?.focus();
  }
}
</script>

<template>
  <section
    class="editor home-editor"
    aria-labelledby="write-title"
    :data-storage-error="String(storageFailed)"
  >
    <div class="editor-content">
      <div class="row">
        <span class="eyebrow">TODAY'S PAGE</span>
        <span class="muted">{{ store.state.date }}</span>
      </div>
      <h1 id="write-title">
        <span class="desktop-title">오늘은 어떤 하루였나요?</span>
        <span class="mobile-title">오늘의 기록</span>
      </h1>
      <p class="muted">한 줄만 남겨도 괜찮아요.</p>
      <label for="diary-text" class="sr-only">오늘의 기록</label>
      <textarea
        id="diary-text"
        :value="store.state.text"
        :disabled="store.loading.value"
        placeholder="마음에 남은 순간을 적어 보세요."
        aria-describedby="char-count privacy save-status feedback"
        @input="onDraftInput"
      ></textarea>
      <div class="storage-row">
        <span id="char-count" class="char-count" :data-level="charCount.level">{{ charCount.label }}</span>
        <span id="save-status" role="status" :hidden="storageFailed">{{ store.storageMessage.value }}</span>
        <button
          type="button"
          class="storage-details"
          data-action="storage-details"
          :hidden="!storageFailed"
          :disabled="store.loading.value"
          @click="(e) => store.openInfo('저장 오류', store.lastStorageError.value || store.storageMessage.value, e.currentTarget)"
        >
          저장 실패 · 원문은 유지돼요 ⓘ
        </button>
      </div>
      <p v-if="limitNotice.level === 'full'" id="privacy" class="privacy-note limit-note" data-level="full">
        보관 한도 100편에 도달했어요. 새 기록은 정리한 뒤에 남길 수 있어요.
        <button type="button" data-action="backup-manage" class="quiet" @click="onGoBackupManage">
          백업 후 정리하기
        </button>
      </p>
      <p v-else-if="limitNotice.level === 'near'" id="privacy" class="privacy-note limit-note" data-level="near">
        계정에 안전하게 보관돼요 · <strong>{{ limitNotice.remaining }}편 남았어요</strong> (최대 100편)
      </p>
      <p v-else id="privacy" class="muted privacy-note">로그인 계정에 보관돼요 · 최대 100편</p>
    </div>
    <div class="write-actions">
      <button
        type="button"
        :data-action="primaryAction"
        class="primary"
        :disabled="store.loading.value || store.savingRetry.value"
        @click="handlePrimaryClick"
      >
        {{ primaryLabel }}
      </button>
      <button
        ref="draftMoreTriggerRef"
        type="button"
        class="quiet more-trigger"
        popovertarget="draft-more"
        aria-haspopup="true"
        :disabled="store.loading.value"
      >
        작성 옵션
      </button>
      <div id="draft-more" ref="draftMoreRef" class="action-popover" popover>
        <button
          type="button"
          data-action="help-write"
          class="quiet"
          aria-haspopup="dialog"
          @click="onOpenHelpWrite"
        >
          무엇을 쓸까요?
        </button>
        <button type="button" data-action="clear-draft" class="quiet" @click="onClearDraft">
          초안 지우기
        </button>
        <p class="menu-note">
          작성 중인 초안은 이 브라우저에 임시 보관되며, 저장된 기록과 카드는 계정에 보관돼요.
        </p>
      </div>
    </div>
  </section>

  <aside class="home-aside" aria-label="나의 기록 요약">
    <section class="panel latest-panel" aria-labelledby="latest-title">
      <div class="row">
        <span class="eyebrow">MY MOMENT</span>
        <span class="small muted">나의 기록</span>
      </div>
      <div class="latest-content">
        <div class="latest-art" aria-hidden="true">
          <CharacterMark
            v-if="latestRecord && latestCard.status === 'ready'"
            :type="latestCard.type"
            :stage="latestCard.stage"
            :card-key="latestCard.cardKey"
          />
          <img v-else :src="OBJECT_ASSETS.heart" alt="" />
        </div>
        <div>
          <h2 id="latest-title">{{ latestRecord ? cardLabel(latestRecord) : "오늘의 작은 시작" }}</h2>
          <template v-if="latestRecord">
            <p class="muted">{{ latestRecord.recordDate }}의 모먼트</p>
            <p class="small muted latest-storage">
              {{ latestStatusText }}
            </p>
            <button
              v-if="['pending', 'error'].includes(latestCard.status)"
              type="button"
              data-action="retry-analysis"
              class="quiet"
              :disabled="store.loading.value || latestAnalyzing"
              @click="store.retryAnalysis(latestRecord.id)"
            >
              {{ latestAnalyzing ? "분석 중…" : latestCard.status === "pending" ? "분석하기" : "다시 분석하기" }}
            </button>
          </template>
          <template v-else>
            <ol class="first-run" aria-label="이렇게 사용해요">
              <li>오늘의 기록을 한 줄이라도 남겨요.</li>
              <li>감정 분석 모델이 기록을 읽어요. <small>지금은 분석 준비 중이에요.</small></li>
              <li>분석된 감정이 카드와 캐릭터 도감으로 모여요.</li>
            </ol>
            <p class="small muted latest-storage">
              분류 확률은 감정의 강도가 아니에요. 기록을 남기면 계정 도감에 카드가 모여요.
            </p>
          </template>
        </div>
      </div>
    </section>

    <section class="panel recent-panel" aria-labelledby="recent-title">
      <div class="row">
        <h2 id="recent-title">최근 기록</h2>
        <span class="small muted">{{ store.activeRecords().length }}편</span>
      </div>
      <div class="entry-list recent-list">
        <RecordRow
          v-for="rec in recentRecords"
          :key="rec.id"
          :record="rec"
          @open="store.openRecord"
        />
        <div v-if="!recentRecords.length" class="recent-empty">
          <span aria-hidden="true">✧</span>
          <p>아직 기록이 없어요.</p>
          <small>오늘의 첫 문장을 남겨 보세요.</small>
        </div>
      </div>
    </section>
  </aside>
</template>
