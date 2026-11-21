# MOMENT CARD — TCG Social Studio v1

Figma [TCG Social Studio Draft 02](https://www.figma.com/design/DaIq7zBX9frMFoaa2JKdnA?node-id=4-3523)의 크림·네이비·골드 스타일을 적용한 독립 프론트입니다. 기존 `design-lab/emotion-cardex-v4`의 도메인 함수와 탐색 기능을 재사용하며, 기존 파일은 변경하지 않습니다.

## 실행
`index.html`을 브라우저에서 직접 여세요. HTML·CSS·JavaScript·IBM Plex Sans KR 서브셋 폰트가 내장되어 별도 빌드나 외부 CDN이 필요하지 않습니다.

정적 서버로 실행하려면 저장소 루트에서:
```bash
python -m http.server 8000
```
주소: `http://localhost:8000/design-lab/tcg-social-studio-v1/`

루트 FastAPI는 이 하위 경로를 자동 제공하지 않습니다. FastAPI/기존 index.html/패키지 설정을 수정하지 않았습니다.

## 구현
- PC TXT 로컬 파싱, 화자 직접 선택, 비텍스트 제외 후 전체 최근 100개 제한.
- 분석 요약·3/7분류 막대·5개 추이 보기·계열 제어·원본 기준 반복 표현·종합 결과.
- 감정 캘린더, 실제 월 탐색, 선택일 분포와 발화 흐름, 일/주/월 집계, 7감정+전체 비교의 8개 상세 보기.
- 날짜 결측 공백, 전체 기준 0–100% 축, 기간 원본 발화의 가중 집계.
- 7종 도감·자유 검색·정렬·상세·이전/다음·확대·검색 및 선택 상태 보존.
- 공유 편집기: 1:1/4:5, 골드/잉크, 확률 수치 표시/숨김. 총 8개 외형 조합.
- Canvas PNG 생성(1080×1080, 1080×1350), 다운로드 요청, 지원 기기의 Web Share, 취소/실패 복구.
- 블로그 표지와 사실 요약을 같은 공개 설정으로 생성, 클립보드 복사 또는 직접 선택 대체.
- 공개 출력은 감정 유형·선택 수치·표본·범위·예시 표시만 포함. 이름·파일명·대화방명·원문·반복 표현·내부 분석 ID 제외.
- 새 파일 선택 시 이전 결과·공유 스냅샷·Blob URL 무효화.
- 라이트/다크/시스템, 반응형 CSS, 키보드 포커스·차트 값 표·움직임 감소 규칙.
- 캐릭터 영역은 빈 슬롯이며 프레임 장식은 확률·희귀도와 무관합니다.

## 실제 분석의 경계
**운영 3+7 모델 API는 연결하지 않았습니다.** 현재 저장소의 `/api/analyze`는 이전 6분류이므로 호출하거나 라벨을 바꾸지 않습니다. 업로드한 대화는 파싱과 화자 선택 후 ‘연결 대기’를 표시합니다.

예시 결과는 별도 예시 체험 버튼을 눌렀을 때만 표시됩니다. 설계 fixture는 긍정45/부정40/중립15%, 소분류18/15/12/17/14/9/15%와 선택 화자43개입니다. 이를 실제 대화 분석으로 표시하지 않습니다.

대화는 브라우저 메모리에서 처리하고 외부 전송·영구 보관하지 않습니다. localStorage에는 이 새 버전의 표시 모드만 저장합니다. PNG 생성 완료, 다운로드 요청, 실제 갤러리 저장, SNS 게시 완료는 서로 구별합니다. 클립보드와 Web Share는 브라우저·보안 컨텍스트·권한에 따라 제한될 수 있습니다.

## 소스와 재생성
| 경로 | 역할 |
|---|---|
| index.html | 단독 실행 결과물 |
| templates/shell.html | HTML 진입 템플릿 |
| scripts/core.js | 기존 도메인 함수와 최신 설계 fixture |
| scripts/app.js | 기존 화면·라우팅·상태, Social 코드 삽입점 |
| scripts/social.js | 공개 데이터 어댑터·편집기·PNG·블로그·기간 상세 |
| scripts/theme.js | 독립 표시 모드 설정 |
| styles/social.css | Figma Social Studio 레이아웃/토큰 적용 |
| styles/styles.css, themes.css, fonts.css | 재사용 기반 스타일·테마·내장 폰트 |
| tools/build.mjs | 위 소스를 하나의 HTML에 내장 |
| tests/ | 도메인·출력·선택적 실제 브라우저 검증 |
| docs/QA.md | 수행한 검증과 미검증 |
| docs/CHANGELOG.md | 원본 보존과 변경 이력 |

```bash
node design-lab/tcg-social-studio-v1/tools/build.mjs
node --test design-lab/tcg-social-studio-v1/tests/core.test.cjs design-lab/tcg-social-studio-v1/tests/labels.test.cjs
```

출력 검증은 개발 환경에 `@napi-rs/canvas`, 브라우저 검증은 `playwright`와 Chromium이 필요합니다. 앱 실행에는 필요하지 않습니다. 해당 개발 패키지를 준비한 뒤:
```bash
node --test design-lab/tcg-social-studio-v1/tests/social.test.cjs
node design-lab/tcg-social-studio-v1/tests/browser.cjs
node design-lab/tcg-social-studio-v1/tests/social-browser.cjs
```
환경별로 `STUDIO_CANVAS`, `CARDEX_PLAYWRIGHT`, `CARDEX_CHROMIUM`에 패키지/실행 파일 경로를 지정할 수 있습니다.

## 검증 상태
도메인20개와 Social10개, 총30개 검사 통과. 17개 화면의 마크업 렌더, 8개 공개 설정, 개인정보 허용 목록, 잘못된 계약 차단, 복사 거부 복구, 두 규격의 PNG 바이트·크기를 확인했습니다.

**현재 실행 환경이 Chromium의 소켓 생성을 차단해 실제 브라우저 E2E는 실행 시작 단계에서 중단되었습니다.** 반응형 실기기·클릭 전수·실제 다운로드/클립보드/Web Share·WCAG AA·화면의 픽셀 일치는 미검증입니다. 관련 테스트를 포함했지만 통과했다고 주장하지 않습니다.

폰트는 기존 UI 글리프 서브셋이며 없는 글리프는 운영체제 한국어 글꼴로 대체됩니다. 라이선스는 `docs/licenses/ibm-plex-sans-kr.txt`에 있습니다.

