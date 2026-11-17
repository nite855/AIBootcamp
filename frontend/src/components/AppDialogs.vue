<script setup>
import { computed, ref, watch } from "vue";
import { useTheme } from "../composables/useTheme.js";
import { useDiaryStore } from "../composables/useDiaryStore.js";
import ThemePreviewCard from "./ThemePreviewCard.vue";
import CharacterMark from "./CharacterMark.vue";

const store = useDiaryStore();
const { themes, theme, mode, setTheme, setMode } = useTheme();

const themeDialogRef = ref(null);
const infoDialogRef = ref(null);
const confirmDialogRef = ref(null);
const readFullDialogRef = ref(null);

const modeName = (m) => (m === "dark" ? "다크" : "라이트");

const previewThemeTitle = computed(() => {
  const id = store.themeDialogState.value.themeId;
  const item = themes.find((t) => t.id === id);
  return item ? `${item.name} · ${modeName(store.themeDialogState.value.mode)}` : "";
});

const isCurrentTheme = computed(
  () =>
    store.themeDialogState.value.themeId === theme.value &&
    store.themeDialogState.value.mode === mode.value,
);

watch(
  () => store.themeDialogState.value.open,
  (open) => {
    const dlg = themeDialogRef.value;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    else if (!open && dlg.open) dlg.close();
  },
);

watch(
  () => store.infoModal.value.open,
  (open) => {
    const dlg = infoDialogRef.value;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    else if (!open && dlg.open) dlg.close();
  },
);

watch(
  () => store.confirmModal.value.open,
  (open) => {
    const dlg = confirmDialogRef.value;
    if (!dlg) return;
    if (open && !dlg.open) {
      dlg.returnValue = "cancel";
      dlg.showModal();
    } else if (!open && dlg.open) {
      dlg.close();
    }
  },
);

watch(
  () => store.readFullModal.value.open,
  (open) => {
    const dlg = readFullDialogRef.value;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    else if (!open && dlg.open) dlg.close();
  },
);

function applyPreviewTheme() {
  if (!store.themeDialogState.value.themeId || isCurrentTheme.value) return;
  setTheme(store.themeDialogState.value.themeId);
  setMode(store.themeDialogState.value.mode);
  store.closeThemePreview();
  store.announce("선택한 테마와 화면 모드를 적용했어요.");
}

function handleConfirmCancel() {
  store.confirmModal.value.resolve?.(false);
}

function handleConfirmAccept() {
  store.confirmModal.value.resolve?.(true);
}
</script>

<template>
  <dialog
    id="theme-dialog"
    ref="themeDialogRef"
    class="theme-dialog"
    aria-labelledby="theme-dialog-title"
    @close="store.closeThemePreview()"
  >
    <div class="theme-dialog-head">
      <h2 id="theme-dialog-title">{{ previewThemeTitle }}</h2>
      <button type="button" class="quiet" data-close-theme @click="store.closeThemePreview()">
        닫기
      </button>
    </div>
    <div id="theme-dialog-sample">
      <ThemePreviewCard
        v-if="store.themeDialogState.value.themeId"
        :theme-id="store.themeDialogState.value.themeId"
        :mode="store.themeDialogState.value.mode"
        :large="true"
      />
    </div>
    <div class="theme-dialog-footer">
      <p class="muted">예시 화면 · 적용 전에는 설정이 바뀌지 않아요.</p>
      <button
        type="button"
        class="primary"
        data-apply-theme
        :disabled="isCurrentTheme"
        @click="applyPreviewTheme"
      >
        {{ isCurrentTheme ? "현재 적용 중" : "이 테마 적용" }}
      </button>
    </div>
  </dialog>

  <dialog
    id="info-dialog"
    ref="infoDialogRef"
    class="read-dialog"
    aria-labelledby="info-title"
    @close="store.closeInfo()"
  >
    <h2 id="info-title">{{ store.infoModal.value.title }}</h2>
    <p id="info-copy">{{ store.infoModal.value.copy }}</p>
    <div class="row">
      <button
        type="button"
        class="quiet"
        data-next-prompt
        :hidden="!store.infoModal.value.isPrompt"
        @click="store.nextWritingPrompt()"
      >
        다른 질문
      </button>
      <button type="button" class="quiet" data-close-info @click="store.closeInfo()">
        닫기
      </button>
    </div>
  </dialog>

  <dialog
    id="confirm-dialog"
    ref="confirmDialogRef"
    class="read-dialog"
    aria-labelledby="confirm-title"
    @cancel.prevent="handleConfirmCancel"
  >
    <h2 id="confirm-title">{{ store.confirmModal.value.title }}</h2>
    <p id="confirm-copy">{{ store.confirmModal.value.copy }}</p>
    <div class="row">
      <button
        type="button"
        class="quiet"
        data-confirm="cancel"
        autofocus
        @click="handleConfirmCancel"
      >
        취소
      </button>
      <button
        type="button"
        class="primary"
        data-confirm="accept"
        @click="handleConfirmAccept"
      >
        {{ store.confirmModal.value.accept }}
      </button>
    </div>
  </dialog>

  <dialog
    id="read-full-dialog"
    ref="readFullDialogRef"
    class="read-dialog"
    aria-labelledby="full-title"
    @close="store.closeReadFull()"
  >
    <div class="full-heading">
      <div>
        <p class="full-date muted">{{ store.readFullModal.value.date }}</p>
        <h2 id="full-title">그날의 기록</h2>
      </div>
      <form method="dialog">
        <button type="submit" class="quiet">닫기</button>
      </form>
    </div>
    <div class="full-text" tabindex="0">{{ store.readFullModal.value.text }}</div>
  </dialog>

  <Teleport to="body">
    <div
      v-if="store.celebration.value"
      class="moment-celebrate"
      :class="{ leaving: store.celebration.value.leaving }"
      :style="{ '--tone': `var(--${store.celebration.value.type})` }"
    >
      <div class="celebrate-badge">
        <div class="celebrate-sparkles" aria-hidden="true">
          <i
            v-for="i in 6"
            :key="i"
            :style="{
              '--a': `${(i - 1) * 60 + ((i - 1) % 2 ? 12 : 0)}deg`,
              '--d': `${((i - 1) % 3) * 18 + 62}px`,
              '--s': `${((i - 1) % 4) * 2 + 5}px`,
              '--delay': `${((i - 1) % 5) * 40}ms`,
            }"
          />
        </div>
        <div class="celebrate-card" aria-hidden="true">
          <CharacterMark :type="store.celebration.value.type" />
          <span class="celebrate-gloss" />
        </div>
        <div class="celebrate-copy" role="status">
          <strong>{{ store.celebration.value.title }}</strong>
          <span>{{ store.celebration.value.subtitle }}</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>
