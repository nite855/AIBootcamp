
const config = __CONFIG__;
const hashes = __HASHES__;
const page = await figma.getNodeByIdAsync(__PAGE__);
await figma.setCurrentPageAsync(page);
const made=[], links=[], frames={};
const track=n=>{made.push(n.id);return n;};
for(const style of ['Regular','Medium','SemiBold','Bold']) await figma.loadFontAsync({family:'IBM Plex Sans KR',style});
const rgb=h=>({r:parseInt(h.slice(1,3),16)/255,g:parseInt(h.slice(3,5),16)/255,b:parseInt(h.slice(5,7),16)/255});
const paint=h=>[{type:'SOLID',color:rgb(h)}];
let colors;
function box(parent,name,width,{direction='VERTICAL',gap=12,padding=0,bg=null,border=false,radius=0,height=null}={}) {
 const n=track(figma.createAutoLayout());n.name=name;n.layoutMode=direction;n.primaryAxisSizingMode='AUTO';n.counterAxisSizingMode='FIXED';n.itemSpacing=gap;
 n.paddingLeft=n.paddingRight=n.paddingTop=n.paddingBottom=padding;n.fills=bg?paint(bg):[];n.cornerRadius=radius;n.clipsContent=false;
 if(border){n.strokes=paint(colors.line);n.strokeWeight=1;}
 if(parent)parent.appendChild(n);
 n.resize(width,height||1);n.primaryAxisSizingMode=height?'FIXED':'AUTO';if(parent&&!height)n.layoutSizingVertical='HUG';return n;
}
function text(parent,value,size=14,width=null,{muted=false,bold=false,center=false,color=null}={}) {
 const n=track(figma.createText());n.name=value.slice(0,40);n.fontName={family:'IBM Plex Sans KR',style:bold?'SemiBold':'Regular'};n.fontSize=size;n.lineHeight={unit:'PERCENT',value:155};n.characters=value;n.fills=paint(color||(muted?colors.muted:colors.ink));parent.appendChild(n);
 n.textAutoResize='HEIGHT';n.resize(width||parent.width-parent.paddingLeft-parent.paddingRight,Math.max(1,size*1.55));n.textAutoResize='HEIGHT';if(center)n.textAlignHorizontal='CENTER';return n;
}
function imageNode(parent,key,size) {
 const n=track(figma.createRectangle());n.name='3D / '+key;n.resize(size,size);n.fills=[{type:'IMAGE',imageHash:hashes[key],scaleMode:'FIT'}];parent.appendChild(n);return n;
}
function spacer(parent,height=12){return box(parent,'Spacing',1,{height,gap:0});}
function button(parent,label,width,{primary=false,target=null,size=13}={}) {
 const b=box(parent,'Button / '+label,width,{direction:'HORIZONTAL',padding:10,gap:6,bg:primary?colors.ink:colors.surface,border:!primary,radius:50,height:46});
 b.primaryAxisAlignItems='CENTER';b.counterAxisAlignItems='CENTER';text(b,label,size,width-20,{center:true,color:primary?colors.surface:colors.ink});
 if(target)links.push({id:b.id,target});return b;
}
const iconPaths={write:'M4 20h16M5 15l10-10 4 4-10 10H5z',card:'M5 3h14v18H5zM9 8h6M9 12h6',records:'M3 7h18v14H3zM2 3h20v4H2zM9 11h6',stats:'M4 20V10M12 20V4M20 20v-7'};
function icon(parent,key,color) {
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"><path d="'+iconPaths[key]+'" fill="none" stroke="'+color+'" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
 const n=track(figma.createNodeFromSvg(svg));parent.appendChild(n);for(const d of n.findAll())made.push(d.id);return n;
}
function header(parent,width,mobile,keyPrefix) {
 const h=box(parent,'Header',width,{direction:'HORIZONTAL',gap:8,height:70});h.counterAxisAlignItems='CENTER';h.primaryAxisAlignItems='SPACE_BETWEEN';
 const brand=box(h,'Brand',mobile?215:width-160,{gap:3});text(brand,'✦ 오늘의 모먼트',mobile?17:21,null,{bold:true});text(brand,config.name.toUpperCase(),9,null,{muted:true});
 button(h,'보관함',mobile?55:64,{target:keyPrefix+'records',size:11});button(h,'설정',48,{target:keyPrefix+'settings',size:11});
}
function nav(root,mobile,active,keyPrefix,viewportHeight) {
 const n=box(root,'Navigation / 주요 메뉴',mobile?358:402,{direction:'HORIZONTAL',gap:mobile?0:6,padding:7,bg:colors.surface,border:true,radius:50,height:64});
 n.layoutPositioning='ABSOLUTE';n.x=(root.width-n.width)/2;n.y=viewportHeight-82;
 root.numberOfFixedChildren=1;
 for(const [id,label] of [['write','작성'],['card','카드'],['records','기록'],['stats','통계']]) {
  const selected=id===active,b=box(n,'Nav / '+label,mobile?86:92,{direction:mobile?'VERTICAL':'HORIZONTAL',gap:mobile?0:7,padding:4,bg:selected?colors.ink:null,radius:40,height:48});b.primaryAxisAlignItems='CENTER';b.counterAxisAlignItems='CENTER';
  icon(b,id,selected?colors.surface:colors.muted);text(b,label,mobile?10:12,mobile?70:30,{center:true,color:selected?colors.surface:colors.muted});links.push({id:b.id,target:keyPrefix+id});
 }
}
function editor(parent,width,mobile) {
 const e=box(parent,'Diary editor',width,{gap:18,padding:mobile?24:32,bg:colors.surface,border:true,radius:24});
 const iw=width-e.paddingLeft*2;text(e,'A LITTLE MOMENT, ALL YOURS',10,iw,{muted:true});
 const row=box(e,'Date and policy',iw,{direction:'HORIZONTAL',gap:8});text(row,'2026-11-04',13,iw-100,{muted:true});text(row,'하루 한 편',13,92,{muted:true});
 text(e,'오늘은 어떤\n마음이었나요?',mobile?32:42,iw);
 const input=box(e,'Input / 오늘의 기록',iw,{height:170,padding:12,border:true});text(input,'마음에 남은 순간을 적어 보세요.',15,iw-24,{muted:true});
 text(e,'지금 화면에서만 임시 보관돼요. 새로고침하면 사라져요.',12,iw,{muted:true});
 const action=box(e,'Save action',iw,{direction:'HORIZONTAL'});action.primaryAxisAlignItems='MAX';button(action,'기록 남기기',154,{primary:true});
}
function emptyCard(parent,width,mobile) {
 const group=box(parent,'Next moment',width,{gap:10});const p=box(group,'Illustration stage',width,{gap:12,padding:24,height:mobile?400:515,bg:colors.stage,border:true,radius:24});p.primaryAxisAlignItems='CENTER';p.counterAxisAlignItems='CENTER';
 imageNode(p,'heart',mobile?190:220);text(p,'YOUR NEXT MOMENT',10,width-48,{center:true,muted:true});text(p,'마음이 머문 순간.',mobile?24:27,width-48,{center:true});text(p,'오늘의 작은 이야기를 나만의 모먼트로 남겨요.',14,Math.min(width-48,280),{center:true});
 text(group,'실제 분석은 준비 중이에요.',12,width,{center:true,muted:true});
}
function summaries(parent,width,mobile,keyPrefix) {
 const row=box(parent,'Record summaries',width,{direction:mobile?'VERTICAL':'HORIZONTAL',gap:24});
 const leftW=mobile?width:Math.round((width-24)*.545),rightW=mobile?width:width-24-leftW;
 const recent=box(row,'Recent records',leftW,{gap:16,padding:26,bg:colors.surface,border:true,radius:24});const iw=leftW-52;
 const rh=box(recent,'Recent title',iw,{direction:'HORIZONTAL',gap:8});const title=box(rh,'Title',iw-72,{gap:4});text(title,'LITTLE MEMORIES',10,null,{muted:true});text(title,'차곡차곡 쌓인 순간',21);imageNode(rh,'star',64);
 text(recent,'이번 실행에서 남긴 기록 · 0편',12,iw,{muted:true});spacer(recent,15);text(recent,'아직 비어 있는 작은 보관함.\n오늘의 첫 순간을 남겨 보세요.',14,iw,{muted:true});spacer(recent,25);button(recent,'기록 모두 보기 ↗',150,{target:keyPrefix+'records',size:12});
 const stats=box(row,'Weekly record counts',rightW,{gap:14,padding:26,bg:colors.surface,border:true,radius:24});const sw=rightW-52;
 text(stats,'THIS WEEK',10,sw,{muted:true});text(stats,'이번 주 마음의 리듬',21,sw);text(stats,'최근 7일 기록 수 · 감정 분석은 준비 중이에요.',12,sw,{muted:true});
 const chart=box(stats,'7-day chart',sw,{direction:'HORIZONTAL',gap:12});const cw=(sw-72)/7;
 for(const d of ['목','금','토','일','월','화','수']){const col=box(chart,'Day / '+d,cw,{gap:7});text(col,'0',11,cw,{center:true,muted:true});spacer(col,67);box(col,'Zero baseline',cw,{height:3,bg:colors.ink,radius:2});text(col,d,11,cw,{center:true,muted:true});}
 button(stats,'감정 통계 살펴보기 ↗',180,{target:keyPrefix+'stats',size:12});
}
function tabs(parent,width,selected,keyPrefix){
 const row=box(parent,'Archive tabs',width,{direction:'HORIZONTAL',gap:8});
 const bw=(width-16)/3;
 for(const [id,label] of [['records','지난 기록'],['stats','돌아보기'],['catalog','캐릭터 도감']])button(row,label,bw,{primary:selected===id,target:keyPrefix+id,size:12});
}
const sampleTexts=['퇴근길에 작은 꽃을 샀다. 별일 없는 하루에도 좋아하는 순간이 있었다.','오랜만에 친구와 산책했다. 천천히 이야기하니 마음이 가벼워졌다.','바쁜 하루 끝, 따뜻한 차 한 잔으로 나를 돌봤다.','퇴근길에 작은 꽃을 샀다. 별일 없는 하루에도 좋아하는 순간이 있었다.'];
function records(parent,width,keyPrefix) {
 text(parent,'예시 모드 · 내 기록과 분리',13,width,{muted:true});
 for(let i=0;i<4;i++){const entry=box(parent,'Record / '+(i+1),width,{padding:18,gap:8,bg:colors.surface,border:true,radius:14});text(entry,sampleTexts[i],14,width-36);text(entry,(i<2?'2026-11-04':'2026-11-03')+' 14:41 · '+['분석 대기','만족 1단계','평온 1단계','불안 1단계'][i],12,width-36,{muted:true});links.push({id:entry.id,target:keyPrefix+'card'});}
 const r=box(parent,'Pagination',width,{direction:'HORIZONTAL',gap:12});button(r,'이전',72);text(r,'1 / 17',13,width-168,{center:true});button(r,'다음',72);
}
function artCard(parent,width,keyPrefix) {
 const stage=box(parent,'Emotion card stage',width,{padding:16,gap:12,bg:colors.stage,border:true,radius:24});const art=box(stage,'Export artwork / 1080 × 1620',width-32,{padding:20,gap:16,bg:colors.stage,border:true,radius:14});const iw=width-72,scale=iw/350;
 text(art,config.name.toUpperCase(),Math.max(8,12*scale),iw,{muted:true});text(art,'2026-11-04 · 14:41',Math.max(10,13*scale),iw);text(art,'마음이 머문 자리.',Math.max(18,28*scale),iw,{bold:true});
 const im=box(art,'Character',iw,{gap:0});im.counterAxisAlignItems='CENTER';imageNode(im,'pos_2',Math.min(iw,270));
 text(art,'● ○ ○',11,iw,{center:true});text(art,'예시 기록 · 45%',11,iw);text(art,'만족 · 1단계',22,iw,{bold:true});text(art,'예시 · 실제 입력 분석 아님',10,iw,{muted:true});
 text(parent,'예시 모드 · 실제 입력 분석 아님',12,width,{center:true,muted:true});
 const actions=box(parent,'Card actions',width,{direction:'HORIZONTAL',gap:8});button(actions,'카드 이미지 저장',Math.min(160,(width-8)*.55),{primary:true,size:12});button(actions,'캐릭터 도감',Math.min(130,(width-8)*.45),{target:keyPrefix+'catalog',size:12});
}
function catalog(parent,width,mobile,keyPrefix) {
 text(parent,'예시 도감 · 21 / 21 · 현재 기록 기준',13,width,{muted:true});button(parent,'감정   기쁨  ▾',150);
 const row=box(parent,'Stages',width,{direction:'HORIZONTAL',gap:12});const cw=(width-24)/3;
 for(let s=1;s<=3;s++){const card=box(row,'기쁨 / '+s+'단계',cw,{padding:mobile?8:18,gap:8,bg:colors.stage,border:true,radius:20});card.counterAxisAlignItems='CENTER';imageNode(card,'pos_1',Math.min(cw-(mobile?16:36),150));text(card,'●'.repeat(s)+'○'.repeat(3-s),11,cw-16,{center:true});text(card,s+'단계',14,cw-16,{center:true,bold:true});text(card,[0,1,3,2][s]+'개 기록',11,cw-16,{center:true,muted:true});links.push({id:card.id,target:keyPrefix+'records'});}
 text(parent,'단계는 분류 확률 구간이며, 감정의 강도가 아니에요.',13,width,{muted:true});text(parent,'단계를 선택하면 관련 기록을 볼 수 있어요.',14,width);
}
function settings(parent,width,keyPrefix) {
 text(parent,'오늘의 모먼트',16,width,{bold:true});
 const preview=box(parent,'Appearance',Math.min(width,500),{padding:18,gap:8,bg:colors.paper,border:true,radius:14});
 text(preview,'오늘의 모먼트',14,preview.width-36);text(preview,config.name,16,preview.width-36,{bold:true});text(preview,config.description,12,preview.width-36,{muted:true});
 text(parent,'화면 모드',16,width,{bold:true});const r=box(parent,'Mode options',width,{direction:'HORIZONTAL',gap:8});for(const [name,target] of [['밝음','write'],['어두움','dark'],['시스템','write']])button(r,name,(width-16)/3,{target:keyPrefix+target,primary:name==='밝음',size:12});
 text(parent,'디자인 선택만 이 브라우저에 보관해요.',13,width,{muted:true});text(parent,'기록 방식',18,width,{bold:true});text(parent,'기록 방식은 지금 실행 중에만 적용돼요.',13,width,{muted:true});
 for(const [name,desc] of [['◉ 하루 한 편','오늘의 기록을 이어서 수정해요.'],['○ 하루 여러 편','순간마다 새로운 기록을 남겨요.']]){const item=box(parent,name,width,{gap:5,padding:14,border:true,radius:12});text(item,name,14,width-28,{bold:true});text(item,desc,12,width-28,{muted:true});}
 text(parent,'계정과 정식 보관 기능은 준비 중이에요.\n새로고침하면 실제 입력과 임시 기록은 사라져요.',13,width,{muted:true});button(parent,'예시 모드 둘러보기',200,{primary:true,target:keyPrefix+'records'});
}
function stats(parent,width,mobile,keyPrefix) {
 const h=box(parent,'Month',width,{direction:'HORIZONTAL',gap:8});button(h,'‹',44);text(h,'2026년 11월',16,width-104,{center:true,bold:true});button(h,'›',44);
 const tabs=box(parent,'Statistics tabs',width,{direction:'HORIZONTAL',gap:8});for(const name of ['감정 추이','월간 기록','감정 분포'])button(tabs,name,(width-16)/3,{primary:name==='감정 추이',size:12});
 text(parent,'예시 통계 · 실제 사용자 분석 아님',12,width,{muted:true});text(parent,'기록 8편 · 작성한 날 4일\n분석 7편 · 미분석 1편',14,width);
 let svg=__CHART__;
 if(svg){const n=track(figma.createNodeFromSvg(svg));n.name='Emotion trend / editable vectors';parent.appendChild(n);n.resize(width,width*230/720);for(const d of n.findAll())made.push(d.id);}
 text(parent,'━ 긍정     ┄ 부정     ┈ 중립',12,width,{center:true,muted:true});button(parent,'2026-11-04   기록 보기',220,{target:keyPrefix+'records'});text(parent,'2편 · 긍정 63.3% · 부정 27.5% · 중립 9.2%',12,width,{muted:true});
}
for(const mobile of [false,true])for(const view of ['write','card','records','stats','catalog','settings',...(mobile?['dark']:[])]) {
 const dark=view==='dark';const v=config[dark?'dark':'light'];colors={paper:v[0],surface:v[1],ink:v[2],muted:v[3],stage:v[6],line:v[7]};
 const width=mobile?390:1440,viewportHeight=mobile?900:1000,margin=mobile?16:136,contentWidth=width-2*margin,keyPrefix=(mobile?'mobile/':'desktop/');
 const root=box(null,(mobile?'Mobile / ':'Desktop / ')+view,width,{gap:mobile?20:28,padding:margin,bg:colors.paper,height:viewportHeight});
 root.paddingTop=mobile?18:28;root.paddingBottom=100;root.clipsContent=true;root.overflowDirection='VERTICAL';root.x=mobile?1650:100;root.y=100+(['write','card','records','stats','catalog','settings','dark'].indexOf(view))*1300;
 frames[keyPrefix+view]=root.id;header(root,contentWidth,mobile,keyPrefix);
 if(view==='write'||dark) {
  const main=box(root,'Workspace',contentWidth,{direction:mobile?'VERTICAL':'HORIZONTAL',gap:24});
  const left=mobile?contentWidth:Math.round((contentWidth-24)*5/9);
  editor(main,left,mobile);emptyCard(main,mobile?contentWidth:contentWidth-24-left,mobile);summaries(root,contentWidth,mobile,keyPrefix);
 } else if(view==='card') {
  const panel=box(root,'Record detail',contentWidth,{gap:16,padding:mobile?18:28,bg:colors.surface,border:true,radius:24});const iw=contentWidth-panel.paddingLeft*2;
  const heading=box(panel,'Detail heading',iw,{direction:'HORIZONTAL',gap:12});text(heading,'2026-11-04',23,iw-105,{bold:true});button(heading,'목록으로',93,{target:keyPrefix+'records'});
  const tabs=box(panel,'Record tabs',iw,{direction:'HORIZONTAL',gap:8});button(tabs,'기록',(iw-8)/2);button(tabs,'카드',(iw-8)/2);
  const row=box(panel,'Record and card',iw,{direction:mobile?'VERTICAL':'HORIZONTAL',gap:24});
  if(!mobile){const copy=box(row,'Record text',(iw-24)/2,{gap:18});text(copy,sampleTexts[1],17);button(copy,'수정하기',120);button(copy,'삭제',80);}
  const card=box(row,'Card',mobile?iw:(iw-24)/2,{gap:12});artCard(card,card.width,keyPrefix);
 } else {
  const panel=box(root,view,contentWidth,{gap:18,padding:mobile?18:28,bg:colors.surface,border:true,radius:24});const iw=contentWidth-panel.paddingLeft*2;
  const heading=box(panel,'Panel heading',iw,{direction:'HORIZONTAL',gap:12});text(heading,view==='settings'?'설정':'나의 페이지',23,iw-80,{bold:true});button(heading,'닫기',68,{target:keyPrefix+'write'});
  if(view!=='settings')tabs(panel,iw,view,keyPrefix);
  if(view==='records')records(panel,iw,keyPrefix);
  if(view==='stats')stats(panel,iw,mobile,keyPrefix);
  if(view==='catalog')catalog(panel,iw,mobile,keyPrefix);
  if(view==='settings')settings(panel,iw,keyPrefix);
 }
 text(root,'EVERY DAY IS A LITTLE ART.                         나만의 속도로 기록해요 ✧',10,contentWidth,{muted:true});
 nav(root,mobile,view==='dark'?'write':view,keyPrefix,viewportHeight);
}
for(const link of links) {
 let target=frames[link.target];
 if(!target&&link.target==='desktop/dark')target=frames['mobile/dark'];
 if(target){const node=await figma.getNodeByIdAsync(link.id);let top=node;while(top.parent && top.parent.type!=='PAGE')top=top.parent;if(top.id===target)continue;await node.setReactionsAsync([{trigger:{type:'ON_CLICK'},actions:[{type:'NODE',destinationId:target,navigation:'NAVIGATE',transition:null,resetScrollPosition:true}]}]);}
}
page.flowStartingPoints=[{nodeId:frames['mobile/write'],name:config.name+' · Mobile'},{nodeId:frames['desktop/write'],name:config.name+' · Desktop'}];
return {frames,createdNodeIds:made,mutatedNodeIds:[page.id],linkCount:links.length};
