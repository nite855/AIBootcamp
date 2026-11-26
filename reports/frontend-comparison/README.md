# HW 프론트엔드 비교 분석

이 보고서는 기존 8개 시안의 비교 자료입니다. 현재 메인 프론트는 [frontend/](../../frontend/README.md)이며 비교 대상에 추가하지 않습니다. `inspect.cjs` 재실행 시에도 `audit.json`에 기록된 기존 비교 대상을 사용합니다.

2026-11-03 로컬 소스 및 실제 Chrome 기준. [시각적 보고서](index.html)에서 기능 매트릭스와 데스크톱·모바일 캡처를 확인할 수 있습니다.

## 독립형 HTML

[standalone.html](standalone.html)은 스크린샷 24개, 비교 앱 8개, README·소스·검증 로그 등 링크 대상 74개를 내장한 단일 파일입니다. 이 파일만 복사해 브라우저에서 열면 인터넷이나 별도 폴더 없이 사용할 수 있습니다. 내장 링크는 새 탭에서 열리며 JavaScript를 허용해야 합니다. 앱의 운영 분석 API 미연결 등 기존 제약은 동일합니다. 원본 `index.html`은 유지합니다.

원본 보고서나 연결 파일이 바뀌면 `python reports/frontend-comparison/build_standalone.py`로 다시 생성하세요. 생성 파일은 약 7.7 MiB입니다.

`node reports/frontend-comparison/verify_standalone.cjs`는 기존 검증과 동일한 임시 폴더의 Playwright 및 설치된 Chrome을 사용합니다. 파일 하나만 빈 임시 폴더에 복사하고 오프라인 상태에서 이미지·내장 링크·화면 폭·JavaScript 오류·외부 요청을 검증합니다.

## 비교 요약

| 폴더 | 주요 변화 | 강점 | 한계 | 이번 코드 시험 |
|---|---|---|---|---|
| emotion-cardex | 도감의 기준 버전 | 3→7 감정 탐색과 분석 근거를 단계적으로 확인하기 좋음 | 표시 모드 선택·공유 출력이 없어 후속 버전보다 활용 범위가 좁음 | 18/18 |
| emotion-cardex-v2 | 표시 모드 확장 | 기능 학습 없이 사용자 표시 환경을 선택할 수 있음 | 기본 버전과 복제된 화면·도메인 코드의 동시 관리 필요 | 18/18 |
| emotion-cardex-v3 | 명칭 일관성 정비 | 내부 ID·확률을 유지하면서 표시명 계약을 정리 | 새 화면 설계 버전으로 보기는 어려움; 디자인 계획과 구현 구분 필요 | 22/22 |
| emotion-cardex-v4 | 해석·탐색 UX 개선 | 대표 대분류와 최다 소분류 차이 설명, 차트 방향키/Home/End 탐색 | 화면별 Figma 일치·테마 대비·스크린리더 검증은 추가 필요 | 22/22 |
| tcg-social-studio-v1 | 공유 기능 확장 | 1:1·4:5 출력과 수치 공개 선택, 공개 데이터 허용 목록 | social.js를 app.js에 삽입하는 방식으로 상태 결합이 늘어남 | 20/20 |
| integrated-tcg-2026-11-03 | 분석·카드·공유 통합 | 한 화면에서 분석과 카드·공유를 연결; 파일 읽기 역전 방지 검사 존재 | 정보량과 스크롤 부담이 큼; 상세 기능 전수 E2E는 별도 필요 | 25/25 |
| diary-social-v1 | 일기 입력·분석 확장 | 단일·복수·날짜 없는 기록을 구분하고 분석 불가 사유 안내 | 일기와 대화 도메인이 공존하고 diary 삽입 코드까지 관리해야 함 | 12/12 |
| diary-simple-v1 | 대표 카드 우선 간소화 | 첫 결과 화면의 선택 부담을 줄이고 상세 탐색을 분리 | 단일 HTML만 있어 분리 소스·빌드 경로 부재; 기존 테스트 2개 실패 | 11/13 |

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
