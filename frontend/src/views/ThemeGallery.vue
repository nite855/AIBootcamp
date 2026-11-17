<script setup>
import { computed, ref } from "vue";
import { useTheme } from "../composables/useTheme.js";
import { useDiaryStore } from "../composables/useDiaryStore.js";
import ThemePreviewCard from "../components/ThemePreviewCard.vue";

const store = useDiaryStore();
const { themes, theme, mode } = useTheme();
const galleryFilter = ref("all");

const modeName = (m) => (m === "dark" ? "다크" : "라이트");

const currentStatusText = computed(() => {
  const item = themes.find((t) => t.id === theme.value);
  return item ? `현재 적용: ${item.name} · ${modeName(mode.value)}` : "";
});

const variants = computed(() =>
  themes
    .flatMap((t) => ["light", "dark"].map((m) => ({ ...t, mode: m })))
    .filter((v) => galleryFilter.value === "all" || v.mode === galleryFilter.value),
);

function isApplied(item) {
  return item.id === theme.value && item.mode === mode.value;
}

function goBackToSettings() {
  store.state.view = "settings";
}
</script>

<template>
  <section class="panel theme-gallery">
    <div class="row">
      <h1>나의 하루에 어울리는 테마</h1>
      <button type="button" data-action="theme-back" class="quiet" @click="goBackToSettings">
        설정으로
      </button>
    </div>
    <p id="theme-current" role="status">{{ currentStatusText }}</p>
    <nav class="gallery-filters" aria-label="테마 분류">
      <button
        v-for="[id, label] in [
          ['all', '전체'],
          ['light', '라이트'],
          ['dark', '다크'],
        ]"
        :key="id"
        type="button"
        :data-theme-filter="id"
        :aria-pressed="String(galleryFilter === id)"
        @click="galleryFilter = id"
      >
        {{ label }}
      </button>
    </nav>
    <div class="theme-gallery-grid">
      <button
        v-for="item in variants"
        :key="`${item.id}-${item.mode}`"
        type="button"
        class="theme-tile"
        :data-theme-preview="item.id"
        :data-mode="item.mode"
        :data-applied="String(isApplied(item))"
        :aria-label="`${item.name} ${modeName(item.mode)} 미리보기`"
        aria-haspopup="dialog"
        @click="(e) => store.openThemePreview(item.id, item.mode, e.currentTarget)"
      >
        <ThemePreviewCard :theme-id="item.id" :mode="item.mode" />
        <span class="theme-tile-label">
          <strong>{{ item.name }} · {{ modeName(item.mode) }}</strong>
          <span v-if="isApplied(item)" class="applied-badge">✓ 적용 중</span>
        </span>
      </button>
    </div>
  </section>
</template>
