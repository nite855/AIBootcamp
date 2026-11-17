<script setup>
import { computed } from "vue";
import { THEME_SCENES } from "../services/assets.js";

const props = defineProps({
  themeId: {
    type: String,
    required: true,
  },
  mode: {
    type: String,
    default: "light",
  },
  large: {
    type: Boolean,
    default: false,
  },
});

const sceneUrl = computed(() => THEME_SCENES[props.themeId] || null);
</script>

<template>
  <div
    class="theme-preview"
    :class="{ 'large-preview': large }"
    :data-appearance="themeId"
    :data-theme="mode"
    aria-hidden="true"
  >
    <div class="sample-banner">
      <img v-if="sceneUrl" class="theme-scenery" :src="sceneUrl" alt="" />
      <span v-else class="theme-scenery abstract-scenery" aria-hidden="true">✦</span>
      <span>오늘의 모먼트</span>
      <strong>작은 하루를 모아요</strong>
    </div>
    <div class="sample-body">
      <div class="sample-paper">
        <small>11월 14일 · 오늘</small>
        <strong>산책길에 만난 작은 행복</strong>
        <p>따뜻한 바람과 좋아하는 음악.<br />오늘도 나만의 속도로 걸었어요.</p>
      </div>
      <div class="sample-paper sample-secondary">
        <small>나의 최근 기록</small>
        <p>마음에 남은 순간을 기록해요.</p>
      </div>
      <span class="sample-action">기록 남기기</span>
    </div>
  </div>
</template>
