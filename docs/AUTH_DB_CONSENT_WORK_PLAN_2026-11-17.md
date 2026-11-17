# JWT 로그인·PostgreSQL RDBMS·한국 법령 기반 동의 구현 작업 계획서

기준일: 2026-11-17 (Asia/Seoul)  
상위 맥락: [구조 전환 계획서 v3](MIGRATION_PLAN_2026-11-17.md) · [9분류 미완료 작업 감사 및 완성 계획서](REMAINING_WORK_PLAN_2026-11-17.md)  
범위 변경: 기존 [구조 전환 계획서](MIGRATION_PLAN_2026-11-17.md#1-목표와-범위)의 "계정·서버 기록 저장·새 데이터베이스 미포함" 전제를 확장하여 **JWT 기반 인증**, **별도 PostgreSQL 컨테이너 영속 저장**, **한국 개인정보 보호법 기반 동의 절차**를 추가하기 위한 사전 분석 및 실행 계획서다.  
이번 작업 범위: 현행 코드베이스 조사 및 작업 계획서 작성(코드·컨테이너·DB 변경 미실행).

---

## 1. 현행 구조 분석 및 갭(As-Is vs To-Be)

| 영역 | 현행 확인 사실 (As-Is) | 목표 상태 (To-Be) | 주요 갭 |
|---|---|---|---|
| **인프라 / Compose** | [compose.yaml](../compose.yaml)에 `web`(Nginx)과 `api`(FastAPI) 2개 서비스만 정의됨. [test_ops_config.py](../backend/tests/test_ops_config.py)가 Compose/Nginx/Dockerfile 불변 규칙을 검사 | `postgres` RDBMS 컨테이너를 별도 서비스로 추가하고 named volume, healthcheck, 내부 네트워크 격리 구성 | DB 서비스, 영속 볼륨, DB/JWT 환경변수(`.env.example`), Nginx 인증 헤더·쿠키 전달 검증 부재 |
| **백엔드 서버** | [backend/app/main.py](../backend/app/main.py)는 무상태 FastAPI이며 `/api/health/live`, `/api/health/ready`, `/api/analyze`만 제공. [requirements.txt](../backend/requirements.txt)에 DB·ORM·마이그레이션·암호화·JWT 패키지 없음 | JWT 발급/검증/갱신, 한국 법령 기반 동의 검증·이력 관리, 계정별 기록·수집 카드 CRUD 및 `/api/analyze` 인증 연동 | SQLAlchemy/Alembic/PostgreSQL 드라이버·비밀번호 해싱·JWT 처리, 인증/동의 미들웨어, DB 연결 healthcheck 부재 |
| **데이터 저장 / 카드** | [snapshotStorage.mjs](../frontend/src/services/snapshotStorage.mjs)가 브라우저 IndexedDB(`moment-diary-main`)에 최대 30편·원문·분석 결과를 저장. [CatalogView.vue](../frontend/src/views/CatalogView.vue)는 `DiaryCards.collection()`으로 도감 27슬롯을 매번 계산 | 계정별로 대화/일기 기록, 감정 분석 결과, 수집된 카드 도감, 동의 이력을 PostgreSQL RDBMS에 영속 저장 | RDBMS 스키마 부재, 기존 IndexedDB 기록의 계정 이관(`/import`) 및 예시 모드 분리 필요 |
| **프론트엔드 / UX** | [App.vue](../frontend/src/App.vue)가 즉시 `useDiaryStore.restore()`로 진입. [analysisClient.mjs](../frontend/src/services/analysisClient.mjs)는 무인증으로 `POST /api/analyze` 호출. [SettingsView.vue](../frontend/src/views/SettingsView.vue)에 JSON 백업만 존재 | 로그인·회원가입 화면, 한국 법령 준수 분리 동의 및 로그인 시 재동의(Consent Gate), 계정별 기록·도감 동기화, 설정 내 동의 조회·철회·회원 탈퇴 제공 | Auth 상태 관리, 토큰 자동 갱신, 동의 UI/약관 모달, 계정 전환·로그아웃 시 상태 초기화 부재 |

### 기존 9분류 전환 작업과의 관계
- [contracts/analysis.schema.json](../contracts/analysis.schema.json), [backend/app/schemas/analysis.py](../backend/app/schemas/analysis.py), [backend/app/services/card_policy.py](../backend/app/services/card_policy.py), [frontend/src/domain/core9.js](../frontend/src/domain/core9.js)는 이미 **3+9 감정 체계(`emotion-cardex-3plus9-v1`, `card-stage-strict-gt-v1`)**를 기준으로 정의되어 있다.
- 본 계획의 모든 DB 스키마·API·프론트 동기화 로직은 이 9분류 계약(27개 `card_key`: `(pos|neg|neu)_[1-3]:[1-3]`)을 그대로 유지하며, 기존 `POST /api/analyze`의 요청·응답 스키마 호환성을 깨지 않고 인증·저장 계층을 결합한다.

---

## 2. 한국 법령 기반 사용자 정보·민감정보 제공 및 활용 동의 설계

본 서비스는 사용자가 작성한 **일기·대화 원문**과 AI 모델이 추론한 **감정 확률 분포·우세 감정·수집 카드**를 저장·활용한다. 이는 개인의 내밀한 정서·심리 상태와 직결되므로 「개인정보 보호법」(PIPA)상 **민감정보(제23조)** 수준의 엄격한 분리 동의와 안전조치가 필요하다.

### 2.1 법령 근거 및 필수 구현 원칙

| 근거 조항 | 핵심 요구사항 | 시스템 구현 반영 사항 |
|---|---|---|
| **제15조, 제22조** (수집·이용 및 동의 방법) | 수집 목적·항목·보유기간·동의 거부권 및 불이익을 명확히 고지하고 **개별 항목별 분리 동의** 획득 (포괄 동의 금지) | 회원가입·동의 화면에서 항목별 개별 체크박스 및 전문 보기 제공. "모두 동의" 버튼은 편의 기능으로만 두며 개별 체크·해제 가능해야 함 |
| **제23조, 시행령 제18조** (민감정보의 처리 제한) | 일반 개인정보 수집·이용 동의와 **별도로** 민감정보 처리 동의를 받아야 함 | `[필수] 개인정보 수집·이용 동의`와 `[필수] 민감정보(대화·감정 분석 데이터) 처리 및 활용 동의`를 반드시 **서로 다른 필수 동의 항목**으로 분리 |
| **제17조** (제3자 제공) / **제26조** (위탁) | 제3자에게 개인정보·민감정보를 제공할 경우 제공받는 자·목적·항목·보유기간을 알리고 별도 동의 | 현재는 자체 `api` 컨테이너 내 로컬 모델만 사용하므로 제3자 제공 없음. 향후 외부 분석/연구·통계 제공이나 선택적 활용이 있을 경우 `[선택]` 분리 동의 항목으로만 설계(미동의 시 서비스 이용 제한 금지) |
| **제22조의2** (아동의 개인정보 보호) | 만 14세 미만 아동의 경우 법정대리인 동의 필요 | 가입 시 **만 14세 이상 여부 확인(필수)**을 명시적으로 받아 법정대리인 미확인 아동 가입을 차단 |
| **제21조, 제36조~제39조** (권리 행사 및 파기) | 정보주체는 동의 철회, 열람, 정정·삭제, 처리정지를 요구할 수 있으며 목적 달성·탈퇴 시 지체 없이 파기 | 로그인 후 `설정`에서 동의 현황 열람, 선택 동의 즉시 철회, 필수/민감정보 동의 철회(회원 탈퇴) 및 연계 데이터 삭제·파기 API 제공 |
| **동의 증적 보관** (분쟁 입증 책임) | 사업자는 적법하게 동의를 받았음을 입증할 수 있어야 함 | 계정별 현재 동의 상태뿐 아니라 동의/철회 시점, **동의서 버전(`policy_version`)**, 항목별 동의 여부, 요청 시각·해시 메타데이터를 불변 감사 로그 테이블에 기록 |

### 2.2 동의 항목 구성 및 로그인 시 처리 흐름

1. **동의 항목 구조 (초기 버전 `v1`)**
   - `AGE_14_PLUS` (**필수**): 만 14세 이상 이용자 확인
   - `PRIVACY_COLLECTION` (**필수**): 계정 식별·인증·서비스 제공을 위한 개인정보 수집·이용 동의 (항목: 로그인 식별자, 비밀번호 해시, 닉네임, 접속/인증 로그 / 보유기간: 회원 탈퇴 시까지 또는 법령상 보존기간)
   - `SENSITIVE_EMOTION_PROCESSING` (**필수**): 대화·일기 원문, 감정 분석 결과, 수집 카드 정보 등 민감정보의 수집·AI 분석·계정별 저장 및 활용 동의 (거부 시 감정 분석·기록 저장 서비스 이용 불가 고지)
   - `OPTIONAL_SERVICE_IMPROVEMENT` (**선택**): 비식별·통계적 서비스 품질 개선 또는 향후 선택적 제공·활용 동의 (거부해도 기본 서비스 이용 가능)
2. **회원가입 및 로그인 시 동의 게이트(Consent Gate)**
   - **회원가입(`/api/auth/register`)**: 필수 3종이 모두 `true`인 경우에만 계정 생성 및 동의 이력 저장(하나라도 누락·미동의 시 `422` 거부).
   - **로그인(`/api/auth/login`)**:
     - 인증 성공 후 서버가 해당 계정의 **현재 유효한 필수·민감정보 동의 버전(`is_current_consent_valid`)**을 검사한다.
     - 최초 로그인(또는 관리자/운영자가 추가한 미동의 계정)이거나 법령·처리방침 변경으로 **동의서 버전이 상향(`v1` → `v2`)**된 경우, 로그인 응답에 `consent_required: true`와 미충족 동의 항목 목록을 반환하고 **동의 전용 제한 상태(또는 동의 갱신 화면)**로 유도한다.
     - 사용자가 동의 갱신 API(`/api/auth/consents`)를 완료해야 일반 서비스 토큰(`scope: full`) 및 기록/분석 API 접근을 허용한다.
   - **API 게이트 강제**: `/api/analyze`, `/api/records/*`, `/api/cards/*` 등 모든 핵심 업무 API는 JWT 인증뿐 아니라 **필수 개인정보·민감정보 동의 유효성**을 백엔드 의존성(`require_active_consents`)에서 함께 검증하여 우회 호출을 차단한다.

> [!IMPORTANT]
> 실제 서비스 공개 전에는 고지 문구(수집 항목, 보유·파기 기간, 개인정보 보호책임자 연락처 등) 및 민감정보 범위 정의에 대해 법무·개인정보보호 담당자의 최종 문안 검수를 권장한다.

---

## 3. PostgreSQL RDBMS 데이터 모델 설계 (개요)

`postgres` 컨테이너 내부에 영속 저장할 핵심 테이블 구조는 다음과 같다.

```text
users (1) ──< refresh_tokens (N)
  │
  ├──< user_consents (N) ──> consent_policies (1)
  ├──< user_consent_logs (N)   [불변 감사 이력: 동의/갱신/철회]
  ├──< diary_records (N)       [계정별 대화/일기 원문 + 9감정 분석 결과]
  └──< collected_cards (N)     [계정별 수집 카드 도감 27슬롯 해금·집계]
```

| 테이블 | 핵심 컬럼 및 제약조건 | 설계 의도 |
|---|---|---|
| `users` | `id`(UUID PK), `login_id`(UNIQUE), `email`(UNIQUE), `password_hash`, `nickname`, `is_adult_14_plus`, `is_active`, `created_at`, `updated_at`, `deleted_at` | 계정 기본 정보(아이디·이메일·비밀번호 해시). 이메일 실존 인증은 미수행하며 형식/중복 검증만 적용. 탈퇴 시 개인정보 파기 및 자식 레코드 정리 |
| `refresh_tokens` | `id`(UUID PK), `user_id`(FK CASCADE), `token_hash`(UNIQUE), `expires_at`, `revoked_at`, `created_at` | Refresh Token Rotation 및 로그아웃·탈퇴 시 즉시 세션 무효화 |
| `consent_policies` | `id`, `code`(예: `SENSITIVE_EMOTION_PROCESSING`), `version`, `title`, `summary`, `is_required`, `is_sensitive`, `effective_from`, `is_active`, UNIQUE `(code, version)` | 동의서 문안과 버전을 DB로 관리해 개정 시 로그인 재동의 자동 트리거 |
| `user_consents` | `id`, `user_id`(FK CASCADE), `policy_code`, `policy_version`, `agreed`(bool), `agreed_at`, `revoked_at`, UNIQUE `(user_id, policy_code, policy_version)` | 현재 계정의 최신 동의 상태 빠른 조회 |
| `user_consent_logs` | `id`, `user_id`(FK or 익명화 보관 정책), `policy_code`, `policy_version`, `action`(`GRANTED`/`REVOKED`), `client_meta_hash`, `created_at` | 법적 분쟁 대비 불변 동의/철회 증적 로그 |
| `diary_records` | `id`(UUID PK), `user_id`(FK CASCADE), `client_record_id`, `record_date`(DATE), `text`, `version`(INT), `favorite`(BOOL), `analysis_status`(`pending`/`valid`/`error`), `model_version`, `taxonomy_version`, `probabilities`(JSONB), `dominant_emotion`, `dominant_ratio`, `ties`(JSONB), `card_stage`, `card_key`, `card_policy_version`, `truncated`(BOOL), `error_code`, `error_message`, `created_at`, `updated_at`, UNIQUE `(user_id, client_record_id)` | 계정별 대화/일기 원문과 분석 스냅샷 저장. `(user_id, record_date DESC)` 및 `(user_id, card_key)` 인덱스로 목록·달력·통계 조회 최적화 |
| `collected_cards` | `id`(UUID PK), `user_id`(FK CASCADE), `card_key`, `emotion_id`, `card_stage`, `first_record_id`(FK SET NULL), `last_record_id`(FK SET NULL), `collect_count`(INT), `first_collected_at`, `last_collected_at`, UNIQUE `(user_id, card_key)` | 계정별 수집 카드 도감(최대 27슬롯) 현황 및 수집 횟수·최초 해금 시각 보존 |

---

## 4. 작업 계획서 (지나친 분리 없이 5개 독립 검증 단위로 구성)

각 작업 패키지(WP)는 **단독 실행 및 완료 여부 판정**이 가능하도록 수직/계층 경계를 명확히 묶었으며, 파일 단위나 엔드포인트 단위의 과도한 세분화는 배제했다.

| WP ID | 작업명 | 선행 | 핵심 포함 범위 (통합 단위) | 독립 완료 판정 기준 (DoD) |
|---|---|---|---|---|
| **WP-1** | PostgreSQL 컨테이너 및 RDBMS 스키마·마이그레이션 기반 | 없음 | `compose.yaml`에 `postgres` 서비스(공식 PostgreSQL 이미지, named volume, healthcheck, 내부 네트워크) 추가, `.env.example`에 `POSTGRES_*`·`DATABASE_URL`·`JWT_*` 변수 추가, [backend/requirements.txt](../backend/requirements.txt) 의존성 추가, SQLAlchemy 모델 + Alembic 마이그레이션 + 초기 동의 약관(`consent_policies` v1) 시드 스크립트 구현 | 1) `docker compose config` 정상<br>2) `postgres` 컨테이너 단독 기동 및 healthcheck `healthy` 도달<br>3) `alembic upgrade head` 및 `downgrade base` 반복 실행 무오류<br>4) DB 연결·테이블 제약/유니크 인덱스 검증 테스트 통과 |
| **WP-2** | JWT 인증·한국 법령 기반 동의/철회·계정 API | WP-1 | 비밀번호 해싱(Argon2id/bcrypt), Access JWT + Refresh Token(HttpOnly 쿠키/Rotation) 모듈, 동의서 조회(`/api/auth/consent-policies`), 회원가입(`/api/auth/register` — 만 14세·개인정보·민감정보 분리 동의 필수 검증), 로그인(`/api/auth/login` — 인증 + 최신 동의 버전 충족 여부 검사 및 미충족 시 Consent Gate 응답), 동의 갱신/철회(`/api/auth/consents`), 로그아웃/재발급(`/api/auth/refresh`, `/api/auth/logout`), 회원 탈퇴(`/api/auth/withdraw`), `get_current_user` + `require_active_consents` FastAPI 의존성 구현 | 1) 분리 필수/민감정보 동의 누락 회원가입 `422` 거부<br>2) 로그인 → JWT 접근 → Refresh 로테이션 → 로그아웃 후 기존 토큰 거부(`401`)<br>3) 동의 버전 상향 시 로그인 `consent_required: true` 반환 및 재동의 전 보호 API `403` 차단<br>4) 선택 동의 철회·회원 탈퇴 시 `user_consent_logs` 기록 및 탈퇴 계정 재로그인 차단 |
| **WP-3** | 계정별 대화 기록·감정 분석·수집 카드 영속 API | WP-2 | [backend/app/api/analyze.py](../backend/app/api/analyze.py)에 인증·동의 게이트(`require_active_consents`) 적용, 계정별 기록 CRUD(`/api/records`: 생성·조회·수정·삭제·즐겨찾기·필터, 로컬 백업 일괄 이관 `/api/records/import`), 분석 실행/재시도 시 `diary_records`와 `collected_cards` 트랜잭션 동시 갱신(잘림/오류 시 원문 보존·카드 미발급), 계정별 도감·카드 통계 조회(`/api/cards`), 기존 [analysis.schema.json](../contracts/analysis.schema.json) 계약 유지 | 1) 사용자 A/B 간 기록·카드 교차 접근 차단(IDOR 테스트 통과)<br>2) 기록 저장 + 감정 분석 성공 시 `diary_records` 및 `collected_cards` 동시 반영 확인<br>3) `INPUT_TRUNCATED` / `503 MODEL_NOT_READY` 시 원문 저장 유지·카드 미생성 확인<br>4) 기존 백엔드 계약 테스트(`test_contract.py`, `test_card_policy.py` 등) 전수 통과 |
| **WP-4** | 프론트엔드 로그인·법령 동의 UI 및 계정 저장소 연동 | WP-2, WP-3 | 로그인/회원가입·Consent Gate 화면(만 14세·개인정보·민감정보 개별 체크박스, 목적/항목/보유기간/거부 불이익 고지 펼침, 선택 동의 분리), `authClient.mjs` + `useAuthStore.js`(토큰 갱신·401 처리·로그아웃 시 민감 메모리 상태 초기화), [useDiaryStore.js](../frontend/src/composables/useDiaryStore.js) 및 [analysisClient.mjs](../frontend/src/services/analysisClient.mjs) 서버 API 연동, 기존 브라우저 IndexedDB 기록의 계정 1회 이관 안내, [SettingsView.vue](../frontend/src/views/SettingsView.vue) 내 동의 내역 확인·철회·회원 탈퇴 UI 추가 | 1) `npm run build` 및 프론트 단위 테스트 통과<br>2) UI에서 필수/민감정보 미체크 시 가입/진행 불가, 선택 미체크 시 가입 가능 확인<br>3) 로그인 → 기록 작성/분석 → 새로고침·재로그인 후 기록 및 [CatalogView.vue](../frontend/src/views/CatalogView.vue) 도감 복원 확인<br>4) 계정 전환 시 이전 계정 기록 잔존 없음 및 동의 철회/탈퇴 동작 확인 |
| **WP-5** | Nginx·Compose 통합 운영/보안 검증 및 문서 정비 | WP-1 ~ WP-4 | [infra/nginx/default.conf](../infra/nginx/default.conf) 점검(Authorization/Cookie 전달, 캐시 비저장 정책, 보안 헤더), [backend/app/api/health.py](../backend/app/api/health.py)에 DB 연결 상태 반영 여부 정비, [test_ops_config.py](../backend/tests/test_ops_config.py)·[docs/openapi.yaml](../docs/openapi.yaml)·[docs/architecture.md](../docs/architecture.md)·[frontend/docs/DOCKER.md](../frontend/docs/DOCKER.md) 등 문서·테스트 동기화, 전체 스택(`web`+`api`+`postgres`) E2E 및 DB 재시작 영속성 검증 | 1) `docker compose up -d --build` 전체 서비스 `healthy` 기동<br>2) Nginx(`:8080`) 경유 회원가입(동의) → 로그인 → 분석 → 카드 수집 → `postgres` 컨테이너 재시작 후 데이터 유지 확인<br>3) 백엔드 전체 테스트 및 프론트 테스트/빌드 회귀 없음 |

### 권장 실행 순서
1. **WP-1** 완료 및 마이그레이션 검증 후 **WP-2** 진행
2. **WP-2**의 인증·동의 의존성이 확정되면 **WP-3** 진행 (백엔드 API 계약 확정)
3. **WP-3** 완료 후 **WP-4**에서 프론트엔드 인증·동의 UI 및 서버 동기화 연결 (WP-2 완료 시 로그인 UI 선행 착수 가능)
4. 모든 기능이 연결된 상태에서 **WP-5**로 전체 컨테이너·프록시·문서·회귀 검증 마무리

---

## 5. 확정된 설계 결정 사항 (Confirmed Decisions)

사용자 확정에 따라 아래 5가지 정책을 구현 기준으로 고정한다.

1. **로그인 식별자 (`아이디 + 비밀번호 + 이메일` 수집):** 회원가입 시 아이디(`login_id`), 비밀번호, 이메일(`email`)을 수집·저장하되, 현재 단계에서는 이메일 실존 확인/인증 메일 발송은 수행하지 않는다(형식 검증 및 중복 방지 UNIQUE 적용). 개인정보 수집·이용 고지 항목에 아이디·비밀번호·이메일을 명시한다.
2. **기록 삭제 시 수집 카드(`collected_cards`) 동반 삭제 및 2차 확인:** 기록 삭제 시 해당 기록과만 연결되어 있던 해금 카드(`collected_cards`)도 함께 삭제(미발견) 처리한다. UI에서는 삭제 전 **"해금된 카드(도감) 기록도 함께 삭제된다"는 사실을 사용자에게 명시적으로 안내하고 2차 확인**을 거친 뒤 삭제를 실행한다.
3. **계정당 저장 한도 (`100개`):** 계정별 `diary_records` 최대 보관 한도를 기존 30편에서 **100편**으로 상향한다.
4. **비로그인 체험 미제공:** 비로그인 상태의 예시 모드(`example` 모드) 체험을 제공하지 않으며, 로그인/회원가입 및 한국 법령 기반 동의 완료 후에만 서비스 이용이 가능하다.
5. **세션 전달 방식:** Access Token(단기 JWT, 응답 JSON → 프론트 메모리 보관) + Refresh Token(`HttpOnly`, `SameSite=Lax` 쿠키 + Rotation 및 DB 해시 관리) 조합을 사용한다.
