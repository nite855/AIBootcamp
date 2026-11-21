# 프론트 구조와 디자인 연결

`core.js`, `diary-core.js`, `cards.js`, `statistics.js`는 도메인 처리, `app.js`는 상태·화면·카드 출력, `statistics-view.js`·`catalog-view.js`는 뷰입니다. 도메인 판정은 유지합니다. `flip.js`는 카드 제스처·포커스, `storage.js`는 저장 검증과 IndexedDB 트랜잭션, `persistence.js`는 앱의 복원·자동 저장 연결을 담당합니다.

## 빌드

1. tools/build.mjs가 buildTokens를 호출합니다. JSON 참조를 검증하고 CSS·기존 인터페이스용 테마 데이터를 생성합니다.
2. base.css의 @font-face만 추출합니다. diary.css → themes.css → generated/tokens.css → flip.css를 내장합니다. 높은 구체성의 테마 재질 예외는 유지됩니다.
3. generated/theme-tokens.js → theme.js를 첫 화면 표시 전에 실행합니다. 설정 저장·OS 모드·meta theme-color 동작을 유지합니다.
4. 캐릭터 PNG 9종과 persistence.js를 앱에 내장합니다. 뷰·도메인·앱을 템플릿에 넣고 글꼴 라이선스를 내장합니다. 결과는 index.html 하나이며 fetch가 필요 없습니다.

디자인 검토 페이지와 와이어프레임은 별도 생성 명령으로 갱신합니다. 토큰값만 바꿔도 앱·검토 페이지를 모두 재생성해야 합니다. --check 검사로 오래된 토큰·검토 페이지를 발견할 수 있습니다.

## 데이터 경계

실제 기록·초안·기록 방식은 `moment-diary-main` IndexedDB의 `data` 저장소, `state` 키에 저장합니다. 예시는 별도 메모리이며 표시 설정은 기존 localStorage 키를 사용합니다. 기록 ID·버전과 분석을 카드·통계·도감이 공유합니다. 프론트 10감정과 백엔드 6분류는 미연결이며 임의 매핑을 추가하지 않습니다. 디자인 fixtures는 검토 페이지 전용이고 실제 기록에 주입하지 않습니다.


## 저장 인터페이스와 동시성

`DiaryStorage.create(indexedDB)`는 `load()`와 `save(snapshot)`를 제공합니다. schemaVersion 1의 스냅샷은 revision, text, date, sessions, policy, currentEntryId, savedText를 포함합니다. 복원 시 형식·중복 ID·날짜·문자 수·기록 수·연결 ID를 검증하고 실제 기록의 분석은 pending으로 처리합니다. 지원하지 않는 버전이나 손상 데이터는 자동 덮어쓰기를 차단합니다.

저장 요청은 직렬화하고 readwrite 트랜잭션 안에서 revision을 비교합니다. revision은 트랜잭션 완료 후에만 증가하며 충돌 시 현재 탭의 추가 쓰기를 차단합니다. 앱은 변경 세대를 추적해 이전 요청 완료가 새 입력의 미저장 상태를 지우지 못하게 합니다. 전체 삭제는 빈 스냅샷을 새 revision으로 기록하므로 오래 열린 탭도 충돌을 감지합니다.

기본 표시 설정은 lemon/light이며 공개 CardexTheme API와 저장 키는 유지합니다. 메인의 neg_1=불안, neg_2=슬픔, neg_3=분노 계약을 캐릭터·카드·도감·통계가 공유합니다. Flip 시안의 도메인 상수나 저장소는 가져오지 않습니다.

감정 계약은 core.js의 3+10 정의를 공유합니다. validateAnalysis는 분류 버전·잘림·확률을 검증하며 카드와 통계에서 함께 사용합니다. characterSVG는 기존 PNG와 중립 표식을 카드·도감·썸네일·PNG에 공통 렌더링합니다. [분석 연동 계약](API_CONTRACT.md)을 참고하세요.


## 메인 기능 통합 (2026-11-11)

메인 빌드는 기존 도메인에 record-id.js·backup.js를 더하고 persistence.js 뒤에 benchmark.js를 앱 클로저로 내장합니다. benchmark.css가 마지막 스타일로 적용됩니다. 빌드 전 backup-generated.mjs가 기존 HTML·생성 토큰을 루트 .backups에 버전 백업하고 일치를 검증합니다.

저장소와 설정 키는 유지하며 favorite만 선택 필드로 확장합니다(누락=false). JSON 병합은 진행 중인 자동 저장을 정리하고 revision 검사를 거친 단일 트랜잭션 성공 후 화면에 반영합니다. 시안 저장소를 조회하지 않습니다. 외부 API 변경은 없습니다.
