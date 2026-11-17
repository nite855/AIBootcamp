# 저장소 구조·경로 전환 기준선 · BASE-02

> 이 문서는 전환 착수 당시의 구조 기준선이다. 이후 `backend/app/`, Vue·계약·Compose 기반이 추가되었으며, 최신 9분류 목표와 잔여 작업은 [개정 전환 계획](MIGRATION_PLAN_2026-11-17.md)·[완성 계획](REMAINING_WORK_PLAN_2026-11-17.md)을 따른다. 아래 10분류·모델 제공 대기·구형 경로 서술을 현재 구현 완료 상태로 해석하지 않는다.

기준일: 2026-11-17 (Asia/Seoul)  
상위 계획: [전환 계획서](MIGRATION_PLAN_2026-11-17.md) (단계 `0 / BASE-02`)  
선행 확인: [BASE-01 디자인 기준선](../frontend/docs/design/BASELINE_2026-11-17.md), [디자인 작업 안내](../frontend/docs/design/README.md)  
범위: 중복 서버·정적 화면·자산·테스트·문서 링크·실행 경로의 현황 고정 및 이동·보존·통합 기준 수립. **이 단계에서는 애플리케이션 코드·설정·기존 파일 위치를 이동하거나 삭제하지 않는다.**

## 1. 중복 서버·정적 화면·모델·자산 비교

### 1.1 FastAPI 진입점 및 추론 모듈 비교

현재 저장소에는 두 개의 FastAPI 서버 진입점과 두 개의 추론 모듈이 공존한다.

| 구분 | `backend/` (`backend.main:app`) | `src/emotion_service/` (`emotion_service.main:app`) | 전환 조치 (`STRUCT-01`) |
|---|---|---|---|
| 진입점 | `backend/main.py` | `src/emotion_service/main.py` | `backend/app/main.py`로 단일 통합 |
| 정적 화면 제공 | `GET /` → `frontend/index.html` | `GET /` → `static/index.html`, `/static` 마운트 | API에서 정적 화면 제거 → Nginx 제공 |
| 요청/응답 스키마 | `lines`, `predictions` | `lines`, `predictions`, `word_frequencies`, `emotion_word_frequencies` | `CONTRACT-01` 신규 10감정 기록 단위 계약으로 교체(구형 단어 빈도 미이식) |
| 줄 수 검증 | 빈 줄 제거 후 `if not lines`만 검사 | `services/analysis.py` `parse_lines`: 1~100줄 제한 | 신규 계약의 10,000자·공백 검증으로 대체(`parse_lines` 검증 로직 비교 이관) |
| 추론 모듈 | `backend/emotion_model.py` (`EmotionPredictor`) | `src/emotion_service/ml/predictor.py` (`EmotionPredictor`) | `backend/app/ml/`로 통합(`MODEL-01`/`02` 반영) |
| 추론기 코드 차이 | `ROOT` = 저장소 루트, `ROOT / STUDY_NAME` 및 `../experiments/` 탐색 | `_default_study_dir`가 `Downloads`만 탐색하며, **미정의 심볼 `DEFAULT_CHECKPOINT` 참조**(30·79행, 미설정 시 `NameError`), `ROOT`가 `src/emotion_service/`를 가리킴 | `backend/emotion_model.py` 기준으로 통합 후 결함 제거 |
| 패키징·Docker 참조 | `Dockerfile` 기본 `CMD` (`backend.main:app`) | `compose.yaml` `command` (`emotion_service.main:app --reload`), `pyproject.toml` (`where = ["src"]`) | `uvicorn backend.app.main:app` 단일화 및 `pyproject.toml` 갱신 |
| 의존성 명세 | `backend/requirements.txt` (`fastapi==0.115.6`, `uvicorn==0.34.0`, `torch>=2.2,<3`, `transformers==4.57.6`, `safetensors>=0.4,<1`) | 별도 requirements 없음 (`backend/requirements.txt` 공유) | `backend/requirements.txt`로 일원화 및 버전 고정 |

### 1.2 HTML·정적 자산·모델 현황 (실측 기준)

| 대상 | 실측 크기 / 구성 | SHA-256 (앞 12자) / 내용 | 처리 구분 |
|---|---|---|---|
| `frontend/index.html` | 12,450,248 bytes | `5188dc975b0e` · BASE-01 현행 메인 "오늘의 모먼트" 단일 HTML 빌드물 | Vue 이식 완료·검증 후 `archive/` 보관 (`CLEAN-01`) |
| `static/index.html` | 28,913 bytes | `50b6c2c3e850` · 구형 6감정 카드·단어 빈도 UI(Chart.js·Google Fonts CDN, `/static/images/...` 의존) | 전환 검증 후 `static/` 전체를 `archive/`로 이동 |
| `design-lab/emotion-mvp/index.html` | 4,161 bytes | `e86fc0c3e154` · 초기 plain MVP 화면 | `design-lab/`과 함께 `archive/` 이동 |
| `frontend/assets/characters/` | PNG 9종 (`pos_1~3`, `neg_1~3`, `neutral`, `heart`, `star`) + `prompts.json` | `design-lab/diary-3d-v1/assets/*.png`와 **9종 모두 SHA-256 완전 일치** | 메인 기준 자산으로 보존·Vue `src/assets/` 이식 (임시 카드 연결 후 정식 이미지 인수 시 `public/assets/cards/` 추가) |
| `frontend/assets/themes/` | SVG 3종 (`forest.svg`, `sunset.svg`, `starlight.svg`) | 프로젝트 원본 SVG | 보존 및 Vue `src/assets/` 이식 |
| `static/images/` | `assets/` 3종(`background.png`, `full_header.png`, `logo.png`), `character_cards/` 6종(`기쁨`, `당황`, `분노`, `불안`, `상처`, `슬픔`) | 구형 6감정 UI 전용 이미지 | `static/`과 함께 `archive/`로 이동(삭제 금지) |
| `models/emotion-kcelectra/` | `metrics.json` + `checkpoint/` (`config.json`, `model.safetensors`, `tokenizer*.json`, `vocab.txt` 등) | KcELECTRA 6라벨(`분노`, `슬픔`, `불안`, `상처`, `당황`, `기쁨`), `max_length: 256`, `context_turns: 0` | Git 제외(`.gitignore`) 유지, 로컬 읽기 전용 볼륨으로 보존; 새 10감정 모델 인수 전까지 임시/기존 체크포인트 구분 |

## 2. 파일 이동·통합·보존표

목표 구조는 [전환 계획서 6절](MIGRATION_PLAN_2026-11-17.md#6-목표-디렉터리와-정리-원칙)을 따른다. 모든 이동·제거는 선행 검증 단계 완료 후 수행한다.

| 현재 경로 | 현재 역할 | 목표 경로 | 처리 구분 | 담당 / 실행 단계 | 보존·주의사항 |
|---|---|---|---|---|---|
| `frontend/scripts/*.js` (도메인: `core`, `diary-core`, `cards`, `statistics`, `record-id`) | 순수 JS 도메인 판정·집계 | `frontend/src/domain/` | 이식 | FE / `WEB-02` | `cards.js` 30/60/90% → `0·1/3·2/3` 초과 규칙은 `CONTRACT-01` 이후 반영 |
| `frontend/scripts/*.js` (저장·백업: `storage`, `persistence`, `backup`) | IndexedDB `moment-diary-main`, JSON 백업 | `frontend/src/services/`, `frontend/src/composables/` | 이식 | FE / `WEB-02`, `DATA-01` | IndexedDB 이름·로컬 설정 키 보존, schema v1→v2 호환 |
| `frontend/scripts/*.js` (화면·UI: `app`, `*-view`, `flip`, `benchmark`, `theme`) | 문자열 DOM 렌더링·카드 효과·테마 | `frontend/src/views/`, `components/`, `App.vue` | 이식 | FE / `WEB-01`, `WEB-02` | BASE-01 DOM·클래스·초점·접근성 보존 |
| `frontend/styles/*.css`, `frontend/assets/*` | 6개 순서 스타일·내장 폰트·PNG 9종·SVG 3종 | `frontend/src/styles/`, `frontend/src/assets/` | 이식·보존 | FE / `WEB-01` | `diary → themes → tokens → flip → benchmark → moment` 순서·라이선스 유지 |
| `frontend/design/` | 토큰 JSON, `manifest.json`, 와이어프레임 정의 | `frontend/design/` | 보존 | FE·QA | `build-tokens.mjs` 등 토큰 원본 유지 |
| `frontend/tools/` | 단일 HTML·토큰·미리보기 생성기 | `frontend/tools/` (필요 도구 유지) | 정리·보존 | FE / `CLEAN-01` | Vite 전환 후 `build.mjs` 역할 재정의 및 구형 산출물 정리 |
| `frontend/index.html`, `frontend/templates/shell.html` | 구형 단일 HTML 빌드본 및 셸 | `archive/frontend-vanilla/` (또는 `archive/`) | 보관 (`CLEAN-01`) | 조정·FE / `CLEAN-01` | Vue 전환·QA 통과 전까지 유지(`Dockerfile` 현재 참조 중) |
| `frontend/tests/*.test.cjs`, `*.cjs` | 단위·브라우저 회귀 테스트 | `frontend/tests/` (유지 + Vue 테스트 추가) | 보존·확장 | FE·QA / `WEB-01~02` | 도메인 단위 테스트 및 BASE-01 시각 비교 재활용 |
| `frontend/docs/` | UI 명세·QA·디자인 기준선(`BASELINE_2026-11-17.md`) | `frontend/docs/` | 보존·갱신 | QA·FE / `CLEAN-01` | `BASE-01` 등 기준 문서는 보존, 구형 실행 안내만 `CLEAN-01`에서 갱신 |
| `backend/main.py`, `backend/emotion_model.py` | 구 FastAPI 앱 및 KcELECTRA 추론기 | `backend/app/main.py`, `api/`, `schemas/`, `services/`, `ml/` | 통합 | BE / `STRUCT-01` | `backend/emotion_model.py`의 경로 탐색·오프라인 강제·검증 유지 |
| `src/emotion_service/` | 병존 FastAPI 패키지 (`api`, `ml`, `schemas`, `services`) | 필요 검증 코드만 `backend/app/`로 흡수 후 제거 | 통합·제거 | BE / `STRUCT-01`, `CLEAN-01` | `services/analysis.py` 입력 검증 참고; 단어 빈도 UI/응답은 미이식; `DEFAULT_CHECKPOINT` 결함 폐기 |
| `backend/tests/` | FastAPI·추론기 단위 테스트 (`test_main.py`, `test_emotion_model.py`) | `backend/tests/` | 보존·확장 | BE / `STRUCT-01` | `CONTRACT-01`·`CARD-01` 테스트 추가 |
| `tests/` (`ml/test_predictor.py`, `services/test_analysis.py`) | 루트 단위 테스트 | `backend/tests/`로 통합 검토 후 제거 | 통합·제거 | BE / `STRUCT-01`, `CLEAN-01` | `ml/test_predictor.py`는 `backend/tests/test_emotion_model.py`와 **0줄 차이 완전 중복** |
| `static/` (`index.html`, `images/`) | 구형 6감정 화면·이미지 | `archive/static/` | 보관 | 조정 / `CLEAN-01` | `compose.yaml` 마운트 제거 후 이동, 이미지 삭제 금지 |
| `design-lab/` (11개 실험 시안, `package.json`) | `diary-3d-v1`, `diary-benchmark-v1`, `diary-flip-v1` 등 과거 시안 | `archive/design-lab/` | 보관 | 조정 / `CLEAN-01` | `reports/frontend-comparison/` 링크 참조 확인 후 이동 |
| `reports/` (`record-ui-2026-11-09`, `frontend-integration`, `diary-benchmark-v1`, `frontend-comparison`) | 과거 개편·비교·통합 검증 증거 | `reports/` (기존 증거 유지 + 신규 Vue QA 보고서 추가) | 보존 | QA·조정 | `frontend/docs/` 및 `BASE-01`이 직접 링크 중이므로 이동·삭제 금지 |
| `reference/` | 글래스모피즘·레퍼런스 이미지·아이콘 | `reference/` | 보존 | 조정 | 목표 구조에서도 루트 `reference/` 유지 |
| `artifacts/` | `emotional-dialogue-study/configs/*.json` 등 학습 설정 | `artifacts/` | 보존 | ML·조정 | `.gitignore` 예외 정책(`configs/*.json`만 추적) 유지 |
| `models/` | 로컬 KcELECTRA 체크포인트(가중치 Git 제외) | `models/` | 보존 | ML·인프라 | `.gitignore` 유지, 운영 이미지 빌드 컨텍스트 제외(`.dockerignore`) |
| `.backups/` | 버전 백업 이력 (`.gitignore` 제외) | `.backups/` (로컬 유지) | 보존 | 전 역할 | 절대 삭제·이동·빌드 포함 금지 |
| `Dockerfile`, `compose.yaml` | 백엔드 단일 Dockerfile 및 구 `emotion_service` Compose | `backend/Dockerfile`, `infra/docker/frontend.Dockerfile`, `infra/nginx/default.conf`, `compose.yaml` | 교체 | 인프라 / `OPS-01` | `STRUCT-01`·`WEB-01` 검증 후 구형 `Dockerfile` 정리 |
| `pyproject.toml` | `where = ["src"]` (`emotion-service`) 패키징 | `backend` 기준 또는 제거/갱신 | 갱신 | BE / `STRUCT-01` | `src/` 제거 시 함께 수정 필수 |
| `.env`, `.env.example`, `.gitignore`, `.dockerignore` | 로컬 모델 경로 환경·제외 규칙 | 루트 유지 및 `infra`/신규 계약 변수 반영 | 보존·갱신 | 인프라 / `OPS-01` | `.env` Git 미추적 유지, `.dockerignore`에 `design-lab/`, `archive/`, `.backups/` 추가 검토 |
| `docs/`, `README.md` | 구조·OpenAPI·프롬프트 이력·계획서 | `docs/` (신규 `contracts/` 추가) | 보존·갱신 | 조정 / `CLEAN-01` | `docs/architecture.md`, `docs/openapi.yaml`, `README.md`는 전환 후 일괄 갱신 |

## 3. 실행 경로·Python import·스크립트 참조 목록

### 3.1 현재 실행 명령 및 경로

| 영역 | 현재 실행 경로/명령 | 참조 대상 | 비고 |
|---|---|---|---|
| 메인 백엔드 (Docker 기본) | `uvicorn backend.main:app --host 0.0.0.0 --port 8000` | `backend/main.py`, `frontend/index.html` | `Dockerfile` 기본 `CMD` |
| 병존 백엔드 (Compose) | `uvicorn emotion_service.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir /app/src` | `src/emotion_service/main.py`, `static/`, `PYTHONPATH=/app/src` | `compose.yaml`이 `Dockerfile` `CMD`를 덮어씀 |
| 추론 CLI | `python -m backend.emotion_model ...` / `src/emotion_service/ml/predictor.py` | `models/` 또는 `EMOTION_MODEL_DIR`·`EMOTION_STUDY_DIR` | `predictor.py`는 `DEFAULT_CHECKPOINT` 미정의 오류 보유 |
| 프론트 빌드·토큰 도구 | `node frontend/tools/build.mjs`, `build-tokens.mjs`, `build-wireframes.mjs`, `build-design-preview.mjs` | `frontend/design/`, `scripts/`, `styles/`, `assets/`, `.backups/` | `build.mjs`가 `backup-generated.mjs`로 `.backups/` 백업 수행 |
| 백엔드 테스트 | `python -m unittest discover -s backend/tests -v` / `$env:PYTHONPATH="src"; python -m unittest discover -s tests -v` | `backend/tests/`, `tests/` | 루트 `tests/`는 `PYTHONPATH=src` 없이 `emotion_service` import 실패 |
| 프론트 단위 테스트 | `node --test frontend/tests/*.test.cjs` | `frontend/tests/*.test.cjs` (10개 파일) | Node 내장 테스트 러너 사용 |
| 프론트 브라우저 테스트 | `node frontend/tests/<name>.cjs` | `%TEMP%/aibootcamp-frontend-review/node_modules/playwright` 또는 `CARDEX_PLAYWRIGHT`·`CARDEX_CHROMIUM` | `mobile-lan.cjs`만 `reports/frontend-integration/lan-*` 생성 |

### 3.2 Python import 및 패키지 의존성 목록 (전수 조사)

| 파일 | import 대상 | 의존성·특이사항 |
|---|---|---|
| `backend/main.py` | `fastapi`, `pydantic`, `backend.emotion_model.EmotionPredictor` | `frontend/index.html` 파일 경로 직접 참조 |
| `backend/emotion_model.py` | 표준 라이브러리, 지연 import `torch`, `transformers` | `ROOT = Path(__file__).resolve().parent.parent` (저장소 루트) |
| `backend/tests/test_main.py` | `backend.main.app`, `unittest.mock.patch("backend.main.EmotionPredictor")` | `fastapi` 설치 필요 |
| `backend/tests/test_emotion_model.py` | `backend.emotion_model` | 표준 라이브러리만 사용(모델·FastAPI 불필요) |
| `src/emotion_service/main.py` | `fastapi`, `fastapi.staticfiles.StaticFiles`, `emotion_service.api.analyze`, `emotion_service.ml.predictor` | `PROJECT_ROOT / "static"` 마운트 및 서빙 |
| `src/emotion_service/api/analyze.py` | `fastapi`, `emotion_service.schemas.analysis`, `emotion_service.services.analysis` | — |
| `src/emotion_service/services/analysis.py` | `emotion_service.schemas.analysis` | 100줄 제한 및 공백 단어 빈도 집계 |
| `src/emotion_service/schemas/analysis.py` | `pydantic.BaseModel` | — |
| `src/emotion_service/ml/predictor.py` | 표준 라이브러리, 지연 import `torch`, `transformers` | `DEFAULT_CHECKPOINT` 미정의 결함 |
| `tests/ml/test_predictor.py` | **`backend.emotion_model`** (경로와 무관하게 `backend` import) | `backend/tests/test_emotion_model.py`와 완전 동일 |
| `tests/services/test_analysis.py` | `emotion_service.schemas.analysis`, `emotion_service.services.analysis` | `PYTHONPATH=src` 또는 editable install 필요 |
| `design-lab/diary-flip-v1/test_hierarchical_contract.py` | `hierarchical_contract.combine` | 독립 시안 테스트 |
| `design-lab/emotion-cardex*/tools/subset-fonts.py` | `fontTools` | 시안 전용 도구 |
| `reports/frontend-comparison/build_report.py`, `build_standalone.py` | 표준 라이브러리 | `design-lab/<name>/<file>` 링크 생성 (`inspect.cjs`도 `design-lab/` 스캔) |

### 3.3 문서 링크 및 경로 참조 감사 결과

대상: 루트 `README.md`, `docs/*.md`, `frontend/README.md`, `frontend/docs/**/*.md`, `reports/*/README.md`, `design-lab/README.md` (총 37개 Markdown 파일의 상대 링크 전수 검증 및 본문 경로 키워드 점검).

| 파일 | 위치 | 발견된 문제 | 조치 시점 |
|---|---|---|---|
| `docs/prompt-results-2026-11-16.md` | 24행 `../AGENTS.md` 링크 | **깨진 링크**: 루트 `AGENTS.md`는 추적 해제·삭제됨(`.backups/AGENTS.v001~v002.md`에만 존재) | `CLEAN-01` (또는 이력 문서 정정 시 링크 제거) |
| `README.md` | 21행 `image/`, 67행 `emotion_service.main:app`, 156~165행 `word_frequencies` | 존재하지 않는 `image/` 폴더 표기(`reference/`/`static/images/` 혼동), 두 백엔드 진입점 및 서로 다른 API 응답을 혼합 서술 | `CLEAN-01` (신규 Vue+FastAPI+Compose 안내로 전면 개정) |
| `docs/architecture.md` | 12·15·30·42·70·71행 `src/emotion_service/api.py`, `predictor.py`, `static/index.html` | **오래된 경로**: 현재는 `api/analyze.py`, `ml/predictor.py`로 분할되어 해당 파일 부재 | `CLEAN-01` (전환 완료 아키텍처로 개정) |
| `docs/openapi.yaml` | `/api/analyze` (`word_frequencies` 포함 6감정 다중 줄 계약) | `backend/main.py`와 불일치하며 신규 `POST /api/analyze` 계약과 다름 | `CONTRACT-01` / `CLEAN-01` (`contracts/analysis.schema.json`과 동기화) |
| `frontend/README.md` | 14·60·109행 `9개 테마` / `18개` 표기, `frontend/docs/DOCKER.md` `node .claude/hooks/backup-guard.mjs` | 실제 토큰은 10개 테마 20개 팔레트(BASE-01 확인); `.claude/`는 로컬 미추적 제외 상태 | `CLEAN-01` (Vue 이식 후 문서 정리) |
| `reports/record-ui-2026-11-09/README.md` | `verified-rbmzeT/` 링크 등 | 파일 링크 자체는 유효하나 일부 과거 중간 증거는 `.backups/`에만 존재(BASE-01 5절 기록과 동일) | 보존 유지 (복사·재명명 금지) |

## 4. 기존 테스트 실행 결과 (2026-11-17 실측)

실행 환경: Windows, `Python 3.11.9` (가상환경 `.venv` 없음, `fastapi` 등 외부 패키지 미설치), `Node.js v26.13.0`, Playwright/Chromium 미설치(`CARDEX_PLAYWRIGHT`·`CARDEX_CHROMIUM` 미설정, `%TEMP%\aibootcamp-frontend-review\node_modules\playwright` 없음).

| 검사 항목 | 실행 명령 | 결과 | 원인·비고 |
|---|---|---|---|
| 백엔드 단위 테스트 | `python -m unittest discover -s backend/tests -v` | 9개 중 **8개 통과**, **1개 import 오류** (`test_main.py`) | `test_emotion_model.py` 8개 통과; `test_main.py`는 `ModuleNotFoundError: No module named 'fastapi'` |
| 루트 `tests/` (기본 환경) | `python -m unittest discover -s tests -v` | 9개 중 **8개 통과**, **1개 import 오류** (`services/test_analysis.py`) | `ml/test_predictor.py` 8개 통과(`backend.emotion_model` import); `services/test_analysis.py`는 `ModuleNotFoundError: No module named 'emotion_service'` |
| 루트 `tests/` (`PYTHONPATH=src`) | `$env:PYTHONPATH="src"; python -m unittest discover -s tests -v` | **15개 전부 통과** (`OK`) | `ml/test_predictor.py` 8개 + `services/test_analysis.py` 7개 |
| `design-lab/diary-flip-v1` 테스트 | `python -m unittest discover -s design-lab/diary-flip-v1 -v` | **3개 전부 통과** (`OK`) | `test_hierarchical_contract.py` |
| 프론트 단위 테스트 | `node --test frontend/tests/*.test.cjs` | **74개 중 73개 통과, 1개 실패** | 10개 `.test.cjs` 실행. 실패 1건: `frontend/tests/design-tokens.test.cjs` (`Stale generated file: styles/generated/tokens.css`) |
| 토큰·미리보기 일치 검사 | `node frontend/tools/build-tokens.mjs --check`, `build-design-preview.mjs --check` | **실패** (`Stale generated file: styles/generated/tokens.css`) | 실측 대조 결과 `compileTokens()` 출력(LF)과 디스크 `tokens.css`·`theme-tokens.js`(CRLF)의 **내용은 LF 정규화 시 완전 일치**(`css lf-norm: true`, `script lf-norm: true`), Windows 체크아웃 줄바꿈 차이로 인한 엄격 문자열 비교(`!==`) 실패 |
| 프론트 브라우저·와이어프레임 테스트 | `node frontend/tests/wireframes.cjs` | **미실행/실패** (`MODULE_NOT_FOUND: playwright`) | Playwright·Chrome 런타임 부재(BASE-01 8절과 동일) |

## 5. BASE-02 완료 기준 점검 및 후속 인계

- **중복 서버 정리 대상 확정**: `backend/main.py` + `backend/emotion_model.py`를 단일 기준(`backend/app/`)으로 통합하고, `src/emotion_service/`의 `parse_lines` 검증·모듈 계층 구조만 참고 이관한 뒤 `DEFAULT_CHECKPOINT` 결함이 있는 `src/`·중복 `tests/`·`static/`을 검증 후 정리한다.
- **자산·보존 대상 확정**: `frontend/assets/characters/` 9종(기존 `diary-3d-v1` 동일 해시)과 `frontend/assets/themes/` SVG 3종, `reports/`, `reference/`, `artifacts/emotional-dialogue-study/configs/`, `models/`, `.backups/`는 삭제하지 않고 보존한다.
- **후속 단계 선행 조건 충족**:
  - `STRUCT-01`은 본 이동표·import 목록을 기준으로 `backend/app/`, `backend/tests/`, `pyproject.toml`을 통합할 수 있다.
  - `CONTRACT-01`·`MODEL-01`은 `backend/requirements.txt` 환경(Python 3.12+ 가상환경 또는 Docker)에서 `test_main.py` 실행 및 신규 10감정 모델 명세 검증으로 이어간다.
  - `WEB-01`·`OPS-01` 진행 시 Windows 환경의 `tokens.css` CRLF 줄바꿈 불일치(`build-tokens.mjs --check`)를 `.gitattributes` 또는 줄바꿈 정규화 여부로 함께 점검한다.
