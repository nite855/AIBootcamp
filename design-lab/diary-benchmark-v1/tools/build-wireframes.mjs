import { readFile, writeFile, mkdir } from "node:fs/promises";
const root = new URL("../", import.meta.url),
  out = new URL("docs/wireframes/", root);
const fonts = (await readFile(new URL("styles/base.css", root), "utf8"))
  .split("\n")
  .filter((x) => x.startsWith("@font-face"))
  .join("\n");
const license = await readFile(
  new URL("docs/licenses/ibm-plex-sans-kr.txt", root),
  "utf8",
);
import { validateScreens } from "./design-validation.mjs";
const definition = JSON.parse(await readFile(new URL("design/wireframes/screens.json", root), "utf8"));
validateScreens(definition);
const { screens, devices } = definition;
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
function svg(screen, device) {
  const mobile = device === "mobile",
    w = devices[device][0],
    h = devices[device][1];
  let parts = [];
  const rect = (x, y, ww, hh, fill = "#fff") =>
    parts.push(
      `<rect x="${x}" y="${y}" width="${ww}" height="${hh}" rx="6" fill="${fill}" stroke="#777"/>`,
    );
  const text = (x, y, t, size = 16, extra = "") =>
    parts.push(
      `<text x="${x}" y="${y}" font-size="${size}" ${extra}>${escape(t)}</text>`,
    );
  const lines = (x, y, ts, size = 16) =>
    ts.forEach((t, i) => text(x, y + i * (size + 10), t, size));
  const button = (x, y, ww, label, target, extra = "") => {
    parts.push(
      `<a href="../../index.html#${target}" data-target="${target}" ${extra} aria-label="${escape(label)}">`,
    );
    rect(x, y, ww, 40, "#eee");
    text(x + ww / 2, y + 26, label, 14, 'text-anchor="middle"');
    parts.push("</a>");
  };
  const width = w - 48;
  rect(0, 0, w, h, "#fafafa");
  text(24, 40, "오늘의 모먼트", 18, 'font-weight="600"');
  button(w - 190, 16, 80, "보관함", "WF-03");
  button(w - 100, 16, 76, "설정", "WF-06");
  const statistics = ["trend", "count", "distribution"].includes(screen.type);
  const archive = ["archive", "filtered"].includes(screen.type);
  const x = mobile ? 24 : 290,
    pw = mobile ? 342 : 786;
  if (screen.type === "write") {
    const ew = mobile ? 342 : 760;
    rect(24, 84, ew, h - 148);
    text(44, 116, "2026-11-03 · 하루 한 편", 14);
    text(44, 160, "오늘은 어떤 하루였나요?", mobile ? 25 : 36);
    rect(44, 218, ew - 40, h - 420);
    text(58, 250, "마음에 남은 순간을 적어 보세요.", 14);
    text(58, h - 225, "긴 기록은 이 영역 안에서 스크롤", 13);
    text(44, h - 178, "초안 저장됨 · 이 브라우저에만 보관", 13);
    button(44, h - 150, ew - 40, "기록 남기기", "ST-02");
    if (screen.state === "invalid")
      text(44, 205, "내용을 입력해 주세요.", 14, 'font-weight="600"');
    if (!mobile) {
      rect(900, 140, 280, 420, "#eee");
      lines(930, 290, ["감정 카드 영역", "2:3 비율", "분석 기능 준비 중"], 18);
      button(920, 590, 240, "예시 카드 만나보기", "WF-02");
    }
  } else if (screen.type === "card") {
    const pending = screen.state === "pending";
    const cw = mobile ? 300 : 330,
      ch = cw * 1.5,
      cx = (w - cw) / 2;
    rect(cx, 88, cw, ch, "#eee");
    text(cx + 20, 120, "2026-11-03", 14);
    rect(cx + 20, 145, cw - 40, ch - 200, "#ddd");
    lines(
      cx + 40,
      210,
      pending
        ? ["기록을 보관했어요", "감정 분석 준비 중"]
        : ["감정별 표현 10종", "날짜 · 감정명", "2:3 카드 비율"],
      18,
    );
    text(
      cx + 20,
      88 + ch - 54,
      pending
        ? "이 브라우저에 보관돼요."
        : "기록별 안정·자신감 카드 · " +
            (screen.state === "stage3"
              ? "3단계"
              : screen.state === "stage2"
                ? "2단계"
                : screen.state === "blank"
                  ? "빈 카드"
                  : "1단계"),
      16,
    );
    text(cx + 20, 88 + ch - 25, "실제 입력의 분석 결과가 아닙니다.", 12);
    const yy = 88 + ch + 18;
    button(cx, yy, cw, "기록 읽기", "WF-04");
    if (!pending) button(cx, yy + 50, cw / 2 - 4, "이미지 저장", "WF-02", 'data-demo="download"');
    button(cx + (pending ? 0 : cw / 2 + 4), yy + 50, pending ? cw : cw / 2 - 4, "작성으로", "WF-01");
    if (!pending) button(cx, yy + 100, cw, "캐릭터 도감", "WF-11");
    if (screen.state === "failed")
      text(cx, yy - 5, "저장 실패 · 버튼을 눌러 재시도", 14);
    if (pending) text(cx, yy + 115, "하루 여러 편: 새 기록 쓰기로 전환", 13);
  } else {
    rect(x, 84, pw, h - 148);
    text(x + 20, 120, statistics || archive ? "나의 페이지" : screen.title, 22);
    button(x + pw - 86, 94, 66, "닫기", "WF-01");
    if (archive || statistics) {
      const tw=(pw-56)/3;
      [['지난 기록','WF-03'],['돌아보기','WF-07'],['캐릭터 도감','WF-11']].forEach(([label,id],i)=>button(x+20+i*(tw+8),140,tw,label,id));
    }
    if (archive) {
      text(
        x + 20,
        208,
        screen.type === "filtered"
          ? "2026-11-02 · 날짜별 기록"
          : "예시 보관함 · 실제 작성본과 분리",
        14,
      );
      if (screen.state === "empty")
        lines(
          x + 24,
          300,
          ["보관함에 기록이 없어요.", "작성 화면에서 오늘을 남겨 보세요."],
          16,
        );
      else
        for (
          let i = 0;
          i < (screen.type === "filtered" ? 2 : mobile ? 4 : 5);
          i++
        )
          button(
            x + 20,
            236 + i * 62,
            pw - 40,
            `오늘의 작은 순간 · 11월 ${screen.type === "filtered" ? 2 : Math.max(1, 3 - i)}일`,
            "WF-04",
          );
      button(x + 20, h - 130, 72, "이전", "WF-03");
      text(x + 106, h - 105, "1 / 3", 14);
      button(x + 150, h - 130, 72, "다음", "WF-03");
      if (screen.type === "filtered")
        button(x + 20, h - 185, pw - 40, "날짜 필터 해제 / 통계로", "WF-07");
    } else if (statistics) {
      button(x + 20, 194, 45, "‹", screen.id, 'data-demo="prev-month"');
      text(
        x + pw / 2,
        220,
        "2026년 11월",
        18,
        'text-anchor="middle" data-month="true"',
      );
      button(x + pw - 65, 194, 45, "›", screen.id, 'data-demo="next-month"');
      const tw = (pw - 56) / 3;
      [
        ["감정 추이", "WF-07"],
        ["월간 기록", "WF-08"],
        ["감정 분포", "WF-09"],
      ].forEach(([label, id], i) =>
        button(x + 20 + i * (tw + 8), 250, tw, label, id),
      );
      lines(
        x + 20,
        316,
        [
          "예시 통계 · 실제 사용자 분석 아님",
          "기록 12편 · 작성한 날 8일 · 분석 10편",
        ],
        13,
      );
      const gx = x + 48,
        gy = 382,
        gw = pw - 80,
        gh = mobile ? 235 : 190;
      if (screen.state === "empty" || screen.state === "no-analysis")
        lines(
          x + 24,
          gy + 60,
          [
            screen.state === "empty"
              ? "아직 이 달의 기록이 없어요."
              : "분석된 기록이 아직 없어요.",
            "빈 값은 중립으로 채우지 않아요.",
          ],
          15,
        );
      else if (screen.type === "distribution") {
        const groups = [
          ["긍정", ["기쁨·활력", "만족·감사", "안정·자신감"]],
          ["부정", ["불안", "슬픔", "분노"]],
          ["중립", ["객관적 서술", "의문", "놀람", "당황"]],
        ];
        let yy = gy - 20;
        for (const [parent, labels] of groups) {
          text(x + 20, yy, parent + " · " + (labels.length * 10) + "%", 13, 'font-weight="600"');
          yy += 20;
          for (const label of labels) {
            text(x + 20, yy, label, 12);
            rect(x + 120, yy - 9, (pw - 195) * .4, 9, "#999");
            text(x + pw - 55, yy, "10%", 12);
            yy += 20;
          }
          yy += 4;
        }
        text(x + 20, yy + 4, "분석 기록의 평균 분류 확률", 12);
      } else {
        for (let i = 0; i < 3; i++) {
          const yy = gy + (i * gh) / 2;
          parts.push(`<path d="M${gx} ${yy}h${gw}" stroke="#bbb"/>`);
          text(
            x + 14,
            yy + 4,
            screen.type === "count"
              ? String(4 - i * 2)
              : String(100 - i * 50) + "%",
            11,
          );
        }
        for (let i = 0; i < 6; i++)
          text(gx + (i * gw) / 5 - 5, gy + gh + 20, String(1 + i * 6), 12);
        if (screen.type === "count")
          for (let i = 0; i < 9; i++)
            rect(
              gx + (i * gw) / 10,
              gy + gh - (((i % 4) + 1) * gh) / 5,
              gw / 16,
              (((i % 4) + 1) * gh) / 5,
              "#999",
            );
        else {
          for (let j = 0; j < 3; j++) {
            const pts = Array.from(
              { length: screen.state === "single" ? 1 : 8 },
              (_, i) => [
                gx + (i * gw) / 8,
                gy + gh * (0.2 + ((i + j) % 4) * 0.17),
              ],
            );
            if (pts.length > 1)
              parts.push(
                `<polyline points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="#333" stroke-width="2" stroke-dasharray="${["0", "8 4", "2 4"][j]}"/>`,
              );
            pts.forEach(([xx, yy]) =>
              parts.push(`<circle cx="${xx}" cy="${yy}" r="3" fill="#333"/>`),
            );
          }
          text(
            gx,
            gy + gh + 42,
            screen.state === "single"
              ? "비교할 날짜가 더 필요해요."
              : "━ 긍정   ┄ 부정   ┈ 중립",
            13,
          );
        }
      }
      if (screen.type !== "distribution") {
        button(x + 20, h - 148, pw - 40, "11월 2일 · 기록 보기", "WF-10");
        text(x + 20, h - 84, "날짜 선택 · 터치 / 키보드로 탐색", 12);
      }
    } else if (screen.type === "catalog") {
      text(x + 20, 174, "캐릭터 도감 · 현재 기록 기준 3 / 30", 16);
      text(x + 20, 210, "긍정 · 기쁨·활력 ▾", 16);
      const cw = Math.min(130, (pw - 64) / 3);
      for (let i = 0; i < 3; i++) {
        const xx = x + 16 + i * (cw + 16);
        rect(xx, 250, cw, cw * 1.5, "#eee");
        text(xx + 12, 285, screen.state === "locked" ? "?" : "✦", 24);
        button(
          xx,
          250 + cw * 1.5 + 10,
          cw,
          i + 1 + "단계",
          screen.state === "locked" ? "WF-13" : "WF-12",
        );
      }
      text(x + 20, h - 190, "30% / 60% / 90% 기준 · 빈 카드는 제외", 13);
      button(
        x + 20,
        h - 150,
        pw - 40,
        screen.state === "locked"
          ? "미발견 · 연결 기록 없음"
          : "이 캐릭터의 기록 보기",
        screen.state === "locked" ? "WF-11" : "WF-14",
      );
    } else if (screen.type === "settings") {
      lines(
        x + 20,
        174,
        [
          "테마 5종 · 밝음 / 어두움 / 시스템",
          "디자인 선택만 브라우저에 보관",
          "기록 방식 · 현재 실행에만 적용",
          "○ 하루 한 편: 오늘 기록 이어 쓰기",
          "○ 하루 여러 편: 순간마다 새 기록",
        ],
        16,
      );
      button(
        x + 20,
        278,
        pw - 40,
        "하루 한 편 / 여러 편 선택",
        "WF-06",
        'data-demo="policy"',
      );
      lines(
        x + 20,
        365,
        [
          "계정 · 서버 저장은 준비 중이에요.",
          "실제 입력은 새로고침하면 사라져요.",
        ],
        14,
      );
      button(x + 20, h - 150, pw - 40, "예시 카드 만나보기", "WF-02");
    } else {
      button(x+20,h-205,pw-40,"이 기록의 카드 보기","WF-02");
      text(x + 20, 178, "2026-11-02 · 예시 기록", 16);
      rect(x + 20, 202, pw - 40, h - 420, "#f5f5f5");
      lines(
        x + 36,
        238,
        [
          "퇴근길에 작은 꽃을 샀다.",
          "좋아하는 순간을 기억하고 싶었다.",
          "",
          screen.type === "edit"
            ? "[편집 영역 · 원문 수정]"
            : "긴 본문은 내부에서 스크롤",
        ],
        14,
      );
      if (screen.state === "confirm")
        text(x + 20, h - 180, "한 번 더 누르면 예시를 삭제해요.", 14);
      button(
        x + 20,
        h - 150,
        (pw - 50) / 2,
        screen.type === "edit" ? "수정 완료" : "수정하기",
        screen.type === "edit" ? "WF-04" : "WF-05",
      );
      button(
        x + 30 + (pw - 50) / 2,
        h - 150,
        (pw - 50) / 2,
        screen.state === "confirm" ? "정말 삭제" : "삭제",
        screen.state === "confirm" ? "WF-03" : "ST-07",
      );
      button(x + 20, h - 100, pw - 40, "목록으로", "WF-10");
    }
  }
  text(
    24,
    h - 22,
    `${screen.id} · ${screen.title} · ${mobile ? "모바일" : "PC"}`,
    12,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title-${screen.id} desc-${screen.id}"><title id="title-${screen.id}">${screen.id} ${screen.title}</title><desc id="desc-${screen.id}">흑백 구조 와이어프레임. ${screen.state}. 입력·분석·저장은 실제 실행하지 않습니다.</desc><defs><style>${fonts}\ntext{font-family:'IBM Plex Sans KR',sans-serif;fill:#222}a:focus-visible rect{stroke:#000;stroke-width:4}</style></defs>${parts.join("")}</svg>`;
}
await mkdir(out, { recursive: true });
const frames = {};
for (const device of ["desktop", "mobile"]) {
  await mkdir(new URL("svg/" + device + "/", out), { recursive: true });
  for (const screen of screens) {
    const content = svg(screen, device);
    frames[device + ":" + screen.id] = content;
    await writeFile(
      new URL("svg/" + device + "/" + screen.id + ".svg", out),
      content,
    );
  }
}
await writeFile(new URL("font-license.txt", out), license);
await writeFile(
  new URL("manifest.json", out),
  JSON.stringify(
    { devices, screens: screens.map(({id,title,type,state}) => ({id,title,type,state})) },
    null,
    2,
  ),
);
const json = JSON.stringify({ frames, screens }).replace(/</g, "\\u003c");
await writeFile(
  new URL("index.html", out),
  `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>오늘의 모먼트 · 와이어프레임</title><style>*{box-sizing:border-box}body{margin:0;background:#ddd;color:#222;font:14px sans-serif}header{padding:14px;display:flex;gap:12px;flex-wrap:wrap;background:#fff;align-items:center}select,button,a{font:inherit}select,button{min-height:40px;max-width:100%}main{padding:16px;display:flex;justify-content:center}#frame{max-width:100%}svg{display:block;width:100%;height:auto}aside{background:white;padding:16px;margin:0 16px 16px;line-height:1.7}a{color:#222}:focus-visible{outline:3px solid black}</style><header><strong>설계 검토 도구</strong><label>화면 크기 <select id="device"><option value="desktop">PC</option><option value="mobile">모바일</option></select></label><label>화면·상태 <select id="screen"></select></label><a id="download" download>현재 SVG 저장</a><button id="back">이전 화면</button></header><main><div id="frame"></div></main><aside><strong id="caption"></strong><p id="note">클릭 영역으로 화면을 이동합니다. 입력·분석·저장·다운로드는 준비된 상태를 시연합니다. 상단은 실제 앱에 없는 검토 도구입니다.</p><p>원형 표시: 선택 항목 / 회색 사각형: 콘텐츠·입력 영역 / 그래프: 설명용 예시. 통계의 빈 구간은 분석 결과가 없는 날입니다.</p></aside><script type="application/json" id="data">${json}</script><script>
const data=JSON.parse(document.getElementById('data').textContent),device=document.getElementById('device'),screen=document.getElementById('screen'),frame=document.getElementById('frame');let historyStack=[],month=11,policy='하루 한 편',lastStats='WF-07',entryOrigin='WF-03';
for(const s of data.screens)screen.add(new Option(s.id+' · '+s.title,s.id));
function show(id=screen.value,push=true){if(!data.screens.some(s=>s.id===id))id='WF-01';if(id==='WF-07'&&screen.value==='WF-10')id=lastStats;if(id==='WF-04'&&['WF-03','WF-10'].includes(screen.value))entryOrigin=screen.value;if(id==='WF-10'&&['WF-04','WF-05'].includes(screen.value)&&entryOrigin==='WF-03')id='WF-03';if(['WF-07','WF-08','WF-09'].includes(id))lastStats=id;if(push&&screen.value!==id)historyStack.push(screen.value);screen.value=id;frame.style.width=device.value==='mobile'?'390px':'1366px';frame.innerHTML=data.frames[device.value+':'+id];document.getElementById('caption').textContent=id+' · '+data.screens.find(s=>s.id===id).title;document.getElementById('download').href='svg/'+device.value+'/'+id+'.svg';document.getElementById('back').disabled=!historyStack.length;frame.querySelectorAll('a').forEach(a=>a.onclick=e=>{e.preventDefault();const action=a.dataset.demo;if(action){if(action==='prev-month')month=Math.max(1,month-1);if(action==='next-month')month=Math.min(11,month+1);if(action==='policy')policy=policy==='하루 한 편'?'하루 여러 편':'하루 한 편';document.getElementById('note').textContent=action==='download'?'예시 다운로드 시연입니다. 실제 파일은 상단의 현재 SVG 저장을 사용하세요.':'검토 상태: 2026년 '+month+'월 · '+policy;const m=frame.querySelector('[data-month]');if(m)m.textContent='2026년 '+month+'월';return;}show(a.dataset.target);});const monthText=frame.querySelector('[data-month]');if(monthText)monthText.textContent='2026년 '+month+'월';location.hash=id;}
device.onchange=()=>show(screen.value,false);screen.onchange=()=>show(screen.value,false);document.getElementById('back').onclick=()=>show(historyStack.pop()||'WF-01',false);show(location.hash.slice(1)||'WF-01',false);
</script></html>`,
);
await writeFile(
  new URL("README.md", out),
  `# 오늘의 모먼트 와이어프레임\n\nindex.html을 열어 PC·모바일 화면과 상태를 선택하세요. 기본 14개 화면과 12개 상태를 각 크기로 만든 SVG 52개입니다. SVG는 벡터 도형과 텍스트이며 래스터 이미지·foreignObject·외부 글꼴 요청을 포함하지 않습니다.\n\n## 화면 목록\n\n${screens.map((s) => "- " + s.id + " " + s.title + " ([PC](svg/desktop/" + s.id + ".svg), [모바일](svg/mobile/" + s.id + ".svg))").join("\n")}\n\n## 흐름과 제약\n\n작성 → 임시 보관 안내 / 설정 → 예시 카드 / 보관함 → 기록 상세 → 수정·삭제 확인 / 돌아보기 → 통계 3종 → 날짜별 기록 → 상세 → 목록 → 돌아보기. 입력과 실제 분석은 시연하지 않습니다. SVG의 버튼 링크는 함께 배포한 HTML을 엽니다. 상단 검토 도구는 제품 메뉴가 아닙니다. HTML 문서는 스크롤할 수 있지만 각 앱 프레임은 고정 크기입니다. 작은 화면에서는 SVG 전체를 비례 축소합니다.\n\n예시 날짜는 검토를 위해 2026-11-03으로 고정했습니다. 예시 통계는 구조 설명용이며 실제 데이터 집계 결과가 아닙니다. 기록 한 편에 카드 한 장을 연결하며 도감은 10유형 × 3단계입니다. 30% 미만은 빈 카드, 30% 이상은 1단계, 60% 이상은 2단계, 90% 이상은 3단계입니다. 현재 유효한 기록만으로 도감을 재계산합니다. 원문 스크롤·입력·분석·이미지 저장 로딩은 주석으로 표시하고 오류 상태는 별도 프레임으로 제공합니다. 기존 앱은 수정하지 않았습니다.\n\n재생성: 프로젝트 폴더에서 node tools/build-wireframes.mjs\n검증: node tests/wireframes.cjs\n글꼴 라이선스: font-license.txt\n`,
);
console.log("Built 52 SVG wireframes and standalone HTML.");
