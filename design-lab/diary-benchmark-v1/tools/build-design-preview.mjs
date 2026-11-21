import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { buildTokens } from './build-tokens.mjs';

const root = new URL('../',import.meta.url);
const read = p => readFile(new URL(p,root),'utf8');
const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
await buildTokens({check:process.argv.includes('--check')});
const [base,diary,material,tokens,themeData,theme,fixtures,primitives,license] = await Promise.all([
  'styles/base.css','styles/diary.css','styles/themes.css','styles/generated/tokens.css',
  'scripts/generated/theme-tokens.js','scripts/theme.js','design/fixtures/ui-states.json','design/tokens/primitives.json','docs/licenses/ibm-plex-sans-kr.txt',
].map(read));
const states = JSON.parse(fixtures);
const flip = await read("styles/flip.css");
if (states.synthetic !== true) throw Error('Preview fixtures must be synthetic');
const palette = ['background','surface','text','text-muted','action','on-action','border','error','positive','negative','neutral'];
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>오늘의 모먼트 · 디자인 검토</title><script>${themeData}${theme}</script><style>
${base.split('\n').filter(x=>x.startsWith('@font-face')).join('\n')}
${diary}\n${material}\n${tokens}\n${flip}
body{height:auto;overflow:auto;background:var(--paper);color:var(--ink)}main{max-width:1100px;margin:auto;padding:24px;display:grid;gap:24px}header{display:block}h1{font-size:30px;line-height:1.4;letter-spacing:-1px}h2{margin-bottom:12px}.review-controls{display:flex;gap:16px;flex-wrap:wrap}.review-controls label{display:grid;gap:6px}.review-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:16px}.review-swatch{border:1px solid var(--line);padding:12px;border-radius:8px;overflow-wrap:anywhere}.review-swatch i{display:block;height:48px;border:1px solid var(--line);margin-bottom:8px}.review-spacing{height:12px;background:var(--blue);max-width:100%}.review-components{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.review-state{padding:12px;border:1px solid var(--line);overflow-wrap:anywhere}.review-help{font-size:13px;color:var(--muted)}a{color:var(--blue)}.review-type{overflow-wrap:anywhere}@media(max-width:500px){main{padding:16px}h1{font-size:26px}}
</style></head><body><main>
<header><h1>디자인 검토</h1><p>현재 토큰과 실제 앱 스타일을 사용하는 개발용 검토 페이지입니다.</p><p class="review-help">합성 예시만 사용합니다. 상태 문구 견본은 실제 분석·저장 기능이 아닙니다.</p><p><a href="../../UI_SPEC.md">화면 명세</a> · <a href="../../wireframes/index.html">와이어프레임</a> · <a href="../README.md">디자인 안내</a> · <a href="../../../index.html">실제 앱</a></p></header>
<nav class="review-controls" aria-label="미리보기 설정"><label>테마<select id="review-theme"></select></label><label>밝기<select id="theme-preference"><option value="light">밝음</option><option value="dark">어두움</option><option value="system">시스템</option></select></label></nav>
<section class="panel"><h2>의미별 색상</h2><div class="review-grid">${palette.map(n=>`<div class="review-swatch"><i style="background:var(--color-${n})" aria-hidden="true"></i><code>--color-${n}</code></div>`).join('')}</div></section>
<section class="panel"><h2>글자와 간격</h2><div class="review-grid"><div class="review-type"><h2>패널 제목 23px</h2><p>본문은 한글·English·123을 함께 확인합니다.</p><p class="muted">보조 문구의 실제 크기와 대비를 확인합니다.</p><label for="review-input">입력 예시</label><div class="editor"><textarea id="review-input">오늘의 작은 순간을 기록합니다.</textarea></div></div><div>${Object.keys(JSON.parse(primitives)).filter(k=>k.startsWith('space-')).map(k=>`<div><code>${k}</code><div class="review-spacing" style="width:var(--${k})"></div></div>`).join('')}</div></div></section>
<section class="panel"><h2>컴포넌트 상태</h2><div class="review-components"><button class="primary">주요 동작</button><button class="quiet">보조 동작</button><button class="primary" disabled>처리 중</button></div><p class="status">안내 문구</p><p class="status error">오류 문구 · 다시 시도할 동작을 안내합니다.</p><div class="archive-tabs"><button class="active">선택한 탭</button><button>다른 탭</button></div><p class="review-help">이 영역은 외형·키보드 초점 견본입니다. 제품의 화면 전환은 실제 앱에서 확인하세요.</p></section>
<section class="panel"><h2>합성 상태·긴 문구</h2><div class="review-grid">${states.states.map(s=>`<article class="review-state" data-state="${escape(s.id)}"><h3>${escape(s.id)}</h3><p>${escape(s.label)}</p></article>`).join('')}</div></section>
<section class="panel"><h2>감정 분류</h2>${Object.entries(states.emotionGroups).map(([name, leaves]) => `<p><strong>${escape(name)}</strong> · ${leaves.map(escape).join(" / ")}</p>`).join("")}<p>중립은 객관적 서술·의문·놀람·당황을 포함합니다. 분류 확률은 감정의 강도가 아닙니다.</p></section><section class="panel"><h2>재질·자산 검토</h2><p>이 패널은 실제 .panel 테마 재질을 재사용합니다. 카드·차트·도감은 <a href="../../../index.html">실제 앱의 예시 모드</a>에서 확인하세요. 기존 3D PNG 7종과 중립 4종의 SVG 표식, 3단계 배지를 조합해 30개 도감 슬롯을 표시합니다.</p></section>
</main><script>
const control=document.getElementById('review-theme');
for(const t of CardexTheme.themes){const o=document.createElement('option');o.value=t.id;o.textContent=t.name;control.append(o);}
control.value=CardexTheme.getTheme();control.addEventListener('change',()=>CardexTheme.setTheme(control.value));
window.addEventListener('cardex-theme-change',()=>control.value=CardexTheme.getTheme());
</script><script type="text/plain" id="embedded-font-license">${license.replace(/<\/script/gi,'<\\/script')}</script></body></html>\n`;
const output = new URL('docs/design/preview/index.html',root);
if (process.argv.includes('--check')) {
  if (await readFile(output,'utf8') !== html) throw Error('Stale design preview');
} else {
  await mkdir(new URL('./',output),{recursive:true});
  await writeFile(output,html);
}
console.log('Design preview: OK');
