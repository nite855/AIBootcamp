const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");

async function loadImageModules() {
  const cardAssetsMod = await import(
    pathToFileURL(path.join(ROOT, "src/services/cardAssets.mjs")).href
  );
  const cardPolicyMod = await import(
    pathToFileURL(path.join(ROOT, "src/domain/cardPolicy.mjs")).href
  );
  return { cardAssetsMod, cardPolicyMod };
}

test("public card manifest maps all 27 supplied card images without gaps", async () => {
  const { cardAssetsMod } = await loadImageModules();
  const manifestPath = path.join(ROOT, "public/assets/cards/manifest.json");
  assert.ok(fs.existsSync(manifestPath), "frontend/public/assets/cards/manifest.json must exist");

  const raw = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const validated = cardAssetsMod.validateCardManifest(raw);

  assert.equal(validated.cards.length, 27);
  assert.equal(validated.placeholder_count, 0);
  assert.equal(validated.provided_count, 27);
  assert.equal(validated.all_provided, true);
  for (const card of validated.cards) {
    assert.equal(card.kind, "full_card");
    assert.ok(fs.existsSync(path.join(ROOT, "public", card.src)), card.src);
  }
  assert.deepEqual(
    validated.cards.map((c) => c.card_key),
    cardAssetsMod.ALL_CARD_KEYS,
  );
});

test("validateCardManifest rejects missing, duplicate, wrong version, and unsafe assets", async () => {
  const { cardAssetsMod } = await loadImageModules();
  const base = cardAssetsMod.buildDefaultCardManifest();

  // Missing key (29 entries)
  const missingOne = { ...base, cards: base.cards.slice(1) };
  assert.throws(() => cardAssetsMod.validateCardManifest(missingOne), /누락된 card_key/);

  // Duplicate key
  const duplicated = {
    ...base,
    cards: [...base.cards.slice(0, 26), { ...base.cards[0] }],
  };
  assert.throws(() => cardAssetsMod.validateCardManifest(duplicated), /중복된 card_key/);

  // Taxonomy mismatch
  assert.throws(
    () => cardAssetsMod.validateCardManifest({ ...base, taxonomy_version: "old-v0" }),
    /감정 분류 버전/,
  );

  // Provided asset without rights_verified or unsafe src
  const badSrc = structuredClone(base);
  badSrc.cards[0] = {
    ...badSrc.cards[0],
    placeholder: false,
    src: "https://evil.example/a.png",
    rights_verified: true,
  };
  assert.throws(() => cardAssetsMod.validateCardManifest(badSrc), /허용되지 않는 카드 이미지 경로/);

  const missingSource = structuredClone(base);
  missingSource.cards[0] = {
    ...missingSource.cards[0],
    placeholder: false,
    src: "",
  };
  assert.throws(() => cardAssetsMod.validateCardManifest(missingSource), /경로/);
});

test("resolveCardAsset unifies placeholder baseline and future 30-card provided assets", async () => {
  const { cardAssetsMod } = await loadImageModules();
  cardAssetsMod.resetCardManifest();

  const fallbackAssets = {
    pos_1: "asset://pos_1.png",
    neg_2: "asset://neg_2.png",
    neutral: "asset://neutral.png",
  };

  // Placeholder mode uses baseline fallback and neutral marks
  const pPos = cardAssetsMod.resolveCardAsset({
    cardKey: "pos_1:3",
    fallbackAssets,
  });
  assert.equal(pPos.href, "asset://pos_1.png");
  assert.equal(pPos.placeholder, true);
  assert.equal(pPos.showNeutralMark, false);

  const pNeu = cardAssetsMod.resolveCardAsset({
    type: "neu_2",
    stage: 2,
    fallbackAssets,
  });
  assert.equal(pNeu.cardKey, "neu_2:2");
  assert.equal(pNeu.href, "asset://neutral.png");
  assert.equal(pNeu.showNeutralMark, true);

  // Provided full manifest update switches active href cleanly & notifies subscribers
  const events = [];
  const unsubscribe = cardAssetsMod.subscribeCardManifest((m) => events.push(m.manifest_version));

  const nextManifest = cardAssetsMod.buildDefaultCardManifest();
  nextManifest.manifest_version = "provided-test-v2";
  nextManifest.all_provided = true;
  nextManifest.cards = nextManifest.cards.map((item) => ({
    ...item,
    placeholder: false,
    kind: item.emotion_id.startsWith("neu_") ? "full_card" : "character",
    src: `/assets/cards/${item.emotion_id}_s${item.stage}.png`,
    rights_verified: true,
  }));

  await cardAssetsMod.loadCardManifest({
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return nextManifest;
      },
    }),
  });

  assert.deepEqual(events, ["provided-test-v2"]);
  const resolvedProvided = cardAssetsMod.resolveCardAsset({
    cardKey: "pos_1:3",
    fallbackAssets,
  });
  assert.equal(resolvedProvided.href, "/assets/cards/pos_1_s3.png");
  assert.equal(resolvedProvided.placeholder, false);
  assert.equal(resolvedProvided.showNeutralMark, false);

  const resolvedFullCard = cardAssetsMod.resolveCardAsset({
    cardKey: "neu_2:2",
    fallbackAssets,
  });
  assert.equal(resolvedFullCard.href, "/assets/cards/neu_2_s2.png");
  assert.equal(resolvedFullCard.kind, "full_card");
  assert.equal(resolvedFullCard.showNeutralMark, false);

  unsubscribe();
  cardAssetsMod.resetCardManifest();
});

test("card, catalog, thumbnails, and PNG renderer share the single manifest resolver without cropping", async () => {
  const { cardPolicyMod } = await loadImageModules();
  const cards = cardPolicyMod.createDiaryCards();
  const collection = cards.collection([]);
  assert.equal(collection.length, 27);
  assert.equal(collection[0].cardKey, "pos_1:1");
  assert.equal(collection[26].cardKey, "neu_3:3");

  const files = {
    characterMark: fs.readFileSync(path.join(ROOT, "src/components/CharacterMark.vue"), "utf8"),
    catalogView: fs.readFileSync(path.join(ROOT, "src/views/CatalogView.vue"), "utf8"),
    recordRow: fs.readFileSync(path.join(ROOT, "src/components/RecordRow.vue"), "utf8"),
    homeView: fs.readFileSync(path.join(ROOT, "src/views/HomeView.vue"), "utf8"),
    emotionCard: fs.readFileSync(path.join(ROOT, "src/components/EmotionCard.vue"), "utf8"),
    cardRenderer: fs.readFileSync(path.join(ROOT, "src/services/cardRenderer.js"), "utf8"),
    mainJs: fs.readFileSync(path.join(ROOT, "src/main.js"), "utf8"),
  };

  assert.match(files.characterMark, /resolveCardAsset/);
  assert.match(files.characterMark, /preserveAspectRatio="xMidYMid meet"/);
  assert.match(files.catalogView, /:card-key="s\.cardKey"/);
  assert.match(files.recordRow, /:card-key="card\.cardKey"/);
  assert.match(files.homeView, /:card-key="latestCard\.cardKey"/);
  assert.match(files.emotionCard, /useCardManifestVersion/);
  assert.match(files.cardRenderer, /resolveCardAsset/);
  assert.match(files.cardRenderer, /preserveAspectRatio="xMidYMid meet"/);
  assert.doesNotMatch(files.cardRenderer, /record\.text/);
  assert.match(files.mainJs, /loadCardManifest/);
});
