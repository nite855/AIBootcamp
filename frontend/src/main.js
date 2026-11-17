import { createApp } from "vue";

// Preserve exact BASE-01 style cascade order:
// fonts (@font-face only) -> diary -> themes -> generated tokens -> flip -> benchmark -> moment
import "virtual:moment-fonts.css";
import "../styles/diary.css";
import "../styles/themes.css";
import "../styles/generated/tokens.css";
import "../styles/flip.css";
import "../styles/benchmark.css";
import "../styles/moment.css";

import App from "./App.vue";
import { loadCardManifest } from "./services/cardAssets.mjs";

void loadCardManifest();
createApp(App).mount("#app");
