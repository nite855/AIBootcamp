# 오늘의 모먼트 시스템 구조

기준일: 2026-11-17

## 개요

**오늘의 모먼트**는 Vue 3 프론트엔드, FastAPI 백엔드 API, 별도 PostgreSQL 16 RDBMS 컨테이너로 구성된 감정 일기·대화 분석 및 카드 수집 서비스다.

- **인증 및 동의:** JWT Access Token(메모리 보관) + HttpOnly SameSite=Lax Refresh Token Rotation 방식을 사용하며, 회원가입 및 로그인 시 한국 「개인정보 보호법」(제15조, 제22조, 제22조의2, 제23조)에 따라 만 14세 이상 확인·개인정보 수집·이용·민감정보(대화/감정 데이터) 처리 동의를 분리 수집·검증한다.
- **영속 저장:** 계정 정보, 동의·철회 감사 이력, 계정별 대화/일기 기록(계정당 최대 100편), 감정 분석 결과, 수집 카드 도감(27슬롯)을 PostgreSQL 컨테이너(`postgres_data` 볼륨)에 저장한다.

## 컨테이너 구성 (`compose.yaml`)

```text
브라우저 (Vue 3 SPA)
  └─ Nginx (:8080, web 컨테이너)
       ├─ /           → 정적 SPA 번들 (frontend/dist)
       └─ /api/       → FastAPI (api:8000, Cache-Control: no-store)
                            ├─ KcELECTRA 감정 추론 (/models/checkpoint:ro)
                            └─ PostgreSQL 16 (postgres:5432, postgres_data 볼륨)
```

## 핵심 백엔드 모듈 (`backend/app/`)

- `core/config.py`, `core/security.py`: 환경변수 설정, Argon2 비밀번호 해싱, JWT Access Token 발급/검증, Refresh Token 해싱, 동의 로그 메타데이터 해싱
- `db/models.py`, `db/session.py`, `db/consent_seed.py`, `db/migrations/`: SQLAlchemy ORM 모델(`users`, `refresh_tokens`, `consent_policies`, `user_consents`, `user_consent_logs`, `diary_records`, `collected_cards`) 및 Alembic 마이그레이션
- `api/auth.py`, `services/auth_service.py`, `services/consent_service.py`: 회원가입, 로그인(Consent Gate), 토큰 갱신/로그아웃, 동의 갱신/선택 철회, 회원 탈퇴 및 즉시 파기
- `api/records.py`, `services/record_service.py`, `api/analyze.py`: 계정별 기록 CRUD(한도 100편), 일괄 가져오기(`/api/records/import`), 2차 확인 기반 기록 및 해금 카드 삭제, 감정 분석(`POST /api/analyze`)과 `collected_cards` 원자적 갱신
- `api/health.py`: `/api/health/live` 및 모델+DB 연결 상태를 점검하는 `/api/health/ready`
