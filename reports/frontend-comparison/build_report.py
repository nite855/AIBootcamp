"""Build a local comparison report from the inspected source and browser audit."""
import json
from html import escape as e
from pathlib import Path

OUT = Path(__file__).resolve().parent
audit = json.loads((OUT / 'audit.json').read_text(encoding='utf-8'))
rows = {r['name']: r for r in audit['results']}
# Judgments describe this checkout; they are not measured usability scores.
projects = [
 ('emotion-cardex', 'Cardex', '도감의 기준 버전', '대화 TXT → 화자 → 분석 대기 / 예시 → 도감', '좌측 네이비 메뉴, 크림 배경, 카드와 대표 지표 중심', '3→7 감정 탐색과 분석 근거를 단계적으로 확인하기 좋음', '표시 모드 선택·공유 출력이 없어 후속 버전보다 활용 범위가 좁음', '기본 감정 도감 시연', [0,0,1,1,0,0,0], 'scripts/app.js · scripts/core.js'),
 ('emotion-cardex-v2', 'Cardex v2', '표시 모드 확장', '기준 흐름 유지 + 시스템 / 라이트 / 다크', '기준 레이아웃 유지, 테마 토큰·초기 적용 로직 추가', '기능 학습 없이 사용자 표시 환경을 선택할 수 있음', '기본 버전과 복제된 화면·도메인 코드의 동시 관리 필요', '테마 동작 비교', [1,0,1,1,0,0,0], 'scripts/theme.js · styles/themes.css'),
 ('emotion-cardex-v3', 'Cardex v3', '명칭 일관성 정비', 'v2 흐름 유지 + pos_3 표시명 평온', 'v2와 화면 구조가 같고 감정 표시명이 변경됨', '내부 ID·확률을 유지하면서 표시명 계약을 정리', '새 화면 설계 버전으로 보기는 어려움; 디자인 계획과 구현 구분 필요', '명칭 변경 회귀 기준', [1,0,1,1,0,0,0], 'scripts/core.js · tests/labels.test.cjs'),
 ('emotion-cardex-v4', 'Cardex v4', '해석·탐색 UX 개선', '대표 감정 해석 → 관찰 요약 → 간결한 7유형 목록', '관찰 패널 우선, 카드명·확률 강조, 작은 도감 목록', '대표 대분류와 최다 소분류 차이 설명, 차트 방향키/Home/End 탐색', '화면별 Figma 일치·테마 대비·스크린리더 검증은 추가 필요', '도감 중심 UI의 개선 기준', [1,0,1,1,0,0,0], 'scripts/app.js · docs/SYNC_STATUS.md'),
 ('tcg-social-studio-v1', 'Social Studio', '공유 기능 확장', '대화 분석 예시 → 결과 탐색 → 카드 편집 → PNG / 블로그', '상단 탐색, 대시보드와 골드/잉크 공유 카드', '1:1·4:5 출력과 수치 공개 선택, 공개 데이터 허용 목록', 'social.js를 app.js에 삽입하는 방식으로 상태 결합이 늘어남', '공유 카드 기능의 기준', [1,0,1,1,1,1,0], 'scripts/social.js · styles/social.css'),
 ('integrated-tcg-2026-11-03', 'Integrated TCG', '분석·카드·공유 통합', '통합 요약 → 흐름 / 분포 / 캘린더 / 도감 → 공유', '상단 공통 메뉴, 모바일 하단 메뉴, 요약 대시보드의 2열 구성', '한 화면에서 분석과 카드·공유를 연결; 파일 읽기 역전 방지 검사 존재', '정보량과 스크롤 부담이 큼; 상세 기능 전수 E2E는 별도 필요', '대화 분석 통합 프론트의 기준', [1,0,1,1,1,1,0], 'scripts/app.js · tests/integration.test.cjs'),
 ('diary-social-v1', 'Diary Social', '일기 입력·분석 확장', '일기 입력 / TXT → 날짜·기록 확인 → 대기 / 예시 → 공유', '기록 단계 표시, 분포·순서 추이·대표 카드 대시보드', '단일·복수·날짜 없는 기록을 구분하고 분석 불가 사유 안내', '일기와 대화 도메인이 공존하고 diary 삽입 코드까지 관리해야 함', '복수 일기 분석 UX의 기준', [1,1,1,2,1,1,0], 'scripts/diary.js · scripts/diary-core.js'),
 ('diary-simple-v1', 'Diary Simple', '대표 카드 우선 간소화', '일기 입력 → 감정 카드 → 공유 / 상세 분석 새 탭', '넓은 여백과 중앙 카드, 2개 주요 행동, 상세 정보 접기', '첫 결과 화면의 선택 부담을 줄이고 상세 탐색을 분리', '단일 HTML만 있어 분리 소스·빌드 경로 부재; 기존 테스트 2개 실패', '간단한 일기·카드 시연', [1,1,2,2,1,1,2], 'index.html · tests/simple.test.cjs'),
]
features = ['3가지 표시 모드', '일기 직접 입력', '분포·흐름·도감', '날짜·기간 분석', 'PNG 카드 편집', '블로그 출력', '일기 상세 새 탭']
def source_link(name, file, label=None):
 return f'<a href="../../design-lab/{name}/{file}">{e(label or file)}</a>'
def table(headers, body):
 return '<div class="scroll"><table><thead><tr>'+''.join('<th scope="col">'+x+'</th>' for x in headers)+'</tr></thead><tbody>'+''.join(body)+'</tbody></table></div>'
def tr(cells): return '<tr>'+''.join('<td>'+c+'</td>' for c in cells)+'</tr>'
matrix=[]; detail=[]; metrics=[]; gallery=[]; md=[]
for name, title, delta, flow, design, strength, risk, use, flags, sources in projects:
 r=rows[name]
 matrix.append(tr([f'<strong>{e(title)}</strong><small>{e(name)}</small>']+[f'<span class="status s{x}">{["— 없음","● 제공","△ 조건부"][x]}</span>' for x in flags]))
 detail.append(tr([f'<strong>{e(title)}</strong><small>{e(delta)}</small>',e(flow),e(design),e(strength),e(risk)]))
 source_text='단일 HTML 직접 관리' if not r['sourceFiles'] else f"{r['sourceFiles']}개 분리 소스 / {r['sourceLines']}줄"
 metrics.append(tr([e(title),f'<div class="bar" style="--size:{r["htmlKiB"]/4.2}%"></div><strong>{r["htmlKiB"]} KiB</strong>',source_text,f'<span class="status {"s2" if r["fail"] else "s1"}">{r["pass"]}/{r["tests"]} 통과</span>'+ (f'<small>{r["fail"]}개 실패</small>' if r['fail'] else ''),f'<a href="logs/{name}.txt">실행 로그</a>']))
 gallery.append(f'''<article class="project"><div class="project-top"><div><span class="eyebrow">{e(delta)}</span><h3>{e(title)}</h3></div>{source_link(name,'index.html','앱 열기 ↗')}</div><p class="path">{e(name)}</p><div class="shots"><a href="screenshots/{name}-1440.png"><img loading="lazy" src="screenshots/{name}-1440.png" alt="{e(title)} 데스크톱 예시 결과 상단"><span>Desktop · 1440px</span></a><a href="screenshots/{name}-390.png"><img loading="lazy" src="screenshots/{name}-390.png" alt="{e(title)} 모바일 예시 결과 상단"><span>Mobile · 390px</span></a></div><p><b>적합한 용도</b> {e(use)}</p><p class="refs">{source_link(name,'README.md','README')} · {source_link(name,'docs/QA.md','기존 QA')} · <a href="screenshots/{name}-input.png">시작 / 입력 화면</a></p><details><summary>소스 근거</summary><p>{' · '.join(source_link(name,f.strip()) for f in sources.split(' · '))}</p></details></article>''')
 md.append(f'| {name} | {delta} | {strength} | {risk} | {r["pass"]}/{r["tests"]} |')

css='''
:root{--ink:#172d43;--muted:#536579;--line:#d8e2e8;--teal:#14776b;--paper:#f3f6f8}*{box-sizing:border-box}body{margin:0;font:15px/1.65 "Malgun Gothic",system-ui,sans-serif;color:var(--ink);background:var(--paper)}main{max-width:1480px;margin:auto;padding:48px 40px}header{border-top:5px solid var(--teal);padding:30px 0 24px}h1{font-size:40px;line-height:1.25;letter-spacing:-1.7px;margin:12px 0 14px}h2{font-size:25px;margin:0 0 8px}h3{font-size:21px;margin:4px 0}p{margin:8px 0}a{color:#185888;text-underline-offset:4px}a:focus-visible,summary:focus-visible{outline:3px solid #16796c;outline-offset:4px}.eyebrow{font-size:12px;letter-spacing:1.4px;font-weight:700;color:var(--teal)}.lede{font-size:19px;max-width:980px}.meta{color:var(--muted)}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;padding:22px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);margin:24px 0}.stats strong{display:block;font-size:32px;line-height:1.3}.stats span{color:var(--muted);font-size:13px}.note{padding:18px 22px;border-left:4px solid #bd8429;background:#fff7e6;margin:20px 0}nav{display:flex;flex-wrap:wrap;gap:20px;margin:24px 0}section{margin-top:46px}.caption{font-size:13px;color:var(--muted);margin-bottom:16px}.scroll{overflow-x:auto;border-radius:12px;background:white}table{width:100%;border-collapse:collapse;font-size:13px}th{background:#e5edf2;text-align:left;white-space:nowrap;font-size:12px;letter-spacing:.3px;padding:15px 12px}td{padding:16px 12px;vertical-align:top;border-bottom:1px solid #e6edf1;min-width:100px}td:first-child{min-width:165px}tbody tr:last-child td{border-bottom:0}small{display:block;color:var(--muted);font-size:11px;overflow-wrap:anywhere;margin-top:5px}.status{white-space:nowrap;display:inline-block;padding:3px 7px;border-radius:5px;font-size:12px}.s0{color:#64717b;background:#f0f3f5}.s1{color:#0a6252;background:#e2f2ec}.s2{color:#87590c;background:#fff1d5}.bar{height:6px;width:var(--size);background:var(--teal);margin:5px 0 8px}.gallery{display:grid;grid-template-columns:1fr 1fr;gap:24px}.project{background:white;padding:24px;border-radius:14px;min-width:0}.project-top{display:flex;justify-content:space-between;gap:16px;align-items:center}.path{font-size:12px;color:var(--muted);overflow-wrap:anywhere}.shots{display:grid;grid-template-columns:1fr 27%;gap:12px;margin:18px 0}.shots a{display:block;min-width:0;text-decoration:none}.shots img{width:100%;height:270px;object-fit:cover;object-position:top;border:1px solid #dfe6eb;border-radius:6px}.shots span{display:block;font-size:11px;color:var(--muted);margin-top:4px}.refs{font-size:13px}.recommend{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}.recommend article{border-top:3px solid var(--teal);padding-top:14px}.recommend p{color:var(--muted)}details{font-size:13px;margin-top:12px}summary{cursor:pointer}.flow{background:#e5edf2;padding:20px;font-family:Consolas,monospace;overflow-wrap:anywhere}.findings li{margin-bottom:14px}.findings strong{color:#9c4c1f}footer{border-top:1px solid var(--line);padding-top:20px;margin-top:44px;color:var(--muted);font-size:13px}@media(max-width:800px){main{padding:24px 16px}h1{font-size:30px}.stats{grid-template-columns:1fr 1fr}.gallery,.recommend{grid-template-columns:1fr}.shots img{height:240px}}@media print{body{background:white}main{padding:0}nav{display:none}section{break-before:auto}.project{break-inside:avoid}.gallery{grid-template-columns:1fr 1fr}.scroll{overflow:visible}table{font-size:10px}td,th{padding:8px 5px;min-width:0!important}.status{white-space:normal}.shots img{height:180px}a{color:inherit}}
'''
html=f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HW 프론트엔드 비교 분석 · 8개 프로젝트</title><style>{css}</style></head><body><main>
<header><span class="eyebrow">AIBOOTCAMP / FRONTEND REVIEW / 2026.11.03</span><h1>같은 감정 데이터,<br>다른 사용자 경험.</h1><p class="lede">8개 프론트를 입력 방식, 결과 화면, 공유 기능, 코드 구조와 현재 검증 결과로 비교했습니다.</p><p class="meta">로컬 소스 + 실제 Chrome 캡처 기준 · 순위나 임의 점수 대신 구현 차이와 사용 목적 비교</p></header>
<div class="stats"><div><strong>8</strong><span>비교 대상 프로젝트</span></div><div><strong>148 / 150</strong><span>이번 실행 코드 테스트 통과</span></div><div><strong>16 / 16</strong><span>결과 화면 폭 검사 통과</span></div><div><strong>0 / 8</strong><span>운영 3+7 분석 API 연결</span></div></div>
<div class="note"><b>동작 범위를 먼저 구분하세요.</b> 모든 버전은 로컬 입력·예시 탐색 UI입니다. 실제 3+7 감정 모델은 미연결이며 캐릭터 슬롯도 자산 승인 대기입니다. 표의 ‘제공’은 UI / 로컬 기능 구현을 뜻하며 운영 분석 성공을 의미하지 않습니다.</div>
<nav aria-label="보고서 목차"><a href="#matrix">기능 비교표</a><a href="#ux">UX 분석</a><a href="#screens">화면 비교</a><a href="#engineering">구조·검증</a><a href="#decision">활용 판단</a></nav>
<section id="matrix"><span class="eyebrow">01 / FEATURE MATRIX</span><h2>기능 차이를 한눈에</h2><p class="caption">● 제공 · △ 조건부 제공 · — 해당 기능 없음. ‘없음’은 해당 버전의 목적에 따른 범위 차이이며 결함 점수가 아닙니다.</p>{table(['프로젝트']+features,matrix)}<p class="caption">Diary Social의 날짜·기간 분석은 날짜가 있는 복수 기록에서 제공됩니다. Diary Simple은 일기 상세 분석을 새 탭으로 분리하며 단일 기록·날짜 없는 기록은 일부 상세가 제한됩니다. 대화 버전도 날짜 결측 시 기간 분석에서 해당 표본을 제외합니다. 모든 도표 값은 예시 데이터입니다.</p></section>
<section id="ux"><span class="eyebrow">02 / EXPERIENCE</span><h2>무엇이 달라졌고, 어떤 부담이 생겼나</h2><p class="caption">레이아웃은 소스와 실제 예시 화면을 확인했습니다. 장점·부담은 구조에 근거한 정성 판단이며 사용자 실험 결과가 아닙니다.</p>{table(['프로젝트 / 핵심 변화','사용 흐름','시각 구성','강점','한계 / 유지보수'],detail)}</section>
<section id="screens"><span class="eyebrow">03 / REAL SCREENS</span><h2>동일한 표시 조건의 실제 화면</h2><p class="caption">Chrome · 라이트 모드 · 1440×1000 / 390×1000 뷰포트. 아래 썸네일은 결과 화면 상단을 잘라 보여주며 클릭하면 전체 높이 캡처를 엽니다. 시작 화면도 별도 링크로 제공합니다. 대화 버전은 내장 기본 예시, 일기 버전은 날짜 있는 4개 기록 예시로 데이터가 서로 다릅니다. 확률 수치나 카드 감정의 차이는 디자인 성능 차이가 아닙니다.</p><div class="gallery">{''.join(gallery)}</div></section>
<section id="engineering"><span class="eyebrow">04 / ENGINEERING & VALIDATION</span><h2>구조와 현재 테스트 결과</h2><p>공통 기술: Vanilla JavaScript · HTML/CSS · 메모리 상태 · 해시 라우팅 · 내장 한국어 서브셋 폰트. 앱 런타임에 외부 CDN이나 프레임워크 설치가 필요하지 않습니다. 7개 버전은 분리 소스를 Node 빌드로 단일 HTML에 합치고, Diary Simple은 단일 HTML을 직접 관리합니다.</p>{table(['프로젝트','배포 HTML 크기','편집 소스 규모','코드 테스트','검증 근거'],metrics)}<p class="caption">크기는 실제 index.html 바이트 / 1024를 반올림했으며 폰트도 포함합니다. 줄 수는 scripts·styles·templates의 JS/CSS/HTML에서 fonts.css를 제외한 물리적 줄 수입니다. 압축·긴 한 줄 코드가 있어 복잡도나 성능 점수로 사용할 수 없습니다. Diary Simple의 0개 분리 소스는 코드가 없다는 뜻이 아닙니다.</p>
<ul class="findings"><li><strong>Major · Diary Simple 테스트 2개 실패.</strong> simple.test.cjs:35의 분리 VM은 simpleOverview에 필요한 isDiary를 제공하지 않습니다. :46부터의 삭제 테스트는 함수 종료 문자열로 코드를 잘라내며 현재 소스에서 유효한 블록을 얻지 못해 ‘co is not defined’가 발생합니다. 전체 브라우저 결과 화면은 정상 렌더됐지만 삭제 동작 자체는 이번에 검증하지 않았습니다. 테스트 실패를 실제 앱 삭제 오류로 단정하지 않습니다.</li><li><b>Major · 운영 분석 미연결.</b> 루트 README의 기존 6분류 API와 이 프론트들의 3+7 분류 계약이 다릅니다. 실제 분석 서비스를 완성하려면 계약 확정과 API 통합이 필요합니다.</li><li><b>유지보수 · 독립 복제본의 증가.</b> 도메인·화면·테마 변경이 여러 폴더에 분산됩니다. v2→v3 scripts 차이는 core.js 표시명 한 줄이고, v3→v4는 app.js UX 변경입니다. 기준 버전을 정한 뒤 공통 코드화 범위를 검토하는 편이 좋습니다.</li><li><b>검증 범위.</b> 8개 앱의 시작 화면과 예시 결과를 실제 Chrome으로 열었습니다. 결과 화면 16개 조건에서 페이지 JavaScript 오류와 문서 가로 넘침은 없었습니다. 클릭 전수·다크 모드·320px·실기기·키보드 전체·스크린리더·대비·PNG 저장·Web Share·새 탭 E2E는 이번 검증 범위 밖입니다.</li><li><b>미실행 시험.</b> social.test.cjs 2개는 PNG 검사에 필요한 @napi-rs/canvas가 로컬에 없어 제외했습니다. 기존 browser.cjs / theme.cjs 등 전체 브라우저 시험도 실행하지 않았습니다. 이번 150개 통과율은 저장소 전체 시험 통과율이 아닙니다.</li></ul>
<p><a href="audit.json">수집 수치·브라우저 검사 JSON</a> · <a href="inspect.cjs">검사 스크립트</a> · <a href="build_report.py">보고서 생성 스크립트</a></p></section>
<section id="decision"><span class="eyebrow">05 / FIT FOR PURPOSE</span><h2>목적에 맞춰 기준 버전을 선택하면</h2><div class="recommend"><article><h3>대화 분석 통합</h3><b>Integrated TCG</b><p>요약·상세 탐색·도감·공유를 같은 흐름으로 보여주려는 경우에 적합합니다. 대시보드 정보량과 모바일 상세 이동을 다음 검증 대상으로 삼을 수 있습니다.</p></article><article><h3>일기 상세 분석</h3><b>Diary Social</b><p>입력 확인, 복수 기록, 날짜 조건과 상세 통계를 함께 설명할 때 적합합니다. 모델 계약과 데이터별 빈 상태 검증을 이어가야 합니다.</p></article><article><h3>카드 중심 간단한 경험</h3><b>Diary Simple</b><p>대표 카드와 공유에 집중한 시연에 적합합니다. 후속 개발 전 테스트 하네스 복구와 소스 분리·재생성 경로 정리가 우선입니다.</p></article></div><p class="caption">도감 탐색만 비교한다면 Cardex v4, 공유 출력 로직을 비교한다면 Social Studio가 유용한 기준입니다. 위 판단은 이 저장소의 코드와 화면 구성에 대한 비교입니다.</p><details><summary>README에 명시된 파생 관계</summary><p class="flow">Cardex → v2 → v3 → v4 → Social Studio<br>Social Studio → Integrated TCG<br>Diary Social → Diary Simple</p><p>폴더별 README가 명시한 관계만 표시했습니다. Diary Social의 기존 도메인·공유 코드 재사용은 확인했지만 특정 단일 부모 버전의 계보는 여기서 단정하지 않습니다.</p></details></section>
<footer>분석일 2026-11-03 · 대상 hw의 기존 하위 폴더 8개 전체 · 기존 앱 소스 변경 없음 · 스크린샷에는 내장 예시 데이터만 사용했습니다. 보고서와 screenshots 폴더를 함께 보관하세요.</footer></main></body></html>'''
(OUT/'index.html').write_text(html,encoding='utf-8')
markdown='''# HW 프론트엔드 비교 분석

이 보고서는 기존 8개 시안의 비교 자료입니다. 현재 메인 프론트는 [frontend/](../../frontend/README.md)이며 비교 대상에 추가하지 않습니다. `inspect.cjs` 재실행 시에도 `audit.json`에 기록된 기존 비교 대상을 사용합니다.

2026-11-03 로컬 소스 및 실제 Chrome 기준. [시각적 보고서](index.html)에서 기능 매트릭스와 데스크톱·모바일 캡처를 확인할 수 있습니다.

## 비교 요약

독립형 파일은 [standalone.html](standalone.html)입니다. 이미지·앱·근거 파일을 내장하며 파일 하나만 복사해 오프라인에서 열 수 있습니다. JavaScript를 허용해야 하며 내장 링크는 새 탭에서 열립니다. 원본 보고서나 연결 파일이 바뀌면 `python reports/frontend-comparison/build_standalone.py`로 다시 생성하세요. 검증: `node reports/frontend-comparison/verify_standalone.cjs` (기존 검증과 같은 Playwright 및 Chrome 사용). 앱의 운영 분석 API 미연결 등 기존 제약은 동일합니다.

| 폴더 | 주요 변화 | 강점 | 한계 | 이번 코드 시험 |
|---|---|---|---|---|
'''+ '\n'.join(md)+'''

## 핵심 판단

- 대화 분석 통합: integrated-tcg-2026-11-03. 요약·탐색·도감·공유 동선이 연결됨.
- 복수 일기 분석: diary-social-v1. 입력 확인과 날짜 유무에 따른 분석 분기가 있음.
- 간단한 카드 경험: diary-simple-v1. 대표 카드와 공유 우선이며 상세는 새 탭. 후속 개발 전 테스트 하네스 복구 필요.
- 도감 UX 비교: emotion-cardex-v4. 대표 감정 설명과 작은 목록, 차트 키보드 탐색 보강.
- 공통: Vanilla JS / 단일 HTML 배포 / 운영 3+7 모델 미연결 / 캐릭터 자산 대기. 예시는 실제 입력 분석이 아님.

## 접근 방식과 근거

루트 및 각 폴더 README, scripts/styles/templates, 빌드 도구, tests, v4 SYNC_STATUS를 읽었습니다. v2→v3와 v3→v4의 scripts 차이를 확인했습니다. 점수화 대신 구현 유무, 사용 흐름, 정성적 장단점, 실제 파일 크기와 시험 결과를 표시했습니다.

## 실행한 검증

`node reports/frontend-comparison/inspect.cjs`

이 스크립트는 각 폴더의 `*.test.cjs`에서 `social.test.cjs`를 제외해 `node --test --test-reporter=tap`으로 실행하고 결과를 logs에 저장합니다. 총 150개 중 148 통과, 2 실패입니다. social 시험은 PNG 의존성 @napi-rs/canvas 부재로 미실행입니다.

Diary Simple 실패: tests/simple.test.cjs:35의 VM에서 isDiary 의존성 누락. :46 이후 테스트는 함수 블록 문자열 추출 실패로 co is not defined 발생. 브라우저 전체 코드에는 isDiary가 존재합니다. 실제 삭제 오류로 단정하지 않았으며 삭제 E2E는 미실행입니다.

실제 Chrome 라이트 모드로 8개 앱 시작과 예시 결과를 열고 1440px/390px 결과 화면을 확인했습니다. 16/16에서 페이지 JS 오류와 문서 가로 넘침이 없었습니다. 일기에는 날짜 있는 4개 기록 fixture, 나머지에는 기본 대화 fixture를 사용해 수치 자체는 직접 비교 대상이 아닙니다. screenshots의 전체 높이 PNG와 audit.json을 참조하세요.

`python reports/frontend-comparison/build_report.py`

수집 결과로 HTML과 이 Markdown을 생성합니다. inspect.cjs는 임시 폴더 aibootcamp-frontend-review의 Playwright와 Windows의 설치된 Chrome을 사용합니다. 앱 의존성이나 루트 설정은 변경하지 않았습니다.

## 범위와 한계

다크 모드, 상세 화면 전수, 실제 파일 업로드, 삭제, 새 탭, PNG 다운로드, Web Share, 키보드/스크린리더, 대비, 320px와 실기기 검증은 이번 범위 밖입니다. 기존 QA 문서의 과거 통과 결과를 이번 결과로 계산하지 않았습니다. 테스트 수는 중복 도메인 시험도 포함하므로 버전별 품질 순위로 해석하지 않습니다.

분리 소스 줄 수는 fonts.css 제외 scripts/styles/templates의 물리적 줄 수입니다. HTML 크기는 내장 폰트 포함 원본 바이트이며 성능 측정이 아닙니다. Diary Simple은 소스 분리/빌드 도구가 없는 단일 HTML입니다. 여러 버전의 복제 코드는 향후 수정 전파 부담이 있으므로 기준 버전을 정한 뒤 공통화 범위를 검토하는 것이 좋습니다.
'''
(OUT/'README.md').write_text(markdown,encoding='utf-8')
print('Generated index.html and README.md for',len(projects),'projects')
