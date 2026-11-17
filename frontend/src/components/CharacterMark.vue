<script setup>
import { computed } from "vue";
import { CardexCore } from "../domain/index.js";
import { OBJECT_ASSETS } from "../services/assets.js";
import { resolveCardAsset } from "../services/cardAssets.mjs";
import { readCardThemeTokens } from "../services/cardRenderer.js";
import { useTheme } from "../composables/useTheme.js";
import { useCardManifestVersion } from "../composables/useCardAssets.js";

const props = defineProps({
  type: {
    type: String,
    required: true,
  },
  stage: {
    type: Number,
    default: null,
  },
  cardKey: {
    type: String,
    default: null,
  },
  extraClass: {
    type: String,
    default: "",
  },
});

const { themeVersion } = useTheme();
const manifestVersion = useCardManifestVersion();

const emotion = computed(() => CardexCore.type(props.type));
const cardAsset = computed(() => {
  void manifestVersion.value;
  return resolveCardAsset({
    cardKey: props.cardKey,
    type: emotion.value.id,
    stage: props.stage,
    fallbackAssets: OBJECT_ASSETS,
  });
});
const tokens = computed(() => {
  void themeVersion.value;
  return readCardThemeTokens();
});
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 100"
    :data-character="emotion.id"
    :data-card-key="cardAsset.cardKey || undefined"
    :class="extraClass || undefined"
    aria-hidden="true"
    focusable="false"
  >
    <image :href="cardAsset.href" width="100" height="100" preserveAspectRatio="xMidYMid meet" />
    <g v-if="cardAsset.showNeutralMark" :data-emotion-mark="type">
      <circle cx="82" cy="82" r="17" :fill="tokens.surface" :stroke="tokens.ink" stroke-width="1" />
      <g
        transform="translate(70 70)"
        fill="none"
        :stroke="tokens.ink"
        :color="tokens.ink"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <template v-if="type === 'neu_1'">
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </template>
        <template v-else-if="type === 'neu_2'">
          <path d="M8 8a4 4 0 0 1 8 0c0 3-4 3-4 6" />
          <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
        </template>
        <template v-else-if="type === 'neu_3'">
          <path d="M12 4v10" />
          <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
        </template>
        <template v-else-if="type === 'neu_4'">
          <g transform="translate(-2 3) scale(.8)">
            <path d="M8 8a4 4 0 0 1 8 0c0 3-4 3-4 6" />
            <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
          </g>
          <g transform="translate(9 3) scale(.8)">
            <path d="M12 4v10" />
            <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
          </g>
        </template>
      </g>
    </g>
  </svg>
</template>
