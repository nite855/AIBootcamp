import {
  CARD_POLICY_VERSION,
  EMOTION_IDS,
  TAXONOMY_VERSION,
} from "../domain/cardPolicy.mjs";

export const MANIFEST_PATH = "/assets/cards/manifest.json";
export const CARD_STAGES = Object.freeze([1, 2, 3]);
export const ALL_CARD_KEYS = Object.freeze(
  EMOTION_IDS.flatMap((id) => CARD_STAGES.map((stage) => `${id}:${stage}`)),
);

const DEFAULT_ASSET_KEY = Object.freeze({
  pos_1: "pos_1",
  pos_2: "pos_2",
  pos_3: "pos_3",
  neg_1: "neg_1",
  neg_2: "neg_2",
  neg_3: "neg_3",
  neu_1: "neutral",
  neu_2: "neutral",
  neu_3: "neutral",
});

export function parseCardKey(cardKey) {
  if (typeof cardKey !== "string") return null;
  const match = cardKey.match(/^(pos_[1-3]|neg_[1-3]|neu_[1-3]):([1-3])$/);
  if (!match) return null;
  return {
    card_key: cardKey,
    emotion_id: match[1],
    stage: Number(match[2]),
  };
}

export function buildDefaultCardManifest() {
  const cards = ALL_CARD_KEYS.map((cardKey) => {
    const parsed = parseCardKey(cardKey);
    return {
      card_key: parsed.card_key,
      emotion_id: parsed.emotion_id,
      stage: parsed.stage,
      asset_key: DEFAULT_ASSET_KEY[parsed.emotion_id],
      kind: "character",
      src: null,
      placeholder: true,
      rights_verified: false,
    };
  });

  return {
    manifest_version: "placeholder-baseline-v1",
    taxonomy_version: TAXONOMY_VERSION,
    card_policy_version: CARD_POLICY_VERSION,
    all_provided: false,
    cards,
  };
}

export function validateCardManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("카드 이미지 manifest 형식이 올바르지 않습니다.");
  }
  if (manifest.taxonomy_version !== TAXONOMY_VERSION) {
    throw new Error(`지원하지 않는 감정 분류 버전입니다: ${manifest.taxonomy_version}`);
  }
  if (manifest.card_policy_version !== CARD_POLICY_VERSION) {
    throw new Error(`지원하지 않는 카드 정책 버전입니다: ${manifest.card_policy_version}`);
  }
  if (!Array.isArray(manifest.cards)) {
    throw new Error("manifest.cards 배열이 필요합니다.");
  }

  const seen = new Set();
  const cardsByKey = Object.create(null);
  let providedCount = 0;
  let placeholderCount = 0;

  for (const item of manifest.cards) {
    if (!item || typeof item !== "object") {
      throw new Error("manifest 카드 항목 형식이 올바르지 않습니다.");
    }
    const parsed = parseCardKey(item.card_key);
    if (!parsed) {
      throw new Error(`알 수 없는 card_key입니다: ${item.card_key}`);
    }
    if (seen.has(parsed.card_key)) {
      throw new Error(`중복된 card_key입니다: ${parsed.card_key}`);
    }
    if (item.emotion_id !== parsed.emotion_id || item.stage !== parsed.stage) {
      throw new Error(`card_key와 emotion_id/stage가 일치하지 않습니다: ${parsed.card_key}`);
    }
    if (!["character", "full_card"].includes(item.kind)) {
      throw new Error(`지원하지 않는 카드 렌더링 kind입니다: ${item.kind}`);
    }
    const isPlaceholder = Boolean(item.placeholder);
    if (isPlaceholder) {
      placeholderCount += 1;
      if (!item.asset_key || !Object.hasOwn(DEFAULT_ASSET_KEY, parsed.emotion_id)) {
        throw new Error(`임시 자산 키가 누락되었습니다: ${parsed.card_key}`);
      }
    } else {
      providedCount += 1;
      if (typeof item.src !== "string" || !item.src.trim()) {
        throw new Error(`제공된 카드 이미지 경로(src)가 비어 있습니다: ${parsed.card_key}`);
      }
      if (!item.src.startsWith("/assets/cards/") && !item.src.startsWith("data:")) {
        throw new Error(`허용되지 않는 카드 이미지 경로입니다: ${item.src}`);
      }
    }

    seen.add(parsed.card_key);
    cardsByKey[parsed.card_key] = Object.freeze({ ...item });
  }

  const missingKeys = ALL_CARD_KEYS.filter((k) => !seen.has(k));
  if (missingKeys.length > 0) {
    throw new Error(`누락된 card_key가 있습니다 (${missingKeys.length}개): ${missingKeys.join(", ")}`);
  }

  return Object.freeze({
    manifest_version: String(manifest.manifest_version || "unknown"),
    taxonomy_version: manifest.taxonomy_version,
    card_policy_version: manifest.card_policy_version,
    all_provided: providedCount === ALL_CARD_KEYS.length && Boolean(manifest.all_provided),
    provided_count: providedCount,
    placeholder_count: placeholderCount,
    cards: Object.freeze(ALL_CARD_KEYS.map((k) => cardsByKey[k])),
    cardsByKey: Object.freeze(cardsByKey),
  });
}

let activeManifest = validateCardManifest(buildDefaultCardManifest());
const manifestListeners = new Set();

function notifyManifestListeners() {
  for (const listener of manifestListeners) {
    try {
      listener(activeManifest);
    } catch {
      // Ignore subscriber errors during manifest refresh.
    }
  }
}

export function getActiveCardManifest() {
  return activeManifest;
}

export function setActiveCardManifest(rawManifest) {
  activeManifest = validateCardManifest(rawManifest);
  notifyManifestListeners();
  return activeManifest;
}

export function resetCardManifest() {
  activeManifest = validateCardManifest(buildDefaultCardManifest());
  notifyManifestListeners();
  return activeManifest;
}

export function subscribeCardManifest(listener) {
  manifestListeners.add(listener);
  return () => manifestListeners.delete(listener);
}

export async function loadCardManifest({
  fetchImpl = globalThis.fetch,
  url = MANIFEST_PATH,
} = {}) {
  if (typeof fetchImpl !== "function") {
    return activeManifest;
  }
  try {
    const response = await fetchImpl(url, { headers: { Accept: "application/json" } });
    if (!response || !response.ok) {
      return activeManifest;
    }
    const raw = await response.json();
    return setActiveCardManifest(raw);
  } catch {
    return activeManifest;
  }
}

/**
 * Resolves card or character image href and rendering metadata via the
 * manifest-driven card_key lookup table instead of ad-hoc path concatenation.
 */
export function resolveCardAsset({
  cardKey = null,
  type = null,
  stage = null,
  fallbackAssets = {},
  manifest = activeManifest,
} = {}) {
  const normalizedKey =
    parseCardKey(cardKey)?.card_key ||
    (type && EMOTION_IDS.includes(type) ? `${type}:${stage || 1}` : null);
  const parsed = parseCardKey(normalizedKey);
  if (!parsed) {
    return {
      cardKey: null,
      emotionId: null,
      stage: null,
      assetKey: null,
      href: "",
      kind: "character",
      placeholder: true,
      showNeutralMark: false,
    };
  }

  const entry = manifest?.cardsByKey?.[parsed.card_key] || {
    card_key: parsed.card_key,
    emotion_id: parsed.emotion_id,
    stage: parsed.stage,
    asset_key: DEFAULT_ASSET_KEY[parsed.emotion_id],
    kind: "character",
    src: null,
    placeholder: true,
  };

  if (!entry.placeholder && entry.src) {
    return {
      cardKey: parsed.card_key,
      emotionId: parsed.emotion_id,
      stage: parsed.stage,
      assetKey: entry.asset_key || parsed.emotion_id,
      href: entry.src,
      kind: entry.kind || "character",
      placeholder: false,
      showNeutralMark: entry.kind !== "full_card" && parsed.emotion_id.startsWith("neu_"),
    };
  }

  const fallbackKey = entry.asset_key || DEFAULT_ASSET_KEY[parsed.emotion_id];
  return {
    cardKey: parsed.card_key,
    emotionId: parsed.emotion_id,
    stage: parsed.stage,
    assetKey: fallbackKey,
    href: fallbackAssets?.[fallbackKey] || "",
    kind: "character",
    placeholder: true,
    showNeutralMark: parsed.emotion_id.startsWith("neu_"),
  };
}
