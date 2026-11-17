import { CardexCore, DiaryCards } from "../domain/index.js";
import { OBJECT_ASSETS } from "./assets.js";
import { resolveCardAsset } from "./cardAssets.mjs";

const escapeXML = (value) => CardexCore.escapeHTML(value);

export const timeLabel = (value) =>
  value
    ? new Date(value).toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "";

export function readCardThemeTokens() {
  if (typeof document === "undefined") {
    return {
      paper: "#f5f0e6",
      stage: "#fffcf6",
      line: "#d8cfc8",
      ink: "#262323",
      surface: "#ffffff",
    };
  }
  const css = getComputedStyle(document.documentElement);
  const token = (name) => css.getPropertyValue(name).trim();
  return {
    paper: token("--paper"),
    stage: token("--stage"),
    line: token("--line"),
    ink: token("--ink"),
    surface: token("--surface"),
  };
}

export function getNeutralMarkPaths(type) {
  const question =
    '<path d="M8 8a4 4 0 0 1 8 0c0 3-4 3-4 6"/><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none"/>';
  const exclamation =
    '<path d="M12 4v10"/><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none"/>';
  const marks = {
    neu_1: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    neu_2: question,
    neu_3: exclamation,
    neu_4: `<g transform="translate(-2 3) scale(.8)">${question}</g><g transform="translate(9 3) scale(.8)">${exclamation}</g>`,
  };
  return marks[type] || "";
}

async function assetToDataUri(url) {
  if (!url || url.startsWith("data:")) return url;
  const response = await fetch(url);
  if (!response.ok) throw new Error("카드 캐릭터 자산을 불러오지 못했어요.");
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("카드 이미지를 인코딩하지 못했어요."));
    reader.readAsDataURL(blob);
  });
}

export function characterSVGString(
  type,
  attrs = "",
  tokens = readCardThemeTokens(),
  hrefOverride = null,
  { stage = null, cardKey = null } = {},
) {
  const emotion = CardexCore.type(type);
  const resolved = resolveCardAsset({
    cardKey,
    type: emotion.id,
    stage,
    fallbackAssets: OBJECT_ASSETS,
  });
  const href = hrefOverride || resolved.href;
  const mark = resolved.showNeutralMark ? getNeutralMarkPaths(type) : "";
  const keyAttr = resolved.cardKey ? ` data-card-key="${escapeXML(resolved.cardKey)}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-character="${emotion.id}"${keyAttr} ${attrs} aria-hidden="true" focusable="false"><image href="${escapeXML(href)}" width="100" height="100" preserveAspectRatio="xMidYMid meet"/>${
    mark
      ? `<g data-emotion-mark="${type}"><circle cx="82" cy="82" r="17" fill="${tokens.surface}" stroke="${tokens.ink}" stroke-width="1"/><g transform="translate(70 70)" fill="none" stroke="${tokens.ink}" color="${tokens.ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${mark}</g></g>`
      : ""
  }</svg>`;
}

export function buildCardSVGString(record, mode, fallbackDate, tokens = readCardThemeTokens(), hrefOverride = null) {
  const card = DiaryCards.resolve(record);
  if (card.status === "ready") {
    const asset = resolveCardAsset({ cardKey: card.cardKey, type: card.type, stage: card.stage, fallbackAssets: OBJECT_ASSETS });
    if (asset.kind === "full_card" && asset.href) {
      const name = CardexCore.type(card.type).name;
      const date = `${record?.recordDate || fallbackDate} · ${timeLabel(record?.createdAt)}`;
      const href = hrefOverride || asset.href;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1620" viewBox="0 0 1080 1620" role="img" aria-label="${escapeXML(name)} 감정 카드" class="art-card">
        <rect width="1080" height="1620" rx="40" fill="${tokens.paper}"/>
        <image href="${escapeXML(href)}" x="0" y="90" width="1080" height="1440" preserveAspectRatio="xMidYMid meet"/>
        <g fill="#302621" font-family="IBM Plex Sans KR,sans-serif">
          <text x="110" y="205" font-size="48" font-weight="600">${escapeXML(name)}</text>
          <text x="110" y="1140" font-size="36">${escapeXML(date)}</text>
          <text x="110" y="1220" font-size="44">${card.stage}단계 · 분류 확률 ${Math.round(card.score * 100)}%${card.ties.length > 1 ? " · 공동 최다" : ""}</text>
          <text x="110" y="1300" font-size="32">감정의 강도를 뜻하지 않아요</text>
          <text x="110" y="1430" font-size="30">오늘의 모먼트 · ${mode === "example" ? "예시 · 실제 입력 분석 아님" : "나의 기록"}</text>
        </g>
      </svg>`;
    }
  }
  const name =
    card.status === "ready"
      ? CardexCore.type(card.type).name
      : card.status === "blank"
        ? "빈 카드"
        : card.status === "error"
          ? "분석 실패"
          : "분석 대기";
  const artwork =
    card.status === "ready"
      ? characterSVGString(card.type, 'x="170" y="360" width="740" height="760"', tokens, hrefOverride, {
          stage: card.stage,
          cardKey: card.cardKey,
        })
      : `<rect x="180" y="480" width="720" height="480" rx="80" fill="${tokens.surface}"/><text x="540" y="730" text-anchor="middle" font-size="42">${escapeXML(
          card.status === "pending" ? "감정 분석 연결 준비 중" : name,
        )}</text>`;

  const dateText = `${escapeXML(record?.recordDate || fallbackDate)} · ${escapeXML(timeLabel(record?.createdAt))}`;
  const parentBadge =
    card.status === "ready"
      ? `<rect x="90" y="184" width="138" height="52" rx="16" fill="${tokens.surface}"/><text x="159" y="222" text-anchor="middle" font-size="32">${escapeXML(
          CardexCore.parent(CardexCore.type(card.type).parent).name,
        )}</text>`
      : "";
  const footerMeta =
    card.status === "ready"
      ? `<rect x="90" y="1150" width="210" height="74" rx="24" fill="${tokens.surface}"/><text x="195" y="1200" text-anchor="middle" font-size="40">${card.stage}단계</text><text x="90" y="1310" font-size="42">분류 확률 ${Math.round(card.score * 100)}%${
          card.ties.length > 1 ? " · 공동 최다" : ""
        }</text><text x="90" y="1380" font-size="36">감정의 강도를 뜻하지 않아요</text>`
      : `<text x="90" y="1300" font-size="38">${
          card.status === "pending"
            ? "감정 분석은 준비 중이에요"
            : card.status === "blank"
              ? "뚜렷한 대표 감정이 없는 기록이에요"
              : "기록은 그대로 읽을 수 있어요"
        }</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1620" viewBox="0 0 1080 1620" role="img" aria-label="${escapeXML(name)} 감정 카드" class="art-card">
    <rect width="1080" height="1620" rx="40" fill="${tokens.paper}"/>
    <rect x="38" y="38" width="1004" height="1544" rx="30" fill="${tokens.stage}" stroke="${tokens.line}"/>
    <g fill="${tokens.ink}" font-family="IBM Plex Sans KR,sans-serif">
      <text x="90" y="150" font-size="38">${dateText}</text>
      ${parentBadge}
      <text x="90" y="320" font-size="68" font-weight="600">${escapeXML(name)}</text>
      ${artwork}
      ${footerMeta}
      <path d="M90 1440h900" stroke="${tokens.line}"/>
      <text x="90" y="1510" font-size="32">오늘의 모먼트 · ${mode === "example" ? "예시 · 실제 입력 분석 아님" : "나의 기록"}</text>
    </g>
  </svg>`;
}

export async function exportCardPng(record, mode, fallbackDate) {
  const card = DiaryCards.resolve(record);
  if (!["ready", "blank"].includes(card.status)) return false;

  const tokens = readCardThemeTokens();
  let embeddedHref = null;
  if (card.status === "ready") {
    const resolved = resolveCardAsset({
      cardKey: card.cardKey,
      type: card.type,
      stage: card.stage,
      fallbackAssets: OBJECT_ASSETS,
    });
    embeddedHref = await assetToDataUri(resolved.href);
  }
  const svg = buildCardSVGString(record, mode, fallbackDate, tokens, embeddedHref);
  await document.fonts.ready;

  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error("이미지를 만들지 못했어요. 다시 시도해 주세요."));
      img.src = svgUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1620;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("이 브라우저에서는 이미지 저장이 어려워요.");
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("이미지를 만들지 못했어요.");
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = `moment-${record.id}-${record.recordDate}.png`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 10000);
    return true;
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
