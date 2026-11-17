<script setup>
import { computed, ref, watch } from "vue";
import { CardexCore, DiaryCards } from "../domain/index.js";
import { useDiaryStore } from "../composables/useDiaryStore.js";
import RecordRow from "../components/RecordRow.vue";

const PAGE_SIZE = 6;
const store = useDiaryStore();
const composing = ref(false);

const filteredRecords = computed(() => {
  const q = store.state.search.toLocaleLowerCase();
  const list = store.queryRecords({ date: store.state.dateFilter }).filter((r) => {
    if (store.state.favoritesOnly && !r.favorite) return false;
    if (store.state.emotionFilter) {
      const c = DiaryCards.resolve(r);
      if (c.status !== "ready" || c.type !== store.state.emotionFilter) return false;
    }
    return r.text.toLocaleLowerCase().includes(q);
  });
  if (store.state.sortOldest) list.reverse();
  return list;
});

const totalPages = computed(() => Math.max(1, Math.ceil(filteredRecords.value.length / PAGE_SIZE)));

watch(totalPages, (pages) => {
  if (store.state.page >= pages) {
    store.state.page = Math.max(0, pages - 1);
  }
});

const pagedRecords = computed(() =>
  filteredRecords.value.slice(
    store.state.page * PAGE_SIZE,
    (store.state.page + 1) * PAGE_SIZE,
  ),
);

const hasActiveFilter = computed(() =>
  Boolean(
    store.state.search ||
      store.state.favoritesOnly ||
      store.state.emotionFilter ||
      store.state.dateFilter ||
      store.state.cardFilter,
  ),
);

const emptyMessage = computed(() => {
  if (store.state.dateFilter) return "이 날짜에는 기록이 없어요.";
  if (store.state.cardFilter) return "이 캐릭터와 연결된 기록이 없어요.";
  if (store.state.search || store.state.favoritesOnly) {
    return "조건에 맞는 기록이 없어요. 필터를 바꿔 보세요.";
  }
  return "아직 기록이 없어요. 오늘의 첫 문장을 남겨 보세요.";
});

function onSearchInput(event) {
  if (!composing.value) {
    store.state.search = event.target.value;
    store.state.page = 0;
  }
}

function onCompositionEnd(event) {
  composing.value = false;
  store.state.search = event.target.value;
  store.state.page = 0;
}

function resetSearch() {
  store.state.search = "";
  store.state.favoritesOnly = false;
  store.state.emotionFilter = "";
  store.state.dateFilter = "";
  store.state.cardFilter = null;
  store.state.page = 0;
}

function backToStats() {
  store.state.archiveTab = "stats";
  store.state.dateFilter = "";
  store.state.returnToStats = false;
}

function backToCatalog() {
  store.state.cardFilter = null;
  store.state.archiveTab = "catalog";
}
</script>

<template>
  <section class="panel archive-panel">
    <div class="row">
      <h2>지난 기록</h2>
    </div>
    <p class="muted">
      {{ store.state.mode === "example" ? "예시 모드 · 내 기록과 분리" : "내 기록 · 이 브라우저에 보관" }}
    </p>
    <div v-if="store.state.dateFilter" class="row">
      <span>{{ store.state.dateFilter }}</span>
      <button
        type="button"
        data-action="clear-date"
        class="quiet"
        @click="store.state.dateFilter = ''; store.state.page = 0"
      >
        날짜 필터 해제
      </button>
    </div>
    <div class="search-controls">
      <label for="record-search">기록 검색</label>
      <input
        id="record-search"
        type="search"
        placeholder="기억나는 단어로 찾아보세요"
        :value="store.state.search"
        @compositionstart="composing = true"
        @compositionend="onCompositionEnd"
        @input="onSearchInput"
      />
      <details class="record-filters">
        <summary>필터{{ hasActiveFilter ? " · 적용 중" : "" }}</summary>
        <label class="favorite-filter">
          <input
            id="favorites-only"
            v-model="store.state.favoritesOnly"
            type="checkbox"
            @change="store.state.page = 0"
          />
          즐겨찾기만
        </label>
        <label class="emotion-filter">
          카드 감정
          <select
            id="emotion-filter"
            v-model="store.state.emotionFilter"
            @change="store.state.page = 0"
          >
            <option value="">전체</option>
            <option v-for="id in CardexCore.IDS" :key="id" :value="id">
              {{ CardexCore.type(id).name }}
            </option>
          </select>
        </label>
      </details>
      <button
        type="button"
        class="quiet sort-toggle"
        data-sort
        :aria-pressed="String(store.state.sortOldest)"
        @click="store.state.sortOldest = !store.state.sortOldest; store.state.page = 0"
      >
        {{ store.state.sortOldest ? "오래된 순" : "최신 순" }}
      </button>
      <button
        v-if="hasActiveFilter"
        type="button"
        data-action="reset-search"
        class="quiet"
        @click="resetSearch"
      >
        필터 초기화
      </button>
    </div>
    <p class="muted" role="status">{{ filteredRecords.length }}편의 기록</p>
    <div class="entry-list">
      <RecordRow
        v-for="rec in pagedRecords"
        :key="rec.id"
        :record="rec"
        @open="store.openRecord"
      />
      <p v-if="!pagedRecords.length">{{ emptyMessage }}</p>
    </div>
    <div
      class="pagination"
      :hidden="totalPages === 1 && !store.state.dateFilter && !store.state.cardFilter"
    >
      <template v-if="totalPages > 1">
        <button
          type="button"
          data-action="prev"
          class="quiet"
          :disabled="store.state.page === 0"
          @click="store.state.page--"
        >
          이전
        </button>
        <span>{{ store.state.page + 1 }} / {{ totalPages }}</span>
        <button
          type="button"
          data-action="next"
          class="quiet"
          :disabled="store.state.page >= totalPages - 1"
          @click="store.state.page++"
        >
          다음
        </button>
      </template>
      <button
        v-if="store.state.dateFilter"
        type="button"
        data-action="back-stats"
        class="quiet"
        @click="backToStats"
      >
        통계로
      </button>
      <button
        v-if="store.state.cardFilter"
        type="button"
        data-action="catalog-back"
        class="quiet"
        @click="backToCatalog"
      >
        도감으로
      </button>
    </div>
  </section>
</template>
