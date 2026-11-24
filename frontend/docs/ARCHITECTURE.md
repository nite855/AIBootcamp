# 프론트 구조와 디자인 연결

`core.js`, `diary-core.js`, `cards.js`, `statistics.js`는 도메인 처리, `app.js`는 상태·화면·카드 출력, `statistics-view.js`·`catalog-view.js`는 뷰입니다. 도메인 판정은 유지합니다. `flip.js`는 카드 제스처·포커스, `storage.js`는 저장 검증과 IndexedDB 트랜잭션, `persistence.js`는 앱의 복원·자동 저장 연결을 담당합니다.

## 빌드

1. tools/build.mjs가 buildTokens를 호출합니다. JSON 참조를 검증하고 CSS·기존 인터페이스용 테마 데이터를 생성합니다.
2. base.css의 @font-face만 추출합니다. diary.css → themes.css → generated/tokens.css → flip.css를 내장합니다. 높은 구체성의 테마 재질 예외는 유지됩니다.
3. generated/theme-tokens.js → theme.js를 첫 화면 표시 전에 실행합니다. 설정 저장·OS 모드·meta theme-color 동작을 유지합니다.
4. 빈 카드용 하트 PNG(2026-11-22부터 카드 캐릭터는 `blob-art.js` SVG)와 persistence.js를 앱에 내장합니다. 뷰·도메인·앱을 템플릿에 넣고 글꼴 라이선스를 내장합니다. 결과는 index.html 하나이며 fetch가 필요 없습니다.

디자인 검토 페이지와 와이어프레임은 별도 생성 명령으로 갱신합니다. 토큰값만 바꿔도 앱·검토 페이지를 모두 재생성해야 합니다. --check 검사로 오래된 토큰·검토 페이지를 발견할 수 있습니다.

## 데이터 경계

실제 기록·초안·기록 방식은 `moment-diary-main` IndexedDB의 `data` 저장소, `state` 키에 저장합니다. 예시는 별도 메모리이며 표시 설정은 기존 localStorage 키를 사용합니다. 기록 ID·버전과 분석을 카드·통계·도감이 공유합니다. 프론트 10감정과 백엔드 6분류는 미연결이며 임의 매핑을 추가하지 않습니다. 디자인 fixtures는 검토 페이지 전용이고 실제 기록에 주입하지 않습니다.


## 저장 인터페이스와 동시성

`DiaryStorage.create(indexedDB)`는 `load()`와 `save(snapshot)`를 제공합니다. schemaVersion 1의 스냅샷은 revision, text, date, sessions, policy, currentEntryId, savedText를 포함합니다. 복원 시 형식·중복 ID·날짜·문자 수·기록 수·연결 ID를 검증하고 실제 기록의 분석은 pending으로 처리합니다. 지원하지 않는 버전이나 손상 데이터는 자동 덮어쓰기를 차단합니다.

저장 요청은 직렬화하고 readwrite 트랜잭션 안에서 revision을 비교합니다. revision은 트랜잭션 완료 후에만 증가하며 충돌 시 현재 탭의 추가 쓰기를 차단합니다. 앱은 변경 세대를 추적해 이전 요청 완료가 새 입력의 미저장 상태를 지우지 못하게 합니다. 전체 삭제는 빈 스냅샷을 새 revision으로 기록하므로 오래 열린 탭도 충돌을 감지합니다.

기본 표시 설정은 lemon/light이며 공개 CardexTheme API와 저장 키는 유지합니다. 메인의 neg_1=불안, neg_2=슬픔, neg_3=분노 계약을 캐릭터·카드·도감·통계가 공유합니다. Flip 시안의 도메인 상수나 저장소는 가져오지 않습니다.

감정 계약은 core.js의 3+10 정의를 공유합니다. validateAnalysis는 분류 버전·잘림·확률을 검증하며 카드와 통계에서 함께 사용합니다. characterSVG는 Figma 블롭(`blob-art.js`, 감정별 `--card-deep-*` 색, 2026-11-22)을 카드·도감·썸네일·PNG에 공통 렌더링합니다. [분석 연동 계약](API_CONTRACT.md)을 참고하세요.


## 메인 기능 통합 (2026-11-11)

메인 빌드는 기존 도메인에 record-id.js를 더하고(backup.js는 2026-11-19 기록 내보내기 제거로 배포하지 않음, 파일·단위 테스트만 유지) persistence.js 뒤에 benchmark.js를 앱 클로저로 내장합니다. 스타일은 benchmark.css 다음에 layout.css(16:9 데스크톱 스테이지·유동 모바일), moment.css, scrapbook.css(Figma v0.3 스크랩북 구조를 모든 테마에 공통 적용, 찢긴 가장자리·화살표 SVG는 빌드가 data URI 마스크로 내장), 마지막에 screens.css(기록·통계·도감·설정·카드·공유 화면 구성) 순서로 적용됩니다. 뷰 스크립트는 home-view → theme-view → statistics-view → catalog-view → celebrate-view → share-view(카드 정보 패널·1회 공개 연출·공유 시트와 1080×1350 PNG) 순서로 앱 클로저에 들어갑니다. 빌드 전 backup-generated.mjs가 기존 HTML·생성 토큰을 루트 .backups에 버전 백업하고 일치를 검증합니다.

저장소와 설정 키는 유지하며 favorite만 선택 필드로 확장합니다(누락=false). JSON 병합은 진행 중인 자동 저장을 정리하고 revision 검사를 거친 단일 트랜잭션 성공 후 화면에 반영합니다. 시안 저장소를 조회하지 않습니다. 외부 API 변경은 없습니다.

## 소프트 UI v1.1 (2026-11-20)

Figma "Prototype · 데스크톱 v1.1"로 전면 개편했습니다. 화면별 규칙은 [UI_SPEC](UI_SPEC.md)의 2026-11-20 절(P3~P8)에 있습니다.

- 도메인: `record-id.js` → `core.js` → `profile.js`(`MomentProfile`: 닉네임·아바타 색·알림 설정, 함께한 일수) → `share-core.js`(`MomentShare`: 공유 인용 첫 문장) → `diary-core.js` → `statistics.js`(`streakDays`·`weekLabel`·`movingAverage`·`monthDelta`·`weekdaySummary`·`weekdayInsight` 추가) → `cards.js` → `storage.js` → `flip.js`. 모두 UMD이며 단위 테스트가 `require`로 불러옵니다.
- 뷰(앱 클로저): `home-view.js`(기록 화면, 카드 달력, 카드 모달) → `statistics-view.js` → `catalog-view.js` → `celebrate-view.js` → `share-view.js`(분석 대기 패널·자동 연출·공유 시트·스토리) → `profile-view.js`. `theme-view.js`는 배포하지 않습니다.
- 스타일: `screens.css` 다음에 `soft.css` → `write.css` → `collection.css` → `stats.css` → `profile.css` → `share.css` → `theme-decor.css` → `grade-effects.css`. `scrapbook.css`는 배포하지 않습니다. 화면 CSS는 예전 `.panel` 규칙(760px 중앙 정렬·전체 열 차지)과 `.slot`·`.entry`·`.stats-summary-card` 같은 예전 선택자를 화면 범위 선택자로 덮어씁니다.
- 카드: `cardSVG(record, { snippet, name })`가 5:7(1080×1512) 카드를 그리고, HTML `miniCard()`가 같은 프레임을 컨테이너 단위로 축소해 기록 목록·달력·도감·통계에 씁니다(프레임 자체의 모서리는 % 단위, 내부는 `cqw`).
- 데이터 경계: 일기 IndexedDB 스냅샷 구조는 바꾸지 않았습니다. 테마는 `CardexTheme` localStorage 키, 프로필·알림은 `moment-card:profile-v1`을 따로 씁니다. 알림은 설정만 저장하고 보내지 않습니다. 기록 내보내기는 2026-11-20에 제거했습니다. 공유 이미지는 본문 첫 문장(최대 40자)만 인용할 수 있습니다.
- 움직임: 카드 획득 연출은 항상 같은 순서·시간으로 진행하며 앱 전체에서 `prefers-reduced-motion`·`data-motion="off"` 분기를 없앴습니다.

## Figma v1.1 2차 반영 (2026-11-21)

파일 구조와 데이터 경계는 그대로 두고, 뷰 마크업과 화면 CSS만 Figma 프레임 값에 맞췄습니다. 상세는 [UI_SPEC](UI_SPEC.md)의 "Figma v1.1 2차 반영" 절에 있습니다.

- 카드 화면(`app.js` `panel()`·`cardArea()`, `share-view.js` `cardInfo`·`sealHint`): `.card-stage` 무대가 카드와 연출을 감싸는 1열 구조입니다. 스타일은 `grade-effects.css`에 있습니다.
- 도감 상세(`catalog-view.js`)의 "도감에 넣기"는 `card-catalog` 동작으로, 토스트를 띄운 뒤 상세를 엽니다.
- 공유(`share-view.js`): `shareDefaults()`의 `prob`("분석 확률 표시", 2026-11-24 이전 `hideProb`)가 `false`입니다. 모바일 뒤로 링크(`data-share-back`)는 `share-close` 처리 경로를 그대로 씁니다.
- 프로필(`profile-view.js`): 설정 묶음(`#settings-notice`·`records`·`data`·`about`)은 `.prefs-panel` 하나 안에 있습니다. 각 묶음에는 메뉴 이동 시 포커스를 받는 sr-only 제목이 있습니다. 선택한 메뉴는 모듈 변수 `profileSection`에 기억합니다.
- 테마 장식(`theme-decor.css`): 캔디 별과 첫눈 눈송이는 1440×900 SVG 한 장(`assets/themes/candy-stars.svg`·`mist-snow.svg`)으로 바뀌었습니다. 모눈 페이지 라벨(`.diary-page`)은 `home-view.js`가 날짜 줄에 넣고, CSS가 모눈 테마에서만 보여 줍니다.
