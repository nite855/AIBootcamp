<script setup>
import { computed } from "vue";
import { DiaryCards, cardLabel } from "../domain/index.js";
import { timeLabel } from "../services/cardRenderer.js";
import CharacterMark from "./CharacterMark.vue";

const props = defineProps({
  record: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["open"]);

const card = computed(() => DiaryCards.resolve(props.record));
const previewLine = computed(() => String(props.record.text || "").split("\n")[0]);
const statusText = computed(
  () => `${props.record.favorite ? "★ 즐겨찾기 · " : ""}${cardLabel(props.record)}`,
);
</script>

<template>
  <button type="button" class="entry" :data-open="record.id" @click="emit('open', record.id)">
    <span class="mini-art" aria-hidden="true">
      <CharacterMark
        v-if="card.status === 'ready'"
        :type="card.type"
        :stage="card.stage"
        :card-key="card.cardKey"
      />
      <span v-else class="record-glyph">✎</span>
    </span>
    <span class="entry-meta">
      <strong class="entry-preview">{{ previewLine }}</strong>
      <small>{{ record.recordDate }} · {{ timeLabel(record.createdAt) }}</small>
      <span class="entry-state">{{ statusText }}</span>
    </span>
    <span aria-hidden="true" class="entry-arrow">›</span>
  </button>
</template>
