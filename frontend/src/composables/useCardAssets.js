import { onMounted, onUnmounted, ref } from "vue";
import { subscribeCardManifest } from "../services/cardAssets.mjs";

/** Reactive manifest revision tracker for Vue views/components. */
export function useCardManifestVersion() {
  const manifestVersion = ref(0);
  let unsubscribe = null;

  onMounted(() => {
    unsubscribe = subscribeCardManifest(() => {
      manifestVersion.value += 1;
    });
  });

  onUnmounted(() => {
    unsubscribe?.();
  });

  return manifestVersion;
}
