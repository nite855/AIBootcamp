<script setup>
import { computed } from "vue";
import { THEME_SCENES } from "../services/assets.js";

const props = defineProps({
  themeId: {
    type: String,
    required: true,
  },
});

const sceneUrl = computed(() => THEME_SCENES[props.themeId] || null);
</script>

<template>
  <div class="app-scenery" aria-hidden="true">
    <img v-if="sceneUrl" class="theme-scenery" :src="sceneUrl" alt="" />
  </div>
</template>
