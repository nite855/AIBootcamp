<script setup>
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import AppHeader from "./components/AppHeader.vue";
import AppFooter from "./components/AppFooter.vue";
import AppDialogs from "./components/AppDialogs.vue";
import ThemeScenery from "./components/ThemeScenery.vue";
import AuthView from "./views/AuthView.vue";
import HomeView from "./views/HomeView.vue";
import RecordsView from "./views/RecordsView.vue";
import RecordDetail from "./views/RecordDetail.vue";
import StatisticsView from "./views/StatisticsView.vue";
import CatalogView from "./views/CatalogView.vue";
import SettingsView from "./views/SettingsView.vue";
import ThemeGallery from "./views/ThemeGallery.vue";
import { useTheme } from "./composables/useTheme.js";
import { useAuthStore } from "./composables/useAuthStore.js";
import { useDiaryStore } from "./composables/useDiaryStore.js";

const { theme } = useTheme();
const auth = useAuthStore();
const store = useDiaryStore();
const mainRef = ref(null);
let cleanupListeners = null;

watch(
  () => [auth.canAccessApp.value, auth.user.value?.id],
  ([canAccess, userId]) => {
    if (canAccess && userId) {
      void store.restore(userId);
    } else {
      store.resetAccountState({ clearDraft: false });
    }
  },
);

watch(
  () => [store.state.view, store.state.archiveTab, store.state.selected, auth.canAccessApp.value],
  async ([nextView, , nextSelected], [prevView, prevArchiveTab, prevSelected]) => {
    if (
      nextView === prevView &&
      store.state.archiveTab === prevArchiveTab &&
      nextSelected === prevSelected
    ) {
      return;
    }
    await nextTick();
    if (prevView === "themes" && nextView === "settings") {
      document.querySelector('[data-action="theme-gallery"]')?.focus?.();
      return;
    }
    const target = mainRef.value?.querySelector("h1, h2");
    if (target) {
      target.setAttribute("tabindex", "-1");
      target.focus();
    }
  },
);

watch(
  () => [store.state.view, store.state.archiveTab, store.state.selected],
  () => {
    if (store.state.view === "entry" && !store.currentRecord.value) {
      store.state.view = "history";
    }
  },
);

onMounted(() => {
  cleanupListeners = store.initGlobalListeners();
  void auth.bootstrapSession();
});

onUnmounted(() => {
  cleanupListeners?.();
});
</script>

<template>
  <div class="shell">
    <ThemeScenery :theme-id="theme" />
    <template v-if="auth.initializing.value">
      <main id="main-content" ref="mainRef" class="workspace auth-workspace">
        <section class="panel auth-panel">
          <h1>오늘의 모먼트</h1>
          <p class="muted">로그인 상태를 확인하고 있어요…</p>
        </section>
      </main>
    </template>
    <template v-else-if="!auth.canAccessApp.value">
      <main id="main-content" ref="mainRef" class="workspace auth-workspace">
        <AuthView />
      </main>
      <AppFooter :status-message="auth.authError.value" :is-error="Boolean(auth.authError.value)" />
    </template>
    <template v-else>
      <AppHeader :active-tab="store.currentTab.value" @navigate="store.navigateTab" />
      <main
        id="main-content"
        ref="mainRef"
        class="workspace"
        :class="{ 'home-workspace': store.state.view === 'write' }"
      >
        <HomeView v-if="store.state.view === 'write'" />
        <ThemeGallery v-else-if="store.state.view === 'themes'" />
        <SettingsView v-else-if="store.state.view === 'settings'" />
        <RecordDetail v-else-if="store.state.view === 'entry' && store.currentRecord.value" />
        <StatisticsView v-else-if="store.state.view === 'history' && store.state.archiveTab === 'stats'" />
        <CatalogView v-else-if="store.state.view === 'history' && store.state.archiveTab === 'catalog'" />
        <RecordsView v-else />
      </main>
      <AppDialogs />
      <AppFooter :status-message="store.state.status" :is-error="store.state.error" />
    </template>
  </div>
</template>
