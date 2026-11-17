<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import "../../scripts/flip.js";
import { DiaryCards } from "../domain/index.js";
import { buildCardSVGString, readCardThemeTokens } from "../services/cardRenderer.js";
import { useTheme } from "../composables/useTheme.js";
import { useDiaryStore } from "../composables/useDiaryStore.js";
import { useCardManifestVersion } from "../composables/useCardAssets.js";
import EmptyCard from "./EmptyCard.vue";

const props = defineProps({
  record: {
    type: Object,
    default: null,
  },
});

const store = useDiaryStore();
const { themeVersion } = useTheme();
const manifestVersion = useCardManifestVersion();
const areaRef = ref(null);
const morePopoverRef = ref(null);
const moreTriggerRef = ref(null);

let lastCardShown = null;
let lastCardEnterAt = 0;

const card = computed(() => DiaryCards.resolve(props.record));

const cardSvgHtml = computed(() => {
  void themeVersion.value;
  void manifestVersion.value;
  if (!props.record) return "";
  return buildCardSVGString(
    props.record,
    store.state.mode,
    store.state.date,
    readCardThemeTokens(),
  );
});

const storageLabel = computed(() => {
  if (store.lastStorageError.value || !store.storeReady.value) return "기록을 보관하지 못했어요";
  return store.generation.value === store.savedGeneration.value
    ? "기록을 보관했어요"
    : "기록을 보관 중이에요";
});

const isAnalyzing = computed(() =>
  Boolean(props.record && store.isAnalyzingRecord(props.record.id)),
);

const captionLine1 = computed(() =>
  props.record ? `${storageLabel.value} · 탭해서 뒤집기` : "기록은 보관할 수 있어요.",
);

const captionLine2 = computed(() => {
  if (isAnalyzing.value) return "감정 분석 중이에요…";
  if (card.value.status === "ready") return "감정 분석을 마쳤어요.";
  if (card.value.status === "error") {
    return props.record?.analysis?.message || "감정 분석에 실패했어요 · 기록은 안전해요";
  }
  return "감정 분석은 준비 중이에요.";
});

function closeMorePopover() {
  morePopoverRef.value?.hidePopover?.();
  moreTriggerRef.value?.focus?.();
}

function bindFlipEffects() {
  if (!areaRef.value || !props.record || !window.DiaryFlip) return;
  window.DiaryFlip.bind(areaRef.value);
  const scene = areaRef.value.querySelector(".flip-scene");
  const shown = `${store.state.mode}:${props.record.id}`;
  const now = Date.now();
  if (
    scene &&
    shown !== lastCardShown &&
    now - lastCardEnterAt > 1200 &&
    document.documentElement.dataset.motion !== "off"
  ) {
    scene.classList.add("card-enter");
    lastCardEnterAt = now;
  }
  lastCardShown = shown;
}

onMounted(async () => {
  await nextTick();
  bindFlipEffects();
});

watch(
  () => [props.record?.id, props.record?.version, cardSvgHtml.value],
  async () => {
    await nextTick();
    bindFlipEffects();
  },
);

onUnmounted(() => {
  window.DiaryFlipObserver?.disconnect?.();
});

function handlePopoverToggle(event) {
  if (event.newState === "closed") {
    moreTriggerRef.value?.focus?.();
  }
}

function onOpenCatalog() {
  closeMorePopover();
  store.state.catalogType = card.value.type;
  store.state.catalogStage = card.value.stage;
  store.state.view = "history";
  store.state.archiveTab = "catalog";
  store.state.cardFilter = null;
}

function onEditRecord() {
  closeMorePopover();
  store.state.editing = true;
  store.state.recordTab = "text";
}

function onToggleFavorite() {
  const opener = moreTriggerRef.value;
  closeMorePopover();
  void store.toggleFavorite().then(() => {
    opener?.focus?.();
  });
}

function onDeleteRecord() {
  const opener = moreTriggerRef.value;
  closeMorePopover();
  void store.deleteCurrentRecord(opener);
}
</script>

<template>
  <section ref="areaRef" class="card-area">
    <div class="card-box">
      <div v-if="record" class="flip-scene">
        <div class="tilt-layer">
          <div class="flip-inner">
            <div class="flip-front">
              <button class="flip-trigger" data-flip="back" type="button" aria-label="카드를 뒤집어 기록 보기">
                <span v-html="cardSvgHtml" />
                <span class="flip-light" aria-hidden="true" />
              </button>
            </div>
            <div
              class="flip-back"
              role="button"
              tabindex="-1"
              aria-label="카드 앞면으로 돌아가기. Enter 또는 스페이스를 누르세요."
              aria-hidden="true"
              inert
            >
              <span class="flip-light" aria-hidden="true" />
              <p class="muted">{{ record.recordDate }}</p>
              <h2>그날의 기록</h2>
              <div class="flip-text" tabindex="0">{{ record.text }}</div>
              <small class="muted">탭하면 카드 앞면 · 본문 밖을 터치·드래그하면 빛과 기울기</small>
            </div>
          </div>
        </div>
      </div>
      <EmptyCard v-else :text="store.state.text" :date="store.state.date" />
    </div>
    <p class="caption muted">
      {{ captionLine1 }}<br />
      {{ captionLine2 }}
    </p>
    <div class="card-actions">
      <button
        v-if="record && (store.lastStorageError.value || !store.storeReady.value)"
        type="button"
        data-action="retry-save"
        class="quiet"
        :disabled="store.loading.value || store.savingRetry.value"
        @click="store.retrySave()"
      >
        저장 재시도
      </button>
      <button
        v-if="record && ['pending', 'error'].includes(card.status)"
        type="button"
        data-action="retry-analysis"
        class="quiet"
        :disabled="store.loading.value || isAnalyzing"
        @click="store.retryAnalysis(record.id)"
      >
        {{ isAnalyzing ? "분석 중…" : "다시 분석하기" }}
      </button>
      <button
        v-if="record"
        type="button"
        data-action="read-full"
        class="primary"
        :disabled="store.loading.value"
        @click="(e) => store.openReadFull(record, e.currentTarget)"
      >
        기록 읽기
      </button>
      <button
        v-if="record && ['ready', 'blank'].includes(card.status)"
        type="button"
        data-action="download"
        class="quiet"
        :disabled="store.state.busy || store.loading.value"
        @click="store.downloadCurrentCardPng()"
      >
        이미지 저장
      </button>
      <template v-if="record">
        <button
          ref="moreTriggerRef"
          type="button"
          class="quiet more-trigger"
          popovertarget="card-more"
          aria-haspopup="true"
          :disabled="store.loading.value"
        >
          더보기
        </button>
        <div
          id="card-more"
          ref="morePopoverRef"
          class="action-popover"
          popover
          @toggle="handlePopoverToggle"
        >
          <button
            type="button"
            data-action="favorite"
            class="quiet"
            :aria-pressed="Boolean(record.favorite)"
            @click="onToggleFavorite"
          >
            {{ record.favorite ? "★ 즐겨찾기 해제" : "☆ 즐겨찾기" }}
          </button>
          <button
            v-if="store.state.view === 'entry'"
            type="button"
            data-action="edit-example"
            class="quiet"
            @click="onEditRecord"
          >
            수정하기
          </button>
          <button
            v-if="card.status === 'ready'"
            type="button"
            data-action="card-catalog"
            class="quiet"
            @click="onOpenCatalog"
          >
            캐릭터 도감
          </button>
          <button
            type="button"
            data-action="delete-example"
            class="quiet danger"
            @click="onDeleteRecord"
          >
            삭제
          </button>
        </div>
      </template>
    </div>
  </section>
</template>
