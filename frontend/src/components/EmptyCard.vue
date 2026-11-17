<script setup>
import { computed } from "vue";
import { OBJECT_ASSETS } from "../services/assets.js";

const props = defineProps({
  text: {
    type: String,
    default: "",
  },
  date: {
    type: String,
    required: true,
  },
});

const typing = computed(() => Boolean(String(props.text || "").trim()));
const hintText = computed(() =>
  typing.value ? "지금의 마음을 글로 남겨 보세요" : "짧은 한 문장부터 시작해 보세요",
);
</script>

<template>
  <div
    class="empty-card"
    :data-typing="String(typing)"
    role="img"
    aria-label="아직 열리지 않은 오늘의 카드"
  >
    <div class="empty-top">
      <span class="empty-meta">오늘의 모먼트</span>
      <span class="empty-meta">{{ date }}</span>
    </div>
    <div class="empty-art" aria-hidden="true">
      <span class="empty-spark s1">✦</span>
      <span class="empty-spark s2">✧</span>
      <span class="empty-spark s3">✦</span>
      <img class="empty-silhouette" :src="OBJECT_ASSETS.heart" alt="" />
    </div>
    <span class="empty-dots" aria-hidden="true">○ ○ ○</span>
    <div class="empty-bottom">
      <h2>오늘의 기록을<br />기다리고 있어요</h2>
      <p class="empty-hint">{{ hintText }}</p>
    </div>
  </div>
</template>
