# MOMENT CARD — Emotion Cardex 기획 및 구현 계획

작성일: 2026-11-02 · 범위: 신규 독립 테마 / 프론트엔드 데모 · 기준: 첨부 SRS_latest_copy.docx, SDS_v1.docx 및 실제 저장소 main `7b991ba`

## 1. 프로젝트 현황과 기존 TCG 분석

SRS·SDS는 2026-10-30 분류 개정 및 10-31 UI 개선 기록을 포함한다. 현재 공통 계약은 3대분류·7소분류, 최근 전체 텍스트 100개, 본인 화자 직접 선택, 대상 화자 최대 3개 윈도우, 첫 발화 연결이다. 문서의 테마 수 15와 실제 Figma의 17개 테마는 차이가 있다. 새 파일에는 기존 문서를 덮어쓰지 않고 현재 조사 결과를 기록한다.

실제 Figma `rbltFfXw8DHEstuit2ycLZ`에는 00 Overview, 01 Review, 02 TCG, 03–18 테마가 있다. TCG는 시작·업로드·진행·결과·분포·흐름·일주월·캘린더·7개 카드 상세·상태를 이미 포함한다. 최신 V4 차트와 정확한 값 표도 존재한다. 따라서 누락됐다고 단정하지 않는다. 1440px 결과 프레임 `147:2998`은 긴 단일 열, 상단 수치, 하단 캐릭터 슬롯과 갤러리 경로를 사용한다. 글꼴은 IBM Plex Sans KR이다. 로컬 TCG 토큰에는 옛 6분류 의미 이름이 남아 있어 신규 분류 토큰으로 그대로 재사용하지 않는다.

실제 포크는 `NotHyoone/AIBootcamp`이며 원본은 `nite855/AIBootcamp`이다. 포크에는 main만 있다. README, index.html, main.py와 전체 트리를 확인했다. AGENTS.md, CONTRIBUTING, Code Connect, 프론트엔드 패키지 및 별도 브랜치 정책은 없다. 현재 FastAPI `POST /api/analyze`는 줄별 6분류를 반환한다. 최신 SDS의 parse/analysis/narrative/image API는 아직 구현되지 않았다. 이전 6분류를 이름만 바꿔 3+7로 사용하지 않는다.

## 2. 게임 구조 비교와 적용

| 참조 | 참고하는 구조 | Emotion Cardex 적용 | 제외 |
|---|---|---|---|
| 포켓몬 도감 | 번호·유형·검색·정렬·상세 | EC-001–007, ID/표시명 검색, 부모 필터, 이전·다음 | 게임 캐릭터·로고·수집 완료율 |
| 디지몬 | 식별 가능한 유형과 여러 형태 | 안정된 emotion_id에 여러 variant 연결 | 진화가 감정 개선이라는 암시 |
| TCG Pocket | 카드 갤러리·확대·시각 연출 | 기본형/프레임/홀로 표현 미리보기와 확대 | 카드팩·획득·희귀도 보상·영구 보유 |

공식 도감과 카드 소개를 참고하되 외형과 자산을 복제하지 않는다. 디지몬의 게임별 진화 규칙을 분석 데이터의 관계로 옮기지 않는다. 변형형 관계는 이 프로젝트의 별도 시각 데이터 모델이다.

## 3. 핵심 컨셉

**Emotion Cardex — 대화의 감정을 한 장씩 발견하다.** 최신 사용자 지시에 따라 기존 TCG의 크림(#F6F3EA)·네이비(#18283D/#264D8B)·골드(#AA7E35), IBM Plex Sans KR 및 카드 프레임을 적용한다. 1단계 긍정·부정·중립 → 2단계 부모별 소분류 3·3·1을 탐색한다. 전체7개는 명시적인 비교 보기이다. 통계가 카드의 앞면에 항상 보이고 빈 일러스트 영역은 자산 승인 상태를 알려준다. 확률은 모델 예측값이며 강도·성격·건강·희귀도 점수가 아니다. 분석 탐색을 기본 경험으로 하고 게임 수집은 후속 범위로 분리한다.

## 4. 사용자 목표와 여정

처음 방문: 소개 → PC TXT 업로드/로컬 검증 → 본인 화자 선택 → 분석 계약 안내 → 분석 진행/실패 복구 → 결과. 예시 체험은 별도 버튼으로 명시하며 업로드한 파일의 분석 결과로 대체 표시하지 않는다.

결과 탐색: Overview → 3·7 분포 → 발화 순서 흐름 → 도감/갤러리 → 카드 상세 → 해당 소분류 흐름 → 이전 화면. 검색·부모 필터·정렬·선택 카드·스크롤은 메모리와 브라우저 히스토리에 보존한다. 대화 내용은 저장하거나 외부 전송하지 않는다.

## 5. IA와 전환 구조

상위: 분석 시작 / 결과 요약 / 감정 도감 / 카드 갤러리 / 분석 탐색. 분석 탐색에는 분포, 흐름, 기간, 캘린더, 반복 표현, 종합 결과가 있다. 모바일 하단은 요약·도감·갤러리·흐름·더보기 5개로 구성하며 더보기에 모든 나머지 화면을 제공한다. 카드 상세와 확대는 각각 라우트와 모달이다.

컴포넌트 계층: AppShell → Sidebar·ContextHeader·MobileNavigation → RouteView → PageHeading·Panel·EmotionCard·DistributionBars·FlowChart·ExactDataTable·FilterBar·StatusNotice. CardDetail → CardPreview·VariantPicker·ProbabilityFacts·FlowChart·ExpressionEvidence·DetailNavigation. UploadFlow → FileInput·SpeakerList·ProgressSteps·RecoveryPanel.

## 6. 화면별 설계

표의 모든 화면은 Desktop 1440, Mobile 390 편집 가능 Figma 화면과 대응 HTML 라우트를 갖는다. Tablet은 대표 Overview·갤러리·상세 834px를 추가하고 768–1023px에서 2열, 축소 내비게이션을 적용한다. 320px까지 검증한다. 화면은 복제 페이지가 아니라 탭·상세를 통합한 SPA이다.

| 화면/라우트 | 목적·행동 | 데이터·컴포넌트 | 상호작용·오류/복구 |
|---|---|---|---|
| 01 시작/start | 서비스와 입력 범위 이해 | Hero, 빈 카드 스택, 3단계 설명 | 업로드 또는 명시적 예시 체험 |
| 02 업로드/upload | PC TXT 선택 | 파일명·크기·지원 형식, FileInput | 잘못된 확장자·빈 파일·파싱 불가·모바일 형식 안내 및 교체 |
| 03 화자/speaker | 본인 직접 지정 | 파싱한 화자, 최근100개 내 인원별 수 | 라디오 선택; 표본0이면 분석 차단; 다른 파일 |
| 04 진행/progress | 단계·범위와 복구 이해 | ProgressSteps, 대상 수·윈도우 규칙 | 운영3+7 API 미연결 명시; 재시도·화자 변경·명시적 예시 열기 |
| 05 요약/overview | 핵심 사실 파악 | 부모/소분류 독립 대표, 범위, 카드, 분포, 흐름, 반복, 설명 | 분석/카드 상세 이동; 예시 배지 유지 |
| 06 도감/cardex | 안정된 7개 유형 이해 | CardexGrid, 번호·ID·부모·확률 | 부모 필터·검색·상세; 검색0은 결과 없음으로 표시 |
| 07 갤러리/gallery | 카드 표현 탐색 | 2/3/4열 카드, VariantPicker, 정렬 | 기본/테마/홀로/프레임 미리보기; 획득·희귀도 지표 없음 |
| 08 상세/detail | 카드와 분석 근거 연결 | 확률·분포 위치·해당 계열 흐름·표현·근거 | 확대/축소, 이전·다음, 그래프, 상태 보존 복귀 |
| 09 분포/distribution | 전체 기준 비교 | 3부모 누적 가로 막대와 부모별7가로 막대, 수치표 | 소분류 선택 시 동일 확률 강조; 반올림 설명 |
| 10 흐름/flow | 발화 순서별 추세 확인 | 3계열 Line, 5보기, 계열 체크박스, 툴팁, 값 표 | Y항상0–100%; 색·패턴·텍스트 병행; 카드 선택과 ID 공유 |
| 11 기간/period | 일·주·월 집계 | 기간 단위, 원본 유효 표본 평균·표본 수 | 날짜 없는 결과 제외 수 표시; 전부 없으면 비활성 및 흐름 복귀 |
| 12 캘린더/calendar | 현재 파일의 날짜 탐색 | 월 이동, 유효 날짜 버튼, 선택일 표본·분포·흐름 | 기록없음≠0/중립; 날짜 없음 안내; 선택날짜 유지 |
| 13 반복/repeats | 원본 표현 횟수 확인 | 등장발화수·총횟수·분모·부모/소분류 개수·평균확률 | 표현 상세 펼침; 필터는 같은 원본 결과 기준 |
| 14 종합/summary | 사실 중심 결과 이해 | 구조화 JSON 기반 관찰 문장, 독립 부가 상태 | 설명 실패·재시도에도 통계 유지; 인과·조언 생성 안 함 |

Desktop wireframe: 208px Sidebar | Main(상단 ContextHeader 72 / Heading / 대표카드+지표 / 2열 분포·흐름 / 7유형 미리보기 / 표현·변화·설명). 갤러리는 4열. Mobile: Header / Heading / 대표카드+2열 지표 / 분포 / 흐름 / 카드2열 / 표현·설명 / 고정 BottomNav. 상세는 Desktop 카드 : 분석=약1:2, Mobile 카드→통계→흐름→근거 순서다.

## 7. 카드와 변형형

| 도감번호 | emotion_id | 부모 | 시연 표시명 | 패턴 |
|---|---|---|---|---|
| EC-001 | pos_1 | positive | 기쁨 | 원형 |
| EC-002 | pos_2 | positive | 만족 | 격자 |
| EC-003 | pos_3 | positive | 안정 | 수평선 |
| EC-004 | neg_1 | negative | 불안 | 대각선 |
| EC-005 | neg_2 | negative | 슬픔 | 세로선 |
| EC-006 | neg_3 | negative | 분노 | 사선격자 |
| EC-007 | neutral | neutral | 중립 | 점 |

EmotionType={id,dex_number,parent_id,display_name,display_name_status:'demo',color,pattern,asset_id:null}. CardVariant={variant_id,emotion_id,presentation:'base|illustration|theme|holo|frame',asset_id:null,approval_status:'unmapped'}. AnalysisCardView={emotion_id,analysis_id,probability,valid_count,variant_id}. 번호는 유형 번호이다. 모든 변형은 동일한 확률을 참조한다. 새 자산·매핑·진화·희귀도·획득은 실제 구현하지 않는다. 일러스트 변형은 승인 전 비활성이다.

## 8. 분석 데이터와 카드 연결

비텍스트 제거 → 전체 최근100텍스트 → 선택화자 추출 → 최대3개, stride1, 첫 발화 anchor → 유효7확률 → 자식평균과 부모합. 분포는 유효 anchor 수 N을 분모로 한다. 윈도우가 겹쳐도 원본 발화를 중복 복제하지 않는다. 유효하지 않은 결과는 중립으로 보정하지 않는다. 확률 합계 허용오차는1e-6, truncated 결과는 거절한다. 부모내 조건부 확률은 본 UI에 표시하지 않는다.

카드 확률=summary.leaf_probabilities[id], 차트=timeline[].leaf_probabilities[id], 부모=children.reduce(sum), 기간=동일 유효 anchor 중 timestamp와 범위가 일치하는 값의 평균. 날짜평균을 단순 평균하지 않는다. 전체 분포는 timestamp 없는 유효 결과도 포함하며 기간·캘린더는 제외 수를 명시한다. 대표 부모와 최다 소분류는 별도 argmax, 동률은 안정된 ID 순서로 결정하고 공동최대 안내를 제공한다.

반복 표현: 원본 대상 화자 수 M, 서로 다른 발화 등장수 >=max(2,ceil(.03M)). 총출현수와 등장발화수를 별도 계산한다. 연결된 유효 결과만 평균하며 연결수와 미연결수를 표시한다. 데모의 공백1–3gram 후보는 Kiwi 형태소·불용어 기반 운영 분석과 다름을 명시한다.

## 9. 디자인 시스템

Primary #264D8B / Secondary #18283D / Accent #AA7E35 / Background #F6F3EA / Surface #FFFFFF / Text #18283D / Muted #59677B / Border #D7DCE3. 부모 색은 긍정 #278E81, 부정 #D25B35, 중립 #78899B로 고정하고 밝은 도형에는 짙은 텍스트를 사용한다. Success #17664F / Warning #805700 / Error #A42F35. 소분류는 ID별 색과 번호·표시명·패턴 병행. 간격4·8·12·16·24·32·48, 반경8·12·18·24. 카드 5:7, 제목28–48, 본문16, 레이블14, 보조12. 글꼴 IBM Plex Sans KR 및 시스템 한국어 대체.

Button(default/hover/focus/pressed/disabled/loading), FilterChip, Input, NavigationItem, EmotionCard, Notice, Tabs, ProbabilityBar, FlowChart, ExactTable, Dialog를 재사용한다. 44px 이상 주요 터치, 포커스3px, 색 이외 표식, 그래프 값 표, reduced-motion을 제공한다. WCAG 2.2 AA 목표이며 전체 인증 통과를 주장하지 않는다.

## 10. 상호작용과 상태

카드 hover는 2px 상승·프레임 강조150ms, holo는 정적 빛 패턴이다. 확대는 native dialog로 Escape, 포커스 순환과 복귀를 지원한다. 뒤집기는 설명 탭으로 대체하여 중요한 수치를 숨기지 않는다. reduced-motion에서는 transition/transform 제거한다. 이전·다음은 현재 필터 결과의 순서이며 양 끝에서 순환한다. 상세 진입 전 필터와 스크롤을 기억한다.

상태는 idle/loading/success/partial/error/empty/unavailable로 분리한다. statistics/narrative/image는 독립 상태다. 자산 미승인 상태는 이미지 실패와 다르다. 설명 재시도에는 계산된 JSON 사실만 사용하며 실제 LLM 성공처럼 표시하지 않는다. 데이터 부족은 표본 수 안내, 분석 불가는 재분석·다른 파일, 시간 없음은 순서 기반 흐름으로 복구한다.

## 11. 기술 구현과 API

새 독립 정적 UI를 `hw/emotion-cardex/`에 추가하고 기존 FastAPI·루트HTML을 수정하지 않는다. CSS와 JS 원본은 styles/와 scripts/에 나누고 tools/build.mjs가 동일 코드를 내장한 단독실행 index.html을 만든다. Node 내장 기능만 사용하며 런타임 빌드·서버·CDN 의존성이 없다. 전체 프로젝트 구조에 강제 표준은 없으므로 MDN의 index/styles/scripts 관례를 따르고 소문자·하이픈을 사용한다.

core.js=taxonomy·parser·window·validation·aggregation·repeat·trend, app.js=route·state·render·events. 향후 React로 옮길 때 위 컴포넌트 경계를 유지한다. SVG 차트는 Chart.js와 동등한 의미의 0–100% 축·범례·값표를 갖고 외부 의존성을 줄인다. 현재6분류 API는 호출하지 않는다. 미래 SDS 4개 endpoint는 API.md에 정의하고 taxonomy_version·anchor·정규화 검사 후에만 화면에 연결한다. 미연결 API 버튼은 설명 가능한 오류로 끝나며 예시 데이터로 자동 대체하지 않는다. AbortController/요청ID와 Promise.allSettled는 운영 연결 단계에 적용한다.

## 12. P0–P3 실행 로드맵

| 우선순위 | 문제/영향 → 목표 | 작업/화면 | 데이터·선행 | 완료기준·검증 |
|---|---|---|---|---|
| P0-1 | 6분류 API와 계약불일치→왜곡 방지 | 계약 검증·예시/실제 분리, 전 화면 | SDS, taxonomy | 6분류·합계오류·truncated 거절 단위시험 |
| P0-2 | 대상/최근범위 오해→정확한 표본 | PC파서·100개·직접화자·window | 원본TXT, P0-1 | 101개/비텍스트/1·2·3개/화자0 시험 |
| P0-3 | 결과상태 혼동→복구 | empty/invalid/no-time/partial, 업로드·진행·결과 | 상태모델 | 실패와 중립구분, 설명실패 후통계 불변 |
| P0-4 | 집계분모 혼용→일관된 사실 | 평균·부모합·날짜·반복·구간, 분석화면 | 유효 anchor | 수동기대값·가중평균·원본중복방지 시험 |
| P1-1 | 긴 결과·분리된 카드→상세 탐색 | Overview→도감→상세→flow | P0 | 같은ID/같은확률/복귀상태 E2E |
| P1-2 | 작은화면/키보드 단절→모든경로 | 반응형·더보기·dialog·focus | P1-1 | 320/390/834/1440, Escape/Tab 검증 |
| P2-1 | 번호·필터·변형 혼동→명확한갤러리 | 검색·부모필터·정렬·변형,6–8 | 카드모델 | 7ID·검색0·reset·previous/next |
| P2-2 | Figma/HTML 드리프트→같은소스 | 동일 fixture·토큰·화면구조,편집레이어 | 코드기준 | 화면별 매핑·스크린샷·레이어 확인 |
| P3 | 과한게임효과→선택적표현 | 정적holo·프레임·확대 | P0–2 | 확률불변, reduced-motion |
| 확장 | 영구기록없음→별도후속 | 저장·획득·팩·희귀도·진화 | 사용자승인·DB·정책·인증 | 현 범위 제외; 설계결정 후 별도QA |

## 13. QA 계획

1. 7ID와 번호 일치, 카드→확률→차트 같은 값. 2. 합계1±1e-6, 부모합, 원본 숫자 보존. 3. 부모 positive가1위이나 leaf neg_1이1위인 fixture. 4. 101개 이상에서 상대 포함최근100, 화자선택 후만분석. 5. 최대3·stride1·첫anchor. 6. 중립/분석불가/결과없음/시간없음. 7. timestamp없을 때 기간과캘린더 비활성. 8. 모바일 상세→뒤로 필터·검색·스크롤·포커스. 9. 검색0·해제·sort·이전다음. 10. 설명/이미지 실패에도통계불변. 11. 긴한국어·320px·200%확대. 12. 키보드·포커스·대비·reduced-motion. 13. 원본9개 blob SHA, 기존Figma 페이지·프레임 불변. 14. 일·주·월 가중표본, 날짜누락, 반복표현 원본중복제거. 15. 파일의 HTML문자열을 실행하지 않는 XSS 방어. 16. 운영모델·API·스크린리더·실기기 시험은 환경 없으면 미검증.

실행 결과와 미검증은 QA.md에 별도로 기록한다. 계획만 있는 항목을 통과로 표시하지 않는다.

## 14. 기존 TCG 대비 개선 효과

필수 그래프를 새로 발명하지 않고 기존 계약을 보존한다. 변화는 도감이라는 안정된 유형 사전, 분석별 갤러리, 동일ID의 시각변형, 카드와 흐름 사이의 직접 연결, 독립 대표값, 데스크톱2열·모바일핵심순서, 상태보존 탐색이다. 실제 효과는 과업시간·상세진입성공률·복귀오류율·확률해석정답률을 비교 사용자시험으로 평가해야 하며 현재 측정된 개선률은 없다.

## 15. 미확정·충돌·향후 확장

미확정: 학습 라벨·중립기준·taxonomy 정식버전, 자산7매핑, 새모델성능, 개인정보운영정책, 운영API, 희귀도/획득기준/저장. 충돌: 실제6분류API↔3+7문서는 어댑터 선행; 표준별도소스↔단독HTML은 생성빌드로 양립; 계획먼저↔최종제작요청은 계획을 확정기준으로 기록한 뒤 새파일에서 실행. 원본00/01/TCG는 수정하지 않는다. 현재범위의 시각변형은 감정분류·확률을 바꾸지 않는다.

## 참고 자료

- [MDN: 파일 구조와 소문자 네이밍](https://developer.mozilla.org/en-US/docs/Learn_web_development/Getting_started/Environment_setup/Dealing_with_files)
- [W3C APG: Modal dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [공식 포켓몬 도감](https://www.pokemon.com/pokedex/)
- [공식 디지몬 도감](https://digimon.net/reference_en/)
- [공식 TCG Pocket 소개](https://tcgpocket.pokemon.com/en-us/)

웹의 단일 보편 폴더 표준이나 객관적 사용량1위가 있다고 단정하지 않는다. 여기서는 프로젝트에 맞는 MDN의 일반 관례를 채택했다.
