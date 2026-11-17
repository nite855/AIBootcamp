<script setup>
import { ref, watch } from "vue";
import { useDiaryStore } from "../composables/useDiaryStore.js";
import EmotionCard from "../components/EmotionCard.vue";

const store = useDiaryStore();
const editDraft = ref("");

watch(
  () => [store.state.editing, store.currentRecord.value?.id],
  () => {
    if (store.state.editing && store.currentRecord.value) {
      editDraft.value = store.currentRecord.value.text;
    }
  },
  { immediate: true },
);

function goBack() {
  store.state.editing = false;
  store.state.deleteConfirm = false;
  store.state.view = store.state.entryFrom === "write" ? "write" : "history";
}

function cancelEdit() {
  store.state.editing = false;
}

async function submitEdit() {
  await store.saveEditedRecord(editDraft.value);
}
</script>

<template>
  <section v-if="store.currentRecord.value" class="panel record-panel">
    <div class="row">
      <h2>{{ store.currentRecord.value.recordDate }}</h2>
      <button type="button" data-action="history" class="quiet" @click="goBack">
        {{ store.state.entryFrom === "write" ? "홈으로" : "목록으로" }}
      </button>
    </div>
    <div class="record-layout show-record-card" :class="{ 'is-editing': store.state.editing }">
      <div class="record-copy" :hidden="!store.state.editing">
        <template v-if="store.state.editing">
          <label for="sample-text">기록 수정</label>
          <textarea id="sample-text" v-model="editDraft" class="read-text"></textarea>
          <div class="row">
            <button type="button" data-action="save-example" class="primary" @click="submitEdit">
              수정 완료
            </button>
            <button type="button" data-action="cancel-edit" class="quiet" @click="cancelEdit">
              취소
            </button>
          </div>
        </template>
        <div v-else class="read-text">{{ store.currentRecord.value.text }}</div>
      </div>
      <EmotionCard :record="store.currentRecord.value" />
    </div>
  </section>
</template>
