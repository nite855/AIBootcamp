import { onMounted, onUnmounted, ref } from "vue";

function readApi() {
  return typeof window !== "undefined" ? window.CardexTheme : null;
}

export function useTheme() {
  const api = readApi();
  const themes = api ? api.themes : [];
  const theme = ref(api ? api.getTheme() : "blossom");
  const mode = ref(api ? api.getPreference() : "light");
  const motion = ref(api ? api.getMotion() : "on");
  const themeVersion = ref(0);

  const syncFromRuntime = () => {
    const current = readApi();
    if (!current) return;
    theme.value = current.getTheme();
    mode.value = current.getPreference();
    motion.value = current.getMotion();
    themeVersion.value++;
  };

  const setTheme = (id) => {
    readApi()?.setTheme(id);
  };

  const setMode = (nextMode) => {
    readApi()?.set(nextMode);
  };

  const setMotion = (nextMotion) => {
    readApi()?.setMotion(nextMotion);
  };

  const toggleMotion = () => {
    setMotion(motion.value === "on" ? "off" : "on");
  };

  onMounted(() => {
    syncFromRuntime();
    window.addEventListener("cardex-theme-change", syncFromRuntime);
  });

  onUnmounted(() => {
    window.removeEventListener("cardex-theme-change", syncFromRuntime);
  });

  return {
    themes,
    theme,
    mode,
    motion,
    themeVersion,
    setTheme,
    setMode,
    setMotion,
    toggleMotion,
  };
}
