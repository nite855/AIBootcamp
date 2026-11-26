# 디자인 QA

## 2026-11-14 요약 홈·테마 갤러리 검증

Windows / Playwright / Chrome headless에서 아래 검사를 통과했습니다. 명령은 `frontend/` 기준입니다.

| 명령 | 결과 |
|---|---|
| `node tools/build.mjs` | 단일 HTML·원본 SVG 내장·9개 테마 토큰 생성 |
| `node --test tests/*.test.cjs` | 단위 테스트 62개 통과 |
| `node tests/home-view.cjs` | 버튼 5~8개, 최근 3편 정렬, 초안 보존, 안전한 원문, PC·390/320px·미리보기 적용 버튼·리사이즈 중 메뉴 유지 |
| `node tests/browser.cjs` | 46개 검사, 탐색·도감·통계·기록 수정·PNG, 오류·외부 요청 없음 |
| `node tests/themes.cjs` | 9개 테마·18개 팔레트/PNG, 3개 너비, 대비 4.5:1, 미리보기 격리·취소·적용·다중 탭 표시·시스템 모드·저장 차단·오프라인 |
| `node tests/benchmark-browser.cjs` | 55개 검사, 저장 실패·재시도·검색·즐겨찾기·달력·백업 합치기·이전 저장소 격리 |
| `node tests/persistence-browser.cjs` | 초안·실제 기록 복원, 충돌·손상·저장 차단, 긴 원문·터치/스크롤 회귀 |
| `node tests/compatibility-browser.cjs` | 이전 기록·초안·모드·테마와 즐겨찾기 보존 |
| `node tests/record-ui.cjs` | 저장 실패·재시도, 확대 읽기·초점, 월간 기본/선택 유지, 긴 글·PNG |
| `node tests/card-effects.cjs` | 18개 팔레트, PC/터치 효과, 키보드, 움직임 설정·토글 초점·이전 값 보존 |
| `node tests/taxonomy-browser.cjs` | 감정 9유형·27슬롯·중립 표식·PNG·반응형 분포 |
| `node tests/simplification.cjs` | 108개 테마/화면 크기 조합, 카드 공통 비율·기본 3동작·취소 동작 |
| `node tests/design-preview.cjs` | 디자인 검토 페이지 18개 팔레트·3개 너비·링크·오프라인 |
| `node tools/build-tokens.mjs --check` | 생성 토큰 일치 |
| `node tools/build-design-preview.mjs --check` | 공식 생성 결과 일치 |

증거는 검사 출력에 표시된 임시 디렉터리에 저장합니다. 기존 비교 보고서는 덮어쓰지 않습니다. LAN HTTP 전용 검사는 이번에 실행하지 않았습니다. 실제 모바일 기기·키보드·Safari·Firefox는 별도 수동 확인이 필요합니다.

## 2026-11-10 모바일 카드 효과·단일 토글 검증

Windows / Node / 로컬 Chrome headless와 기존 Playwright로 실행했습니다. 아래 명령은 저장소 루트 기준입니다.

| 명령 | 결과 |
|---|---|
| `node frontend/tools/build.mjs` | 모듈 소스로 단독 HTML·토큰 재생성 성공 |
| `node --test --test-reporter=dot frontend/tests/*.test.cjs` | 단위 테스트 54개 통과 |
| `node frontend/tests/card-effects.cjs` | 12개 팔레트, 터치 즉시 빛·기울기, 드래그 후 탭, 키보드, 320px·375px 배치, 토글·초점·저장값 전환·다중 탭 동기화 통과 |
| `node frontend/tests/persistence-browser.cjs` | 저장 회귀 검사, 긴 누르기 뒤집힘 방지, 취소 후 초기화, 본문 선택 유지·실제 터치 스크롤 통과 |
| `node frontend/tests/browser.cjs` | 화면 검사 46개, PNG 1080×1620, 오류·외부 요청 없음 |
| `node frontend/tests/themes.cjs` | 6개 테마·12개 팔레트/PNG·5개 화면 크기 및 설정 저장·차단 검사 통과 |
| `node frontend/tools/build-tokens.mjs --check` | 생성 토큰 일치 |
| `$env:CARDEX_TEST_URL='http://localhost:8000'; node frontend/tests/card-effects.cjs` | 실행 중인 Nginx 컨테이너에서도 카드 효과·단일 토글 전체 검사 통과 |

카드 그림이 기울어지는 동안 카드 앞·뒷면이 터치를 계속 받도록 포인터 캡처를 적용했습니다. 기본값은 켜짐이며 기존 `on/off`는 유지하고 `auto`·누락·손상된 저장값은 켜짐으로 해석합니다. 켜짐은 OS 움직임 줄이기보다 우선합니다. 검증에는 합성 예시만 사용했으며, 실제 모바일 기기와 Safari·Firefox는 별도 수동 확인이 필요합니다.

## 명령 (frontend에서)

```powershell
node tools/build.mjs
node tools/build-tokens.mjs --check
node tools/build-wireframes.mjs
node tools/build-design-preview.mjs
node tools/build-design-preview.mjs --check
node --test tests/*.test.cjs
node tests/browser.cjs
node tests/themes.cjs
node tests/card-effects.cjs
node tests/wireframes.cjs
node tests/design-preview.cjs
```

브라우저 검사는 기존 CARDEX_PLAYWRIGHT·CARDEX_CHROMIUM 설정을 사용합니다. 결과와 실행 환경은 아래에 기록합니다.

## 인수 기준

- 토큰 누락·순환·잘못된 값·테마 모드 누락은 생성 전에 실패합니다.
- 화면 ID 중복·없는 이동 대상·지원하지 않는 프레임 크기는 실패합니다.
- 기존 도메인 경계값·동률·버전·예시 분리 검사를 유지합니다.
- 6테마×2모드, 시스템 전환·잘못된 설정·저장 차단, 대표 크기의 넘침을 검사합니다.
- 카드 효과 검사는 12개 팔레트에서 모서리·그림자·빛·전환 설정의 동일성, PC 기울기·모바일 터치·드래그, 키보드 뒤집기, 동작 줄이기와 320px·375px 배치를 확인합니다.
- PNG 1080×1620·원문 미포함·테마 반영을 확인합니다.
- 검토 페이지는 합성 데이터·실제 토큰·기존 컴포넌트 스타일을 사용하고 외부 요청 없이 열립니다.

## 수동 체크 (미검증)

1366×768, 1440×900, 390×844, 360×640, 320×568에서 읽기·조작·내부 스크롤을 확인합니다. 키보드 초점·한국어 스크린리더·200% 확대·실기기 키보드·Safari/Firefox·카드 안전 영역은 자동 검사와 별도로 기록합니다.

## 결과 기록

실행일 / OS / Node·브라우저 버전 / 명령 / 통과·실패·미실행 / 증거 위치 / 한계를 남깁니다. 기존 previews·browser-results.json은 과거 증거로 유지합니다.

## 초기 세팅 실행 결과 (2026-11-04)

환경: Windows, Node v22.16.0, 로컬 Chrome headless, 기존 임시 폴더의 Playwright. Chrome 156.0.8078.80.

| 명령 | 결과 |
|---|---|
| node tools/build.mjs | 단독 HTML 재생성 통과 |
| node tools/build-tokens.mjs --check | 토큰 생성물 일치 |
| node tools/build-wireframes.mjs | 기존 52개 SVG 재생성 |
| node tools/build-design-preview.mjs / --check | 생성·일치 검사 통과 |
| node --test tests/*.test.cjs | 43개 통과 |
| node tests/browser.cjs | 40개 검사, PNG 1080×1620, 오류·외부 요청 없음 |
| node tests/themes.cjs | 5테마·10팔레트/PNG·5크기·시스템·초안·설정 유지·복구·차단·오프라인 통과 |
| node tests/wireframes.cjs | 52 SVG·내비게이션·3크기 통과 |
| node tests/design-preview.cjs | 10팔레트×3너비·링크·오프라인 통과 |

검토 페이지의 390px 전체 캡처를 시각 확인했습니다. 증거는 `%TEMP%/aibootcamp-design-setup/preview-390.png`, `preview-1366.png`입니다. 임시 파일은 Git 배포 자산이 아니며 환경 정리 시 사라질 수 있습니다. 수동 접근성·실기기 항목은 계속 미검증입니다.


## Lemon·Flip·영구 저장 통합 결과 (2026-11-09)

Windows / Node v22.16.0 / 로컬 Chrome headless와 기존 Playwright로 실행했습니다. 아래 명령은 저장소 루트 기준입니다.

| 명령 | 결과 |
|---|---|
| `node frontend/tools/build.mjs` | 단일 HTML 재생성, 약 12.3 MB. 글꼴·PNG 9종 내장 |
| `node --test frontend/tests/*.test.cjs` | 49개 통과. 저장 데이터 검증·복원 대기·저장 세대·실패 후 복구 포함 |
| `node frontend/tests/browser.cjs` | 44개 레이아웃 검사, 작성·카드·도감·통계, PNG 1080×1620, 오류·외부 요청 없음 |
| `node frontend/tests/persistence-browser.cjs` | 초안·기록·방식 복원, 수정·삭제·전체 삭제, 쓰기 실패 재시도, 다중 탭 충돌, 손상 데이터 보존, 저장소 차단 통과 |
| 같은 영구 저장 검사 | 긴 기록 대화상자·HTML 문자 안전 처리·Esc 초점 복귀, 터치 탭·즉시 빛/기울기·드래그·길게 누르기·스크롤·효과 토글, 10감정 자산·단계·확률 통과 |
| `node frontend/tests/themes.cjs` | 6테마·12팔레트/PNG·5화면 크기, 본문 대비, 시스템 모드, 기존 선택 유지·기본값 복구·차단·오프라인 통과 |
| `node frontend/tools/build-tokens.mjs --check` | 생성 토큰 일치 |
| `node frontend/tools/build-design-preview.mjs --check` | 디자인 검토 산출물 일치 |
| `node frontend/tests/design-preview.cjs` | 12팔레트 × 3너비, 링크·오프라인 통과 |
| `node frontend/tests/wireframes.cjs` | 52 SVG, 화면 연결·3너비 통과 |

작성 화면의 320px 캡처와 Lemon 3D 카드의 390px 캡처를 시각 확인했습니다. 테스트 증거는 `%TEMP%/moment-write-320.png`, `moment-write-1440.png`, `moment-lemon-mobile.png`입니다. 임시 증거는 Git에 포함하지 않습니다.

터치 검증은 Chrome의 모바일·터치 에뮬레이션과 CDP 입력으로 수행했습니다. 물리적 모바일 기기·화면 키보드·한국어 스크린리더·Safari/Firefox는 미검증입니다. 실제 분석 API와 기기 간 동기화는 제공하지 않습니다.


## 카드 프레임·조작 단순화 (2026-11-09)

카드 앞면·뒷면·빛·클릭 영역은 공통 2:3 프레임(최대 360×540px)을 사용합니다. 효과 여백 16px을 제외한 가용 크기에 맞춰 축소하며 안내는 프레임 밖에 둡니다. 테마는 색상과 재질을 바꾸며 카드의 기하와 동작은 유지합니다.

카드에는 이미지 저장과 더보기만 기본 노출합니다. 더보기에서 확대 읽기·수정·도감·삭제에 접근합니다. 대기·실패 카드는 다운로드를 제공하지 않습니다. 서비스명은 작성 화면 복귀 버튼입니다. 작성 더보기에서 초안을 지우며 저장 재시도는 저장 실패 시 노출합니다. 삭제는 취소가 기본 초점인 확인 대화상자를 거칩니다. 수정 취소는 원문을 유지합니다.

설정의 기록 방식·예시 모드·데이터 관리는 접이식 항목이며, 예시 전환은 스위치입니다. 통계 종류는 선택 상자, 월은 월 입력으로 조작합니다. 발견한 도감 슬롯은 연결 기록으로 바로 이동합니다. 키보드·터치·Esc·초점 복귀를 검증하며 PNG와 저장 데이터 형식은 유지합니다.


검증 명령(저장소 루트): `node frontend/tests/simplification.cjs`. 6테마×2모드×6화면 크기의 카드·빛·뒷면 좌표 및 테마 간 크기 오차 1px 이하, 더보기 Esc, 삭제 취소 기본 초점, 수정 취소, 정상 저장 시 재시도 숨김을 검사합니다. 대표 화면은 임시 폴더의 moment-simple-mobile.png와 moment-simple-desktop.png로 확인합니다. 모바일 실기기·한국어 스크린리더·Safari/Firefox는 미검증입니다.

## 기록 중심 UI 검증 (2026-11-09)

단위 테스트 49개, 브라우저 46개 검사, 6테마·12팔레트, 저장 회귀, 카드 효과, 72개 배치 조합, 52개 SVG, 검토 페이지 검사를 통과했습니다. `node tests/record-ui.cjs`는 저장 실패 시 성공 안내 금지·재시도·읽기와 초점 복귀·월간 기록 기본값·10,000자 읽기·PNG를 검증합니다. [변경 전후와 실행 명령](../../reports/record-ui-2026-11-09/README.md)을 참고하세요.

기본 Chrome 경로 대신 기존 Playwright Chromium을 사용했습니다. CSS로 확대된 읽기 대화상자는 검증했으나 브라우저 전체 200% 확대·실제 모바일 키보드·스크린리더·Safari/Firefox는 미검증입니다.

## 3+10 회귀 검증

`node tests/taxonomy-browser.cjs`로 27슬롯·9종 명칭·중립 3종 표식·키보드 선택·모바일 분포·PNG를 검증합니다. Node 단위 테스트는 30/60/90% 경계, 구형 6/7종 결과, 이전 3plus10(10키) 결과 거부, 9키 합계 허용 오차, 잘못된 분류 버전, 잘린 결과, 중립 합산과 도감 재잠금을 포함합니다. 실제 모델 성능과 카드 발급 비율 검증은 API 연동 후 수행합니다.

## 3+10 구현 검증 결과 (2026-11-10)

아래 명령은 `frontend/`에서 실행했습니다. 기본 Chrome 실행 파일이 없어 설치된 Chromium을 명시했습니다. 기록 UI 증거의 기존 저장 경로는 쓰기가 거부되어 임시 디렉터리를 사용했습니다.

```powershell
$env:CARDEX_CHROMIUM = "$env:LOCALAPPDATA/ms-playwright/chromium-1148/chrome-win/chrome.exe"
$env:CARDEX_EVIDENCE = $env:TEMP
```

| 명령 | 결과 |
|---|---|
| `node tools/build.mjs` | 단독 HTML·토큰 생성 성공 |
| `node tools/build-wireframes.mjs` | SVG 52개·검토 HTML 생성 성공 |
| `node tools/build-design-preview.mjs` | 디자인 검토 페이지 생성 성공 |
| `node --test --test-reporter=dot tests/*.test.cjs` | 54개 통과 |
| `node tests/browser.cjs` | 기본 화면 검사 46개, PNG, 오프라인 요청 검사 통과 |
| `node tests/taxonomy-browser.cjs` | 10종·30슬롯·중립 4종 PNG·키보드·모바일 분포·12개 테마/밝기 조합 통과 |
| `node tests/themes.cjs` | 6개 테마·12개 팔레트/PNG·5개 화면 크기 통과 |
| `node tests/simplification.cjs` | 72개 테마/화면 크기 조합과 동작 통과 |
| `node tests/persistence-browser.cjs` | 저장·복원·재시도·삭제·충돌·10종 자산·3단계 통과 |
| `node tests/card-effects.cjs` | 12개 팔레트·데스크톱/터치 효과·키보드·동작 축소 통과 |
| `node tests/record-ui.cjs` | 기록 읽기·저장 실패/재시도·긴 원문·PNG 통과 |
| `node tests/wireframes.cjs` | SVG 52개·이동·1366/390/320px 통과 |
| `node tests/design-preview.cjs` | 12개 팔레트 × 3개 너비·오프라인·링크 통과 |

320px 분포 화면과 중립 카드 PNG를 이미지로 확인했습니다. 실제 모델 추론, Safari·Firefox 및 실기기 키보드는 이번 자동 검증에 포함하지 않았습니다. 저장소 스키마나 실제 분석 연결은 변경하지 않았습니다.

- 카드 효과 설정: 기본 켜짐을 확인하고 버튼 하나로 켜짐↔꺼짐을 반복 전환합니다. OS 움직임 줄이기 상태에서도 켜짐이면 빛·기울기·뒤집기 애니메이션이 작동하고 꺼짐이면 즉시 뒤집기만 동작해야 합니다. 모바일에서는 본문 밖 터치 즉시 반응·드래그·해제·취소를 확인하고 본문 스크롤·선택을 검증합니다. 자동 검사는 `node tests/card-effects.cjs`입니다.


## 메인 기능 통합 (2026-11-11)

기능 검사: node tests/benchmark-browser.cjs (검색·한글 입력·즐겨찾기·JSON·반응형), node tests/compatibility-browser.cjs (기존 메인 기록·초안·기록 방식·테마 호환성). 저장·테마·감정 분류는 기존 persistence-browser.cjs·themes.cjs·taxonomy-browser.cjs로 회귀 검사합니다.

LAN HTTP에서는 메인 정적 서버 주소를 MOMENT_LAN_URL로 지정하고 node tests/mobile-lan.cjs를 실행합니다. 실제 사용자 저장소 대신 임시 브라우저의 합성 기록을 사용합니다. [통합 검증 결과](../../reports/frontend-integration/README.md)를 참고하세요. 실제 iOS Safari·소프트 키보드는 별도 확인이 필요합니다.

## 카드 효과 회귀 수정 (2026-11-11)

시안 통합 시 추가된 OS 움직임 줄이기 강제 차단을 제거했습니다. 앱의 켜짐/꺼짐 선택이 우선합니다. 수정 전 reduced-motion에서 카드 효과 전용 검사 실패를 확인했고, 수정 후 현재 Docker 주소에서 통과했습니다.

검증: CARDEX_TEST_URL=http://localhost:8080으로 node tests/card-effects.cjs 실행. 6테마 × 밝음/어두움 × OS 두 상태 × PC/터치에서 켜짐/꺼짐, 제스처, 설정 복원·동기화 검증 통과. 단위 검사 62개, persistence-browser.cjs, themes.cjs 통과. HTTP 응답과 메인 생성물 일치 확인.


## 2026-11-14 테마 독립 선택·모바일 작성 수정

라이트·다크는 18개 개별 선택 항목이며 전체/라이트/다크 분류에서 고릅니다. OS 밝기 연동은 제거했습니다. 이전 system 값은 같은 테마의 light로 변환합니다. 로고로 메인에 복귀하며 초안을 유지합니다. 모바일 작성은 최근 1편과 카드 상태를 한 화면에 표시하고 긴 원문은 입력창 안에서 스크롤합니다. 공통 패널 반경은 28px, 입력창은 18px입니다. 이전 절의 시스템 모드와 모바일 최근 3편 명세는 이 절로 대체합니다.


## 테마 직접 선택 및 모바일 UX 보정

테마 카드 전체가 미리보기 버튼이며 별도 사용 버튼은 없습니다. 미리보기에서 적용을 확정하고 취소 시 분류·스크롤·초점을 유지합니다. 적용 중인 항목은 테두리와 체크, 현재 테마 안내로 표시합니다. 이미 적용 중인 항목의 재적용은 비활성화합니다. 분류는 동일 너비·줄바꿈 없는 최소 44px 영역입니다.

모바일 도움말과 긴 오류 원인은 안내 대화상자로 표시합니다. 저장 실패 시 기존 주요 버튼이 재시도로 바뀌고 처리 중 중복 클릭을 막습니다. 예시 모드는 작성 상단에서 항상 구분합니다. 데이터·테마 저장 키와 API는 변경하지 않습니다.

카드 공개·공유 검사(2026-11-19): `node frontend/tests/share-reveal.cjs`. 실제 기록의 분석 대기 카드(공유 없음, "감정 직접 선택 없음"), 저장 직후 봉인 카드와 탭 공개, 예시 3단계 카드의 1회 공개 연출(봉인·연출 중 `.flip-scene` 위치·크기 불변, 재렌더 시 재생 안 함, 2026-11-20 탭 방식으로 갱신), 정보 패널 문구·칩, 공유 형식 3종·초점 유지, 한 문장(최대 40자) 넣기·빼기, 미리보기와 PNG에 일기 본문 미포함, PNG 1080×1350, 도감 상세에서 공유 후 도감 복귀, 카드 효과 끔 시 연출 생략, 390·320 폭 가로 넘침 없음을 검증합니다.

카드 획득 연출·등급 이펙트 검사(2026-11-20): `node frontend/tests/card-grade.cjs`.
- 빈 입력 저장은 기록 화면에 머뭅니다.
- 저장하면 카드 화면에 봉인 카드가 나오고 초점을 받습니다. 이때 정보 패널과 실제 카드는 숨겨져 있고 `inert`이며, 봉인 카드와 실제 카드의 크기가 같습니다.
- 누르기 전에 다시 렌더되어도 봉인이 유지됩니다.
- Enter로 공개하면 pending 이펙트가 나옵니다(입자 6, 플래시 없음). 연출 중과 연출 뒤 `.flip-scene` 위치·크기가 같고, 끝나면 `#card-info-title`이 초점을 받으며 카드 뒷면은 `inert`를 유지합니다.
- 카드를 뒤집으면 `.grade-pulse`가 붙습니다.
- (2026-11-21) `.grade-aura`는 `.flip-inner` 안에 있어 카드를 기울여도 후광 상자가 카드 앞면 상자와 함께 움직입니다. 390px에서 상태 칩이 카드와 겹치지 않고, 연출 중에는 "새 카드" 배지가 뜨지 않다가 결과 화면에서 뜹니다.
- 다시 열면 봉인되지 않고, 다시 저장하면(새 버전) 한 번 더 봉인됩니다.
- 예시 3단계는 입자 22와 `.grade-flash`, 1단계는 입자 10에 플래시가 없습니다.
- 도감 슬롯(잠긴 칸 제외), 상세 창, 공유 프레임, 배지, 목록 썸네일, 오늘의 카드에 `data-grade`가 붙습니다.
- 390폭에서 봉인 중 가로 넘침이 없습니다.
- 봉인 안내 `.seal-hint`(범례 4칸)는 데스크톱에서 카드 오른쪽, 390폭에서 카드 아래에 있고 공개 후 사라집니다. 실제 기록에만 분석 대기 안내가 붙습니다.
- 홈 화면에는 `.today-card`("오늘의 카드가 도착했어요")가 없습니다. 저장 성공·실패 표시는 편집기의 "저장 실패 · 원문은 유지돼요"와 "저장 재시도"로 확인합니다(`record-ui`·`benchmark-browser`).

저장 실패(IndexedDB 오류·차단)일 때는 카드 화면으로 가지 않고 기록 화면에서 오류와 재시도를 유지합니다(`record-ui`·`ux`·`benchmark-browser`·`persistence-browser`). 수동 확인 필요: 실기기에서 3단계 플래시의 밝기·눈부심, 저사양 기기의 연출 끊김, 화면 낭독기에서 봉인 → 공개 안내 흐름.

레이아웃 스테이지 검사(2026-11-19): `node frontend/tests/layout-stage.cjs`. 1280×720·1920×1080·2560×1440은 스테이지가 화면을 가득 채우고 1440 기준 배율(1·1.333·1.778), 1440×900·1366×768·1024×768은 폭 100%·배율 1, 2560×1080·3440×1440은 16:9 중앙 정렬과 양쪽 장식 레일, 1700×900은 레일 없음, 320~768 모바일은 가로 넘침 없음·하단 탭바가 화면 안·저장 버튼 표시를 검증합니다.

UX 리뷰 반영 회귀 검사(2026-11-16): `node frontend/tests/ux-review.cjs`. 1366×900·320×568에서 "통계" 탭명, 정렬 토글·초점 유지, 오래된 순 정렬, 하루 1편 날짜의 바로 상세, 저장 토스트, 분석 대기 기록이 감정 필터에 걸리지 않는지, 필터 초기화를 검증합니다.

회귀 검사: `node frontend/tests/ux.cjs`(루트 기준). 320×568~390×844에서 버튼 겹침·페이지 넘침, 도움말 표시, 오류 상세·재시도·원문 보존, 예시 표식, 카드 직접 클릭·필터·적용·취소·키보드 초점을 검증합니다.

## 설정 단순화·통계 배치 검증 (2026-11-19)

단위 76개, `build-tokens --check`, `build-design-preview --check`(theme.js 변경으로 검토 페이지 재생성), 브라우저 20종(`browser`·`taxonomy-browser`·`persistence-browser`·`card-effects`·`ux-review`·`themes`·`record-ui`·`simplification`·`home-view`·`benchmark-browser`·`ux`·`ux-p0`·`ux-general`·`ux-retro`·`ux-writing`·`design-preview`·`wireframes`·`compatibility-browser`·`layout-stage`·`share-reveal`)을 통과했습니다.

- 공용 도우미 `tests/browser-runtime.cjs`의 `reveal()`은 CSS로 숨겨진 패널의 같은 `data-action`이 있어도 보이는 버튼을 먼저 고릅니다.
- `benchmark-browser.cjs`는 백업 가져오기 대신 IndexedDB에 예시 기록을 직접 넣어 검색·즐겨찾기·달력을 검사합니다.
- 수동 확인 필요: 실기기 모바일에서 통계 버튼 전환과 기록 화면 달력 숨김, OS 움직임 줄이기 사용자의 카드 효과 체감.

## 기록 화면 소프트 UI v1.1 검증 (2026-11-20, P3)

단위 82개(`streakDays`·`weekLabel` 추가), `build-tokens --check`, `build-design-preview --check`(`soft.css` 미니카드 모서리 변경으로 검토 페이지 재생성), 브라우저 24종을 통과했습니다. `mobile-lan.cjs`는 `MOMENT_LAN_URL`이 필요해 실행하지 않았습니다.

- `node frontend/tests/week-calendar.cjs`(1440×900·390×844): 주간 7칸·미래 칸 비활성·오늘 표시, 저장 후 잠긴 미니카드·`1일 연속`, 주 이동 초점, 월간 칸 수·요약 행·미래 달 차단, 카드 모달(분석 대기 공유 없음·기록한 날 이동·Escape 후 초점 복귀·모바일 바텀시트), 예시 모드 공유·도감 이동, 기록 원문 이스케이프.
- `benchmark-browser.cjs`: 저장 실패 시 "저장했어요" 토스트가 없고 실패 바·안내가 보이는지 확인합니다.
- 홈 화면의 `.today-card`는 이제 오늘의 카드 패널 안의 미니카드 버튼입니다("오늘의 카드가 도착했어요" 문구는 계속 없음).
- 수동 확인 필요: 실기기에서 월간 미니카드(약 55px) 가독성, 바텀시트 스크롤과 키보드, 화면 낭독기에서 칸 이름표·모달 이동 안내.

## 주간 스트립·주별/일별 달력 검증 (2026-11-19)

단위 78개(주 시작·월말·연말·윤일·잘못된 날짜·미래 주 차단 추가), `build-tokens --check`, `build-design-preview --check`(`flip.css` 변경으로 검토 페이지 재생성), 브라우저 21종(위 20종 + `week-calendar`)을 통과했습니다. `mobile-lan.cjs`는 `MOMENT_LAN_URL`이 필요해 실행하지 않았습니다.

- `node frontend/tests/week-calendar.cjs`: 스트립 7칸·✓ 개수 변화·미래 칸 비활성·기록한 날 열기, 주별 7행·첫 줄 말줄임·HTML 이스케이프·주 이동 초점, 일별 미리보기, 통계에 `#stats-month`·`#stats-date`가 없고 ‹ › 분석일 이동이 되는지 확인합니다.
- 수동 확인 필요: 실기기 모바일에서 일별 칸 2줄 미리보기 가독성, 긴 영문 한 단어 첫 줄의 말줄임.

## 통계 그래프 우선 배치·화살표 정렬 검증 (2026-11-19)

단위 78개, `build-tokens --check`, `build-design-preview --check`, 브라우저 22종(신규 `stats-layout` 포함, `mobile-lan` 제외)을 확인했습니다.

- `node frontend/tests/stats-layout.cjs`가 검사하는 항목:
  - 배너와 중복 요약이 없음
  - 데스크톱 그래프가 첫 화면 안에 있고 추이 폭이 분포의 1.6배 이상
  - 모바일 기본 탭이 추이이고 그래프 높이 180px 이상
  - x축이 오늘에서 끝남
  - 강조 토글(`aria-pressed`, 흐림, 해제, 초점 유지)
  - 모든 `.nav-arrow` 꺾쇠가 중앙에서 ±1.5px 이내
- `ux.cjs`는 전체 일괄 실행 때 테마 적용 단계(`blossom`/`forest`)에서 가끔 실패했습니다. 단독으로는 10회 연속 통과했고, 이번 변경은 테마 코드를 건드리지 않았습니다(타이밍 불안정으로 기록).

## 소프트 UI v1.1 P4~P8 검증 (2026-11-20)

단계마다 빌드 후 단위·브라우저 전체를 실행했습니다. 최종: 단위 94개, `build-tokens --check`·`build-design-preview --check` OK, 브라우저 스크립트 26종 통과(`mobile-lan.cjs`는 `MOMENT_LAN_URL`이 필요해 제외). 이전 기록의 PNG 1080×1620·2:3 프레임·공유 본문 미포함·봉인 카드 탭 공개는 이 단계들에서 바뀌었습니다(카드 5:7 1080×1512, 첫 문장 인용, 자동 연출).

- P4 카드 획득: `card-grade.cjs`(분석 대기 패널, 단계 순서 charge → rise → burst, 탭 무시, 건너뛰기 없음, 입자 수·3단계 플래시), `share-reveal.cjs`·`record-ui.cjs`·`ux-p0.cjs`·`ux-review.cjs` 갱신. 도우미 `unseal()`은 탭하지 않고 최대 9초 기다립니다.
- P5 도감: 신규 `collection.cjs`(첫 실행 27칸 잠김, 탭 개수·필터, 6열, 번호, 상세 성장 칸·바텀시트, 320폭 넘침 없음).
- P6 통계: `stats-layout.cjs` 재작성(빈 달, pill, 비율 합 100%, 단일 계열·평균선·오늘 말풍선, 점 수, 분포 정렬, 달력, 요일 순서, 데스크톱 배치), `statistics.test.cjs`에 경계값 4개.
- P7 프로필: 신규 `profile.cjs`, `profile.test.cjs`(닉네임 코드 포인트·막힌 저장소·연말·윤일). 2026-11-20 후속: 기록 내보내기 제거, 아바타 사람 아이콘(`profile.cjs`에서 확인).
- P8 공유: `share-reveal.cjs`(첫 문장만, 옵션 4개, PNG 1080×1350, 스토리 1080×1920, 링크 복사 성공·실패), `share-core.test.cjs`.
- 수동 확인 필요: 실기기 모바일(바텀시트 스크롤·키보드), Safari·Firefox, Web Share 파일 공유로 인스타그램 스토리 올리기, 클립보드 권한 거부 흐름, 화면 낭독기에서 자동 연출·카드 모달 안내, 테마 10종 대비.

## Figma v1.1 2차 반영 검증 (2026-11-21, F1~F8)

화면 규칙은 [UI_SPEC](UI_SPEC.md)의 "Figma v1.1 2차 반영" 절에 있습니다. 단계마다 `node tools/build.mjs`로 빌드한 뒤, 단위 테스트(94개)와 그 단계에 관련된 브라우저 스크립트를 하나씩 실행했습니다. 전체 스크립트를 한 번에 돌리는 일괄 실행은 이번에 하지 않았습니다. 데스크톱(1440×900)·모바일(390×844) 스크린샷을 Figma 프레임과 비교했습니다.

- F1~F2 셸·기록 화면: `layout-stage`·`week-calendar`·`ux-review`·`browser`·`persistence-browser`(저장 실패 바)·`home-view`.
- F3 카드 공개: `card-grade`(대기 문구는 무대 아래, 진행 칩은 모서리, 범례 `aria-label`, `.draw-caption` 퍼센트)·`share-reveal`·`record-ui`·`simplification`(card-info 동작 `card-catalog`·`share`·`card-more`)·`moment-card`·`card-effects`·`benchmark-browser`.
- F4 도감: `collection`(첫 실행 `inert` 그리드, 캡션 없음, 확률 기준 문구, 모바일 전체 페이지 상세)·`taxonomy-browser`.
- F5 통계: `stats-layout`(정수 비율 합 ±1.5, 대표 카드 단계, 세로 요일 막대, 한 패널), `ux-retro`.
- F6 공유: `share-reveal`(확률 기본 숨김 → 끄면 "최고 확률 95%"), `card-grade`·`browser`·`simplification`·`themes`·`ux-p0`.
- F7 프로필: `profile`(설정 패널 1개, 카드 240px, 선택 메뉴 1개, 모바일 한 줄 카드·가로 테마)·`themes`·`home-view`·`ux`·`persistence-browser`·`layout-stage`.
- F8 테마: `themes`(모눈 라벨·형광펜, 티룸 점선 테두리, 상단 바 링 없음)·`home-view`·`week-calendar`·`ux-writing`·`design-preview`·`wireframes`, `build-tokens --check`·`build-design-preview --check` OK. 디자인 검토 페이지는 F1 이후 오래된 상태였어서 F8에서 다시 생성했습니다.
- F9 마무리: `ux-review`·`collection`·`stats-layout` 재실행 통과.
- 실행하지 않음: `mobile-lan.cjs`(`MOMENT_LAN_URL` 필요).
- 수동 확인 필요: 실기기 모바일(바텀시트, 가로 테마 스크롤, 키보드), Safari·Firefox(점선 `outline`이 둥근 모서리를 따라가는지, `backdrop-filter`), 화면 낭독기(도감 슬롯 `aria-label`, 프로필 메뉴 `aria-current`, 공유 뒤로 링크), 티룸·나이트 대비.

카드 획득 팝업 검사(2026-11-21): `node frontend/tests/celebrate-popup.cjs`. `simplification.cjs`·`record-ui.cjs`·`taxonomy-browser.cjs`는 시연 모드 스위치가 `details` 밖(프로필 화면)으로 옮겨진 뒤 `closest('details').open` 단계에서 실패하던 것을 `reveal(page,'preview')`로 바꿔 고쳤습니다(2026-11-21).

## 모바일 입력·홈 이동 호환성 검증 (2026-11-23)

기존 생성 HTML에서 새 `mobile-input.cjs`의 첫 입력 초점 검사가 실패하는 것을 확인한 뒤 공식 빌드로 재생성했습니다. 기존 높이 비율 감지는 시각 뷰포트만 줄어들 때는 작동하지만, 두 높이가 함께 줄거나 키보드가 화면을 덮어 높이가 유지되는 모의 환경에서는 메뉴가 남았습니다. 이는 S23 Ultra 실기기 원인 확정을 의미하지 않습니다.

`frontend/`에서 다음 검사를 통과했습니다.

| 명령 | 결과 |
| --- | --- |
| `node tools/build.mjs` | 생성물 백업 후 standalone 빌드 성공 |
| `node --test tests/*.test.cjs` | 100/100 통과 |
| `node tests/mobile-input.cjs` | 입력 초점 정책, 높이 변화 4종·확대·API 미지원, 검색 재렌더링, 프로필 대화상자, 입력 종류·초점 이동·요소 제거, 320~1440px·959/960 경계·가로 화면·복귀, 홈 터치·Enter/Space·초안 보존 통과 |
| `node tests/browser.cjs` | 46개 검사, PNG 1080×1512, JS 오류·외부 요청 없음 |
| `node tests/layout-stage.cjs` | 데스크톱 16:9·모바일 하단 메뉴 배치 통과 |
| `node tests/profile.cjs` | 편집 대화상자·초점 복귀·저장·모바일 배치 통과 |
| `node tests/themes.cjs` | 테마 10종·대비·글꼴·PNG·오프라인 통과 |
| `node tests/ux-review.cjs` | 통과 |

기존 `browser.cjs`는 본문 초점을 해제한 뒤 메뉴 배치를 검사하도록 갱신했습니다. 신규 검사는 원래 `innerHeight` 속성 정의를 보존·복원해 모의 뷰포트가 이후 검사에 남지 않게 합니다. Chromium 모바일 스크린샷에서 입력 초점 중 메뉴 숨김과 홈 복귀 후 메뉴 복구를 확인했습니다. 증거는 검사 출력의 임시 폴더에 저장하며 개인 기록은 사용하지 않습니다.

### 실기기 확인표 — 수정 빌드에서는 미검증

| 기기·브라우저 | 사용자 제공 기존 상태 | 수정 빌드 상태 |
| --- | --- | --- |
| S23 Ultra · 삼성 인터넷 | 입력 중 하단 메뉴 표시 문제 | 실기기 미검증 |
| S24 · 브라우저 이름 미제공 | 후속 제보: `6281159` 적용 후 키보드를 닫으면 메뉴가 남아 숨겨짐 | 실기기 미검증 |
| iPhone 17 Pro · 정상 확인한 브라우저(이름 미제공) | 정상 동작 | 실기기 미검증 |

세 기기에서 동일한 빌드와 합성 기록으로 다음을 확인하고 OS(Android·One UI 또는 iOS), 브라우저·키보드 버전을 함께 기록합니다. Chromium 화면 크기 검사는 물리적 삼성 인터넷·iOS 키보드 검사와 구분합니다.

1. 본문·검색·닉네임 입력에 초점을 주면 하단 메뉴가 숨겨지고 입력·커서·스크롤이 유지되는지 확인합니다. 입력란 간 이동 시 메뉴가 깜빡이지 않아야 합니다.
2. 뒤로 가기/완료로 키보드를 닫으면 초점이 남아도 메뉴가 복구돼야 합니다. 해당 입력을 다시 터치해 키보드를 열면 재숨김하고, 입력 밖으로 초점을 옮기거나 프로필 편집을 취소해도 복구돼야 합니다.
3. 키보드 열기/닫기, 주소창 접기/펼치기, 확대, 화면 회전과 앱 복귀 뒤 메뉴 위치·안전 영역·가로 넘침을 확인합니다. iPhone에서는 키보드 전환 중 커서·스크롤과 복구 후 하단 안전 영역을 비교합니다.
4. 통계·도감·프로필·기록 상세에서 `moment` 글자 중앙과 버튼 가장자리를 터치합니다. 초안을 유지하며 새로고침 없이 기록 홈으로 이동해야 합니다.
5. S23 Ultra·S24에서 문제가 남으면 동일 배포본인지와 터치 위치의 최상단 요소를 먼저 확인합니다. 정상이라고 제보된 iPhone 17 Pro에서도 키보드 열기/닫기를 반복해 회귀 여부를 확인합니다.

### S24 키보드 닫힘 후 메뉴 복구 — 후속 수정 (2026-11-23)

`6281159`의 초점 기반 숨김은 키보드를 닫은 후 초점이 유지되면 메뉴를 복구하지 않았습니다. 기존 생성 HTML에서 신규 `keyboard-close.cjs`가 같은 상황으로 실패하는 것을 확인한 뒤 수정했습니다. 이제 입력 초점은 열기 전 숨김에 쓰고, 입력 회차별 화면 축소·회복과 지원되는 키보드 크기 이벤트로 닫힘을 구분합니다. 이 후속 수정이 앞선 "초점이 남으면 계속 숨김" 정책을 대체합니다.

- 자동 검사: 공식 빌드, 단위 100/100, `node tests/keyboard-close.cjs`, `node tests/mobile-input.cjs`, `node tests/browser.cjs`(46개), `node tests/layout-stage.cjs`, `node tests/profile.cjs`, `node tests/ux-review.cjs` 통과.
- 새 회귀 사례: 초점 유지 상태의 키보드 닫힘, 시각/양쪽/창 높이만 변화, resize가 focus보다 먼저 도착하는 순서, 닫힘 애니메이션과 주소창 높이 차이, 같은 입력 재터치/커서 이동, 열린 키보드 중 입력 재터치, 복구된 하단 탭 터치, 작은 주소창 변화·확대, 초점 이탈 후 닫힘(iOS 형태), 크기 변화 없는 오버레이 키보드 이벤트, 검색 재렌더링 후 상태 유지·초안·선택 범위 보존.
- 동작 근거: [Chrome의 키보드·뷰포트 처리 설명](https://developer.chrome.com/blog/viewport-resize-behavior), [VisualViewport 배율](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport/scale), [VirtualKeyboard 크기 이벤트](https://developer.mozilla.org/en-US/docs/Web/API/VirtualKeyboard_API). 키보드 위치 설정은 변경하지 않으며 개인정보나 입력 원문을 로깅하지 않습니다.
- 한계: 높이 회복/키보드 크기 이벤트가 모두 없으면 키보드만 닫았는지 판별할 수 없어 초점 기반 폴백을 유지합니다. 물리적 S23 Ultra·S24·iPhone 17 Pro에서는 수정 빌드 미검증이며, 모의 브라우저 검사를 실기기 통과로 간주하지 않습니다.

## 등급 시각화 강화·건너뛰기·움직임 줄이기 검증 (2026-11-24)

- 범위: `styles/grade-effects.css` 등급 사다리(빈 카드 점선 / 1단계 하이라이트·반광 / 2단계 금속 프레임·꺾쇠 / 3단계 홀로그램 링·반짝임·프리즘 반사광), 3단계 고조 점멸 완화, "건너뛰기" 버튼·Esc, `prefers-reduced-motion` 정지 대체 연출(`scripts/share-view.js`).
- 자동 검사: 공식 빌드, 단위 100/100, `card-grade.cjs`(새 사례: 등급별 배경 층 수·점선·sheen 블렌드, 건너뛰기 44px·펑 즉시 진입·Esc 결과·초점·재생 없음, 움직임 줄이기 안내·정지 카드·진행 막대·2.7초 선행 유지·입자/섬광 없음·`rm-glow`·결과 카드 정적 층), `all-card-effects.cjs`(10테마×6폭), `modal-foil`·`collection`·`simplification`·`card-effects`·`celebrate-popup`·`share-reveal`·`gesture-return`·`moment-card`·`week-calendar`·`browser`(46)·`themes`·`ux-review` 통과.
- `persistence-browser.cjs`는 173행(기록 뒷면 본문 터치 스크롤 후 뒤집힘 유지)에서 실패하며, 변경 전 HEAD(65304b3) 빌드에서도 같은 위치에서 실패해 이번 변경과 무관한 기존 문제로 기록합니다.
- 수동 확인 필요: 실기기 OS의 동작 줄이기 설정, 55px 월간 미니카드에서 꺾쇠·반짝임 가독성, 저사양 기기의 3단계 반사광 성능.

## 분석 대기 실사용자 안내 검증 (2026-11-24 묶음 B)

- 범위: 도감 빈 상태 2종(첫 실행·분석 대기)과 제자리 시연 모드 버튼(`preview-catalog`), 통계 분석 대기 배너·요일 라벨, 분석 대기 패널 정지 칩, 공유 "앱 주소 복사"와 안내, 알림 스위치 "준비 중".
- 자동 검사: 공식 빌드, 단위 100/100, 신규 `pending-ux.cjs`(1440·390·320px: 문구·44px 버튼·대기 패널 애니메이션 0개·실제 저장 후 도감 기록 버튼 없음·통계 배너 1개·요일 "분석 대기/기록 없음"·도감에 머무는 시연 전환·시연 통계 배너 없음·공유 안내 연결·준비 중 배지·가로 넘침 없음), `card-grade`·`collection`·`stats-layout`·`stats-motion`·`share-reveal`·`profile`·`celebrate-popup`·`ux-review`·`browser`(46)·`themes`·`simplification`·`home-view` 통과.
- 수동 확인 필요: 스크린리더에서 통계 배너(`role="note"`)와 공유 안내(`aria-describedby`) 낭독.

## 접근성 보완 검증 (2026-11-24 묶음 C)

- 범위: `#app` 밖 고정 라이브 리전(`#announcer`·`#alerter`)과 `speakStatus()`(새 상태만 한 번), `#feedback`·`#save-status` 역할 제거, 저장 직후 `#wait-title` 초점, "도감에 넣기" 상태 문구, 작은 버튼 44px 터치 영역(투명 `::after`), `--muted` 글자, 모바일 요일 긍정 비율 표시, 프로필 메뉴 그룹 초점.
- 자동 검사: 공식 빌드, 단위 100/100, 신규 `a11y-pass.cjs`(1440·390px) 통과, `profile.cjs`는 초점 대상 변경(`about-title` → `settings-about`)에 맞춰 단언 갱신 후 통과. `pending-ux`·`card-grade`·`collection`·`stats-layout`·`stats-motion`·`share-reveal`·`celebrate-popup`·`ux-review`·`browser`(46)·`themes`·`simplification`·`home-view`·`record-ui`·`ux`·`ux-p0`·`ux-general`·`ux-retro`·`ux-writing`·`week-calendar`·`modal-foil`·`gesture-return`·`all-card-effects`·`layout-stage`·`benchmark-browser`(52)·`mobile-input`·`keyboard-close` 통과.
- `profile.cjs`는 한 번 122행(시연 모드 전환 직후 `reveal(page, 'settings')`)에서 시간 초과가 났고, 이후 5회 연속 통과해 카드 획득 팝업 타이밍에 따른 간헐 실패로 기록합니다.
- 수동 확인 필요: NVDA·VoiceOver에서 저장·오류·"도감에 넣기" 낭독이 한 번씩만 나오는지, 실기기 손가락으로 작은 버튼 터치.

## 데이터 안전 검증 (2026-11-24 묶음 D)

- 범위: 저장 버튼 새 기록/수정/"오늘 기록 바꾸기"(`saveKind`·`saveLabel`), 바꾸기 확인창(취소 시 기록·초안 보존), 자정 전환 `rollDate()`(focus·visibilitychange·기록 탭·저장 누름·복원), 모든 기록 삭제·초안 지우기 확인창 문구와 2단계 잔여 코드 제거.
- 자동 검사: 공식 빌드, 단위 100/100, 신규 `data-safety.cjs`(1440·390px, Playwright clock으로 11-24 23:50 → 11-25 → 11-26 → 11-27) 통과. `a11y-pass`·`pending-ux`·`card-grade`·`collection`·`stats-layout`·`stats-motion`·`share-reveal`·`profile`·`celebrate-popup`·`ux-review`·`browser`(46)·`themes`·`simplification`·`home-view`·`record-ui`·`ux`·`ux-p0`·`ux-general`·`ux-retro`·`ux-writing`·`week-calendar`·`modal-foil`·`gesture-return`·`all-card-effects`·`layout-stage`·`benchmark-browser`(52)·`mobile-input`·`keyboard-close`·`compatibility-browser`·`taxonomy-browser`·`moment-card` 통과.
- `card-effects.cjs`: 묶음 B(60d30fc)부터 375px에서 시간 초과. 프로필 알림 설명이 길어져 시연 스위치 위치가 내려갔고, 그 스크롤이 카드 화면까지 이어져 포인터 지점(카드 위 30%)이 화면 위로 벗어난 것이 원인입니다(앱 동작 오류 아님, e103717 빌드는 통과). 측정 전에 카드를 화면 가운데로 스크롤하도록 테스트를 고쳐 통과했습니다.
- `persistence-browser.cjs`는 기존과 같은 173행에서만 실패합니다(같은 날 재저장·초안 지우기·전체 삭제 단계는 통과).
- 참고(미수정): 화면을 바꿔도 이전 스크롤 위치가 남아 모바일에서 카드 위쪽이 잘린 채 열릴 수 있습니다(묶음 E 후보). → 아래 묶음 E에서 수정.

## 화면 다듬기·남은 문제 검증 (2026-11-24 묶음 E)

- 범위: 화면 전환 시 맨 위 스크롤·화면별 `document.title`, 카드 뒷면에서 끊긴 터치를 탭으로 치지 않기(`flip.js`), 카드 없는 도감·통계의 포일 안내 제거, 확대 스테이지 높이(`--stage-vh`), 저장 오류 바 토큰 색, 모바일 보관 경고, 공유 인용문 공백 줄바꿈·말줄임·닫는 따옴표, "분석 확률 표시", 도감 범례 쉬운 말, "다시 시도"·"도감에서 보기" 문구.
- `persistence-browser.cjs` 173행 실패 원인: 본문 스크롤이 문서 전체 `scroll` 리셋(`DiaryFlipReset`)으로 진행 중 제스처를 지워 pointerup이 무시되고 뒤따른 click이 카드를 뒤집었습니다(앱 수정). 테스트도 이미 끝까지 스크롤된 본문에 200을 넣어 변화가 없던 문제를 0으로 바꿨습니다. 수정 후 4회 연속 통과.
- 자동 검사: 공식 빌드, 단위 100/100, 신규 `polish.cjs`(375px·1920×1080) 통과, 전체 35종 통과(`persistence-browser`·`card-effects` 포함). 첫 전체 실행에서 `card-grade`·`benchmark-browser`가 빈 저장 버튼에 넣은 `aria-disabled`(Playwright가 비활성으로 판단) 때문에 실패해 그 변경을 되돌렸고, `stats-motion`·`all-card-effects`는 단독 재실행에서 통과(간헐).
- 의도적 유지: 완료 바 "카드 보기"(카드 화면)와 오늘 카드 탭(모달 미리보기), "임시 분류" 표기, 빈 저장 버튼의 `aria-disabled` 미적용.
- 수동 확인 필요: 1920×1080 이상 실제 모니터에서 오늘 카드·월간 달력 높이, 실기기에서 카드 뒷면 본문 스크롤 후 손을 뗐을 때 뒤집히지 않는지.
