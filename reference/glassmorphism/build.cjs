// Rebuild editable SVG specimens and the local gallery; PNG originals are preserved.
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const icons = {
  home: ['홈', '<path d="M28 61 64 29l36 32M36 56v42h20V76h16v22h20V56"/>'],
  'diary-write': ['일기 작성', '<rect x="31" y="25" width="58" height="78" rx="10"/><path d="M43 25v78M53 45h21M53 58h17M70 88l8-19 21-21 9 9-21 21Z"/>'],
  'emotion-heart': ['감정 하트', '<path d="M64 100C53 90 25 72 25 49c0-23 27-30 39-10 12-20 39-13 39 10 0 23-28 41-39 51Z"/>'],
  'emotion-card': ['감정 카드', '<rect x="33" y="23" width="62" height="84" rx="13"/><circle cx="64" cy="56" r="19"/><path d="M57 59q7 9 14 0M48 87h32"/><path d="M57 50h.1M71 50h.1"/>'],
  archive: ['보관함', '<rect x="28" y="45" width="72" height="55" rx="10"/><rect x="23" y="28" width="82" height="22" rx="7"/><path d="M52 68h24"/>'],
  calendar: ['달력', '<rect x="27" y="31" width="74" height="70" rx="11"/><path d="M27 53h74M46 23v18M82 23v18M44 68h4M62 68h4M80 68h4M44 84h4M62 84h4M80 84h4"/>'],
  statistics: ['감정 통계', '<rect x="29" y="68" width="17" height="32" rx="5"/><rect x="56" y="46" width="17" height="54" rx="5"/><rect x="83" y="25" width="17" height="75" rx="5"/>'],
  settings: ['설정', '<path d="m55 24 18 0 3 12 10 5 11-4 9 16-9 9v11l9 8-9 16-12-4-9 5-3 12H55l-3-12-10-5-11 4-9-16 9-8V62l-9-9 9-16 11 4 10-5Z"/><circle cx="64" cy="67" r="16"/>'],
};
const defs = `<defs>
  <linearGradient id="glass" x2="1" y2="1"><stop stop-color="#fff" stop-opacity=".9"/><stop offset=".45" stop-color="#c4b5fd" stop-opacity=".56"/><stop offset=".75" stop-color="#bae6fd" stop-opacity=".55"/><stop offset="1" stop-color="#ffd1bd" stop-opacity=".74"/></linearGradient>
  <linearGradient id="accent" x2="1" y2="1"><stop stop-color="#a78bfa"/><stop offset="1" stop-color="#7360cc"/></linearGradient>
  <linearGradient id="background" x2="1" y2="1"><stop stop-color="#fce5df"/><stop offset=".5" stop-color="#e5ddfc"/><stop offset="1" stop-color="#cce9f7"/></linearGradient>
  <filter id="shadow" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#7567a1" flood-opacity=".22"/></filter>
  <style>text{font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;fill:#342748}.small{font-size:15px;fill:#655874}.title{font-size:26px;font-weight:700}.label{font-size:17px}</style>
</defs>`;
const svg = (w,h,title,body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title"><title id="title">${title}</title>${defs}${body}</svg>\n`;
const rect=(x,y,w,h,r=18,fill='url(#glass)')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="white" stroke-opacity=".85" stroke-width="1.5"/>`;
const text=(x,y,s,cls='label')=>`<text x="${x}" y="${y}" class="${cls}">${s}</text>`;
const symbol=(key,x,y,size=48)=>`<g transform="translate(${x} ${y}) scale(${size/128})" fill="url(#glass)" stroke="#6e59a0" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${icons[key][1]}</g>`;
const button=(x,y,w,s,fill='url(#accent)',white=true)=>rect(x,y,w,46,16,fill)+`<text x="${x+w/2}" y="${y+29}" text-anchor="middle" style="font-size:16px;fill:${white?'#fff':'#544765'}">${s}</text>`;
const shell=(w,h,body)=>`<rect width="${w}" height="${h}" rx="28" fill="url(#background)"/><g filter="url(#shadow)">${rect(20,20,w-40,h-40,26)}</g>${body}`;
const components = {
  'diary-input': ['일기 입력 패널',640,460,
    text(48,63,'TODAY · 11월 4일','small')+text(48,105,'오늘의 작은 순간','title')+rect(44,130,552,205,18,'#ffffff55')+text(64,168,'잠깐의 산책으로 마음이 가벼워졌다.')+text(64,204,'오늘은 나에게 조금 더 다정해지기로 했다.')+[232,270,308].map(y=>`<path d="M64 ${y}H576" stroke="#9d8db4" opacity=".22"/>`).join('')+text(48,390,'가상 예시 · 나만의 기록','small')+button(438,360,152,'기록 저장')],
  'emotion-card': ['오늘의 감정 카드',400,580,
    text(44,68,'TODAY’S MOMENT','small')+symbol('emotion-heart',80,100,240)+text(52,378,'마음에 찾아온 평온','title')+text(52,418,'잠시 쉬어 가도 괜찮아요.')+text(52,485,'2026.11.04 · 가상 예시','small')+['#b5a0ed','#9acbe4','#efb6a6'].map((c,i)=>`<circle cx="${58+i*27}" cy="523" r="7" fill="${c}"/>`).join('')],
  'record-list': ['지난 기록 목록',640,460,
    text(44,68,'차곡차곡 쌓인 순간','title')+['햇살 아래 짧은 산책','따뜻한 차 한 잔','나에게 건넨 응원'].map((s,i)=>{const y=94+i*105;return rect(42,y,556,88)+symbol(['emotion-heart','diary-write','emotion-card'][i],54,y+12,64)+text(132,y+35,s)+text(132,y+63,`11월 ${4-i}일 · 가상 기록`,'small')+text(565,y+50,'›');}).join('')],
  'weekly-chart': ['주간 감정 차트',640,460,
    text(44,68,'이번 주 마음의 흐름','title')+text(44,101,'가상 예시 · 평온을 느낀 정도','small')+[170,230,290,350].map(y=>`<path d="M64 ${y}H580" stroke="#8a7e9d" opacity=".18"/>`).join('')+[100,154,128,200,174,216,182].map((v,i)=>rect(68+i*73,350-v,34,v,12,'url(#accent)')+text(76+i*73,380,['월','화','수','목','금','토','일'][i],'small')).join('')],
  'bottom-nav': ['하단 내비게이션',640,170,
    rect(35,35,135,100,22,'#c4b5fd88')+['home','diary-write','archive','statistics'].map((k,i)=>symbol(k,80+i*147,42,47)+text(87+i*147,116,['홈','작성','기록','통계'][i],'small')).join('')],
  buttons: ['버튼 상태 세트',640,220,
    text(44,65,'순간을 남기는 작은 동작','title')+button(42,100,174,'기록 저장')+button(234,100,174,'미리보기','url(#glass)',false)+button(426,100,174,'사용 불가','#d8d3e0',false)+text(100,178,'기본','small')+text(294,178,'보조','small')+text(480,178,'비활성','small')],
};
for(const folder of ['icons','components']) fs.mkdirSync(path.join(root,folder),{recursive:true});
const entries=[];
for(const [key,[label,body]] of Object.entries(icons)) {
  const name=`icons/icon-${key}`;
  fs.writeFileSync(path.join(root,name+'.svg'),svg(128,128,label,`<g filter="url(#shadow)" fill="url(#glass)" stroke="#7862aa" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">${body}</g>`));
  entries.push({name,label,kind:'icon'});
}
for(const [key,[label,w,h,body]] of Object.entries(components)) {
  const name=`components/component-${key}`;
  fs.writeFileSync(path.join(root,name+'.svg'),svg(w,h,label,shell(w,h,body)));
  entries.push({name,label,kind:'component'});
}
fs.writeFileSync(path.join(root,'preview.html'),`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>오늘의 모먼트 · Glass study</title><style>
*{box-sizing:border-box}body{margin:0;color:#342748;background:linear-gradient(120deg,#f9e9e3,#eee9fb 45%,#deedf8);font:16px/1.6 'Malgun Gothic',sans-serif}main{max-width:1200px;margin:auto;padding:48px 24px}h1{font-size:clamp(28px,5vw,52px);letter-spacing:-2px;margin:12px 0}header p{max-width:680px;color:#695d78}.eyebrow{letter-spacing:3px;font-size:12px}button{font:inherit;border:1px solid #9683b7;border-radius:24px;padding:8px 18px;background:#ffffff88;color:#342748;cursor:pointer}button[aria-pressed=true]{background:#67518e;color:white}nav{display:flex;flex-wrap:wrap;gap:8px;margin:24px 0}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}article{min-width:0;padding:20px;border:1px solid #ffffffdd;background:#ffffff66;border-radius:24px}h3{margin:0 0 16px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}figure{margin:0;min-width:0}.stage{height:240px;display:flex;align-items:center;justify-content:center;border-radius:16px;overflow:hidden;background:#f8f5fc}.stage img{display:block;width:100%;height:100%;object-fit:contain;min-width:0;min-height:0}.icon .stage img{width:85%;height:85%}.dark .stage{background:#272233}.checker .stage{background:conic-gradient(#d5d0df 25%,#f6f4fa 0 50%,#d5d0df 0 75%,#f6f4fa 0) 0 0/20px 20px}figcaption{margin-top:8px;font-size:13px}a{color:#60458b}.sizes{display:flex;align-items:center;gap:14px;margin-top:18px}.sizes img{object-fit:contain}.sizes span{font-size:12px;color:#695d78}footer{margin-top:36px;color:#695d78}@media(max-width:650px){main{padding:24px 16px}.grid{grid-template-columns:1fr}.stage{height:180px}article{padding:14px}.pair{gap:8px}}
</style><main><header><div class="eyebrow">MOMENT / MATERIAL STUDY 01</div><h1>유리에 담긴 작은 순간</h1><p>라벤더, 푸른빛, 복숭아빛 반사광으로 표현한 다이어리 UI. PNG는 입체 재질 콘셉트, SVG는 편집 가능한 형태·한글 명세입니다.</p></header><nav aria-label="아이콘 검토 배경"><button data-bg="light" aria-pressed="true">밝은 배경</button><button data-bg="dark" aria-pressed="false">어두운 배경</button><button data-bg="checker" aria-pressed="false">투명도 확인</button></nav><div class="grid">${entries.map(e=>`<article class="${e.kind}"><h3>${e.label}</h3><div class="pair">${['png','svg'].map(ext=>`<figure><div class="stage"><img src="${e.name}.${ext}" alt="${e.label} ${ext.toUpperCase()} 디자인"></div><figcaption><a href="${e.name}.${ext}">${ext.toUpperCase()} 원본 열기</a></figcaption></figure>`).join('')}</div>${e.kind==='icon'?`<div class="sizes">${[32,48,64].map(n=>`<img src="${e.name}.svg" width="${n}" height="${n}" alt="${n}px ${e.label}">`).join('')}<span>32 / 48 / 64px</span></div>`:''}</article>`).join('')}</div><footer>가상 데이터 · 디자인 참고용 · <a href="README.md">제작 기록</a></footer></main><script>document.querySelectorAll('[data-bg]').forEach(button=>button.addEventListener('click',()=>{document.body.className=button.dataset.bg;document.querySelectorAll('[data-bg]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));}));</script></html>`);
console.log('Created 14 editable SVGs and preview.html');
