# Emotion Cardex v2 · 라이트/다크 모드

이 폴더는 기존 `design-lab/emotion-cardex/`를 보존한 신규 버전입니다. 상단 **표시 모드**에서 시스템·라이트·다크를 선택합니다. 시스템 설정을 실시간 반영하며 수동 선택은 표시 설정만 localStorage에 저장합니다. 저장이 차단되어도 현재 탭에서 전환됩니다. 감정 분류·확률·캐릭터 슬롯 정책은 동일합니다.

테마 코드는 `scripts/theme.js`, 테마 토큰과 컴포넌트 스타일은 `styles/themes.css`에 있습니다. `templates/shell.html`에서 최초 렌더 전 설정을 적용하고 `tools/build.mjs`가 CSS·JS를 내장한 `index.html`을 만듭니다. 원본 v1의 Figma는 디자인 참고이며 다크 모드를 Figma에 추가한 것은 아닙니다.

공식 문서에 보편적인 단일 폴더 규격이 있는 것은 아닙니다. 이 프로젝트는 [MDN의 index/styles/scripts 관례](https://developer.mozilla.org/en-US/docs/Learn_web_development/Getting_started/Environment_setup/Dealing_with_files)를 유지하고, [Chrome의 color-scheme·시스템 설정 변경 처리 지침](https://developer.chrome.com/docs/modern-web-guidance/guides/visual-design/dark-mode)을 적용합니다. 3가지 선택에는 네이티브 select와 명시적인 레이블을 사용합니다.

# 기존 기능과 실행 방법

기존 Figma TCG의 크림·네이비·골드 스타일을 적용한 독립 UI 데모입니다. **3대분류 선택 → 해당 7소분류 탐색(3·3·1)** 흐름을 사용합니다. 기존 루트 `index.html`, FastAPI, 모델, 이미지와 공통 설정을 변경하지 않습니다.

## 실행

`index.html`을 브라우저에서 직접 여세요. CSS·JS·IBM Plex Sans KR 폰트가 내장되어 인터넷이나 빌드 서버 없이 실행됩니다. 분리한 소스는 `styles/`, `scripts/`, `templates/`에 있습니다.

소스를 수정한 뒤 Node.js 18 이상에서 다음 명령으로 단독 HTML을 재생성합니다.

```bash
node design-lab/emotion-cardex-v2/tools/build.mjs
node --test design-lab/emotion-cardex-v2/tests/core.test.cjs
```

상위 폴더에서 정적 서버를 띄워도 됩니다.

```bash
python -m http.server 8000
```

주소: `http://localhost:8000/design-lab/emotion-cardex-v2/`

## 범위

- 시작, 업로드, 본인 화자, 진행/오류, Overview, 감정 도감, 카드 갤러리, 7종 카드 상세
- 3대분류 누적 가로 막대, 부모별 7소분류 가로 막대, 발화 순서 Line Chart, 일·주·월 평균, 현재 파일 캘린더
- 카드→분석 ID 연결, 검색·정렬·필터·이전/다음·확대·복귀 상태 보존
- 빈 결과·분석 불가·중립·날짜 없음, 설명/이미지 독립 실패
- 데스크톱/태블릿/모바일, 키보드 포커스, 그래프 값 표, reduced-motion

**운영 3+7 모델은 연결되지 않았습니다.** 파일 업로드는 실제 로컬 파싱과 화자 선택까지 실행합니다. 분석 실행은 명확한 연결 대기 상태를 표시합니다. 예시 결과는 사용자가 별도의 예시 체험 버튼을 눌렀을 때만 표시하며, 업로드한 대화의 분석 결과로 표시하지 않습니다. 현재 저장소의 `/api/analyze`는 이전 6분류이므로 호출하거나 라벨을 변환하지 않습니다.

캐릭터 슬롯은 승인된 7종 매핑 전까지 비어 있습니다. 홀로그램/프레임/테마는 시각 미리보기이며 확률을 바꾸지 않습니다. 획득·희귀도·팩·영구 저장·수집률은 구현하지 않습니다. 새로고침하면 분석과 탐색 상태는 초기화됩니다. 대화 내용의 저장이나 외부 전송은 없습니다.

## 구조

| 경로 | 역할 |
|---|---|
| index.html | 모든 의존성을 내장한 배포/실행 파일 |
| templates/shell.html | HTML 진입 템플릿 |
| styles/styles.css | TCG 토큰·레이아웃·반응형·상태 |
| styles/fonts.css | 라이선스가 허용하는 IBM Plex Sans KR UI 글리프 서브셋 |
| scripts/core.js | 분류·파서·윈도우·확률·집계·표현·구간, DOM 없는 순수 함수 |
| scripts/app.js | 화면 렌더·라우트·이벤트·메모리 상태 |
| tools/build.mjs | 분리 소스에서 단독 index.html 생성 |
| tools/render-preview.cjs | 가상 DOM 기반 마크업 스모크 확인 |
| tests/core.test.cjs | 데이터 계약·원본 집계·에러·텍스트 이스케이프 테스트 |
| tests/browser.cjs | 선택적 Playwright E2E·반응형 검증 |
| docs/PLAN.md | 15개 항목의 종합 설계와 실행 로드맵 |
| docs/API.md | 기존 구현과 새 API의 차이 및 연결 계약 |
| docs/QA.md | 실제 수행 결과와 미검증 항목 |
| docs/FIGMA.md | 실제 Figma 링크 및 화면 대응 |

특정 프레임워크로의 교체는 하지 않았습니다. 별도 폴더 정책이 없어 [MDN의 index/styles/scripts 관례](https://developer.mozilla.org/en-US/docs/Learn_web_development/Getting_started/Environment_setup/Dealing_with_files)를 적용했습니다. 유일한 국제 표준 또는 사용량 1위 구조라고 주장하지 않습니다.

## 데이터 기준

7소분류의 전체 기준 확률 평균을 먼저 보존하고 부모는 자식의 합으로 계산합니다. 화면은 그 결과를 3대분류→7소분류 순서로 탐색합니다. 대표 부모와 최다 자식은 독립 argmax입니다. 예시는 부모 긍정45%, 부정40%, 중립15%이며 최다 소분류는 불안25%입니다. 이는 부모·자식의 대표가 다를 수 있음을 검증하는 의도적인 예시입니다.

시간 정보가 없는 유효 결과는 전체 분포에 포함하고 기간 집계에서만 제외합니다. 기간 평균은 원본 유효 표본으로 가중합니다. 데이터 없는 날짜는 0이나 중립으로 채우지 않습니다. 반복 표현 데모는 공백1–3gram이며 운영 Kiwi 분석과 다릅니다.

## 브라우저 검증 재실행

테스트 환경에 Playwright와 Chromium을 준비한 다음 실행합니다. 앱 실행에는 이 의존성이 필요하지 않습니다.

```bash
node design-lab/emotion-cardex-v2/tests/browser.cjs
```

환경별로 `CARDEX_PLAYWRIGHT`(패키지 경로), `CARDEX_CHROMIUM`(실행 파일), `CARDEX_QA_OUTPUT`(결과 JSON)을 지정할 수 있습니다. 검증 범위와 제외 항목은 `docs/QA.md`를 확인하세요.

내장 폰트는 UI와 테스트 문구의 글리프를 서브셋으로 제공합니다. 그 밖의 화자 이름 등에는 운영체제의 한국어 대체 글꼴을 사용합니다. 선택적 재생성 도구는 `tools/subset-fonts.py`입니다.

폰트 저작권 및 SIL OFL은 `docs/licenses/ibm-plex-sans-kr.txt`에 보존했습니다. 게임 캐릭터·카드 일러스트·로고 자산은 포함하지 않았습니다.
