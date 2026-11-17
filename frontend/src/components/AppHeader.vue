<script setup>
import { computed } from "vue";

const NAV_TABS = [
  { id: "today", action: "write", label: "오늘", title: "오늘의 기록" },
  { id: "records", action: "archive-records", label: "기록", title: "지난 기록" },
  { id: "review", action: "review-month", label: "통계", title: "감정 통계" },
  { id: "catalog", action: "catalog", label: "도감", title: "캐릭터 도감" },
  { id: "settings", action: "settings", label: "설정", title: "설정" },
];

const props = defineProps({
  activeTab: {
    type: String,
    default: "today",
  },
});

const emit = defineEmits(["navigate"]);

const currentTabLabel = computed(
  () => (NAV_TABS.find((tab) => tab.id === props.activeTab) || NAV_TABS[0]).label,
);
</script>

<template>
  <header>
    <div class="topbar-title">
      <button
        type="button"
        class="brand"
        data-action="write"
        aria-label="오늘의 모먼트 · 메인으로"
        @click="emit('navigate', 'today')"
      >
        <small>✦ 오늘의 모먼트</small>
        <span class="screen-title">{{ currentTabLabel }}</span>
      </button>
    </div>
    <nav class="tabs" aria-label="주요 메뉴">
      <button
        v-for="tab in NAV_TABS"
        :key="tab.id"
        type="button"
        :data-action="tab.action"
        class="tab"
        :aria-current="tab.id === activeTab ? 'page' : undefined"
        @click="emit('navigate', tab.id)"
      >
        <svg class="tab-icon" viewBox="0 0 24 24" aria-hidden="true">
          <template v-if="tab.id === 'today'">
            <path d="M4 17.5V20h2.5L17 9.5 14.5 7 4 17.5Z" />
            <path d="m14.5 7 2.5 2.5 1.6-1.6a1.4 1.4 0 0 0 0-2L17.1 4.4a1.4 1.4 0 0 0-2 0L13.5 6" />
          </template>
          <template v-else-if="tab.id === 'records'">
            <path d="M6 4h9l3 3v13H6z" />
            <path d="M9 11h6M9 15h4" />
          </template>
          <template v-else-if="tab.id === 'review'">
            <path d="M4 19c3-1 4-9 7-9s3 5 5 5 3-6 4-8" />
          </template>
          <template v-else-if="tab.id === 'catalog'">
            <path d="M12 20s-7-4.4-7-9.6A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.4C19 15.6 12 20 12 20Z" />
          </template>
          <template v-else>
            <circle cx="12" cy="12" r="3" />
            <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M6 18l1.4-1.4M16.6 7.4 18 6" />
          </template>
        </svg>
        <span>{{ tab.label }}</span>
      </button>
    </nav>
  </header>
</template>
