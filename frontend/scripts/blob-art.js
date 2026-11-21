(function (root, factory) {
  const api = factory();
  if (typeof module === "object") module.exports = api;
  else root.MomentBlob = api;
})(globalThis, function () {
  "use strict";
  // Card character (2026-11-22): the soft "blob" from Figma "Moment Card" (file NaEAXNfEgTB3e3bPZJ0FkX,
  // node "character · 블롭", 213.2 viewBox incl. glow padding). One shape for every emotion; the
  // emotion only sets the color (the card's --card-deep-* tone). Values are copied from the Figma
  // export: glow r78 / blur 14.3, white inner shadow (-7.8, -10.4, blur 10.4, .55), white grain
  // (fractal noise .769, 3 octaves, .6) and two glowing pill eyes (10.4 × 23.4, 8°, blur 5.2).
  // Filter ids carry a per-drawing prefix so many blobs (rails, catalog, PNG export) never collide.
  const VIEW = 213.2;
  const DEFAULT_COLOR = "#9a9aa4";
  const PATH = "M96.343 45.9977C102.53 41.7769 110.67 41.7769 116.857 45.9977L118.861 47.3648C122.146 49.6057 126.074 50.7093 130.045 50.5068L132.447 50.3843C140.128 49.9927 147.227 54.4719 150.179 61.5738L150.587 62.5539C152.194 66.4188 155.084 69.6117 158.77 71.5948L159.737 72.1152C166.793 75.9111 170.503 83.9076 168.851 91.7474V91.7474C167.957 95.9891 168.62 100.414 170.72 104.206V104.206C174.65 111.304 173.357 120.152 167.56 125.829L167.294 126.089C164.22 129.099 162.312 133.101 161.908 137.384L161.878 137.695C161.138 145.549 155.421 152.032 147.722 153.75L145.966 154.141C141.999 155.026 138.443 157.214 135.863 160.355L134.693 161.781C129.906 167.611 122.018 169.884 114.863 167.495L112.364 166.66C108.623 165.411 104.577 165.411 100.836 166.66L98.3373 167.495C91.182 169.884 83.2945 167.611 78.5074 161.781L77.3367 160.355C74.7574 157.214 71.2007 155.026 67.2336 154.141L65.4784 153.75C57.7787 152.032 52.0623 145.549 51.3216 137.695L51.2923 137.384C50.8884 133.101 48.9801 129.099 45.906 126.089L45.6404 125.829C39.8433 120.152 38.5502 111.304 42.4803 104.206V104.206C44.5802 100.414 45.2433 95.9891 44.3494 91.7474V91.7474C42.6972 83.9076 46.407 75.9111 53.4628 72.1152L54.4303 71.5948C58.1164 69.6117 61.0063 66.4188 62.6132 62.5539L63.0206 61.5738C65.9733 54.4719 73.0715 49.9927 80.7528 50.3843L83.1553 50.5068C87.1264 50.7093 91.0545 49.6057 94.3391 47.3648L96.343 45.9977Z";
  const GRAIN = "0 0 0 0 0 0 0 0 0 0 0 0 0 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0";
  let seq = 0;
  // Only #rgb / #rrggbb (optionally with alpha) reach the markup; anything else falls back to grey.
  function safeColor(value) {
    const color = String(value || "").trim();
    return /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color) ? color : DEFAULT_COLOR;
  }
  function safeId(value) {
    const id = String(value || "").replace(/[^A-Za-z0-9_-]/g, "");
    return id || "blob" + (++seq);
  }
  // Filter and shape markup only (no <svg>), for embedding in another SVG.
  function blobBody(color, uid) {
    const fill = safeColor(color), id = safeId(uid);
    const eye = x => `<g filter="url(#${id}-eye)"><rect x="${x}" y="88.4" width="10.4" height="23.4" rx="5.2" transform="rotate(8 ${x} 88.4)" fill="#ffffff"/></g>`;
    return `<defs>`
      + `<filter id="${id}-glow" x="0" y="0" width="213.2" height="213.2" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="14.3"/></filter>`
      + `<filter id="${id}-skin" x="32.4226" y="32.4321" width="140.555" height="136" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">`
      + `<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>`
      + `<feOffset dx="-7.8" dy="-10.4"/><feGaussianBlur stdDeviation="10.4"/><feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>`
      + `<feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.55 0"/><feBlend mode="normal" in2="SourceGraphic" result="shade"/>`
      + `<feTurbulence type="fractalNoise" baseFrequency="0.76923072338104248" stitchTiles="stitch" numOctaves="3" seed="0" result="noise"/>`
      + `<feColorMatrix in="noise" type="luminanceToAlpha" result="alphaNoise"/><feComponentTransfer in="alphaNoise" result="grain"><feFuncA type="discrete" tableValues="${GRAIN}"/></feComponentTransfer>`
      + `<feComposite operator="in" in="grain" in2="shade" result="grainClip"/><feFlood flood-color="#ffffff" flood-opacity="0.6"/><feComposite operator="in" in2="grainClip" result="grainColor"/>`
      + `<feMerge><feMergeNode in="shade"/><feMergeNode in="grainColor"/></feMerge></filter>`
      + `<filter id="${id}-eye" x="78" y="78.6" width="54" height="44.2" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">`
      + `<feGaussianBlur in="SourceAlpha" stdDeviation="5.2"/><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.9 0"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>`
      + `</defs>`
      + `<g data-blob-part="glow" opacity="0.45" filter="url(#${id}-glow)"><circle cx="106.6" cy="106.6" r="78" fill="${fill}"/></g>`
      + `<g data-blob-part="body" filter="url(#${id}-skin)"><path d="${PATH}" fill="${fill}"/></g>`
      + eye(91) + eye(111.8);
  }
  // A standalone <svg> (attrs: class, or x/y/width/height when nested in the card SVG).
  function blobSVG({ color, uid, attrs = "", character = "" } = {}) {
    const data = character ? ` data-character="${String(character).replace(/[^a-z0-9_]/gi, "")}"` : "";
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW} ${VIEW}" overflow="visible"${data} ${attrs} aria-hidden="true" focusable="false">${blobBody(color, uid)}</svg>`;
  }
  return { VIEW, DEFAULT_COLOR, PATH, safeColor, blobBody, blobSVG };
});
