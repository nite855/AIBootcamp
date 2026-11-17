<script setup>
import { computed } from "vue";
import { CardexCore, DiaryCards, STAGE_LABELS } from "../domain/index.js";
import { useDiaryStore } from "../composables/useDiaryStore.js";
import CharacterMark from "../components/CharacterMark.vue";

const store = useDiaryStore();

const slots = computed(() => DiaryCards.collection(store.activeRecords()));
const unlockedCount = computed(() => slots.value.filter((s) => s.records.length).length);
const visibleSlots = computed(() =>
  slots.value.filter((s) => s.type === store.state.catalogType),
);
const selectedSlot = computed(
  () => visibleSlots.value.find((s) => s.stage === store.state.catalogStage) || null,
);

function onTypeChange() {
  store.state.catalogStage = null;
}

function selectStage(stage) {
  store.state.catalogStage = stage;
  const slot = visibleSlots.value.find((s) => s.stage === stage);
  if (slot?.records.length) {
    store.state.cardFilter = { type: store.state.catalogType, stage };
    store.state.dateFilter = "";
    store.state.page = 0;
    store.state.archiveTab = "records";
  }
}
</script>

<template>
  <section class="panel archive-panel">
    <div class="row">
      <h2>캐릭터 도감</h2>
    </div>
    <p class="muted">
      내 도감 · 기록에서 만난 감정들 ·
      {{ unlockedCount }} / {{ slots.length }}
    </p>
    <label>
      감정
      <select id="catalog-type" v-model="store.state.catalogType" @change="onTypeChange">
        <optgroup v-for="p in CardexCore.PARENTS" :key="p.id" :label="p.name">
          <option v-for="id in p.children" :key="id" :value="id">
            {{ CardexCore.type(id).name }}
          </option>
        </optgroup>
      </select>
    </label>
    <div class="catalog-grid">
      <button
        v-for="s in visibleSlots"
        :key="s.stage"
        type="button"
        :data-stage="s.stage"
        :aria-pressed="String(s.stage === store.state.catalogStage)"
        @click="selectStage(s.stage)"
      >
        <span class="character-placeholder">
          <CharacterMark
            v-if="s.records.length"
            :type="s.type"
            :stage="s.stage"
            :card-key="s.cardKey"
            extra-class="catalog-character"
          />
          <template v-else>?</template>
        </span>
        <strong>{{ s.stage }}단계</strong>
        <small>{{ STAGE_LABELS[s.stage] }}</small>
        <small>{{ s.records.length ? `${s.records.length}편의 연결 기록` : "미발견" }}</small>
      </button>
    </div>
    <p class="muted">단계는 분류 확률 구간이며 감정의 강도가 아니에요.</p>
    <p class="muted">중립에는 객관적 서술·의문·놀람·당황을 포함해요.</p>
    <p v-if="selectedSlot && !selectedSlot.records.length">아직 만나지 않은 캐릭터예요.</p>
    <p v-else>발견한 단계를 누르면 연결 기록을 볼 수 있어요.</p>
  </section>
</template>
