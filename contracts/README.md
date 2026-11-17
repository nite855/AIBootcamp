# 분석·카드 판정 계약 (`CONTRACT-01`)

기준일: 2026-11-17  
상위 계획: [전환 계획서](../docs/MIGRATION_PLAN_2026-11-17.md) (4절·5.2절·`CONTRACT-01`)

> 개정 상태: 현재 이 디렉터리의 스키마·fixture와 아래 설명은 기존 10분류 구현이다. 사용자 지시에 따른 최신 목표는 **9분류·taxonomy `emotion-cardex-3plus9-v1`·27개 카드 키**이며 [9분류 완성 계획](../docs/REMAINING_WORK_PLAN_2026-11-17.md)의 `N9-CONTRACT`에서 코드·소비자와 함께 전환한다. 이번 문서 개정만으로 계약 파일이 9분류로 변경된 것은 아니다.

## 구성 파일

- [analysis.schema.json](analysis.schema.json): `POST /api/analyze` 요청·응답·오류 스키마 및 `x-cardex-contract` 규칙 메타데이터
- [card-boundaries.json](fixtures/card-boundaries.json): `1/3±ε`, `2/3±ε`, `1/3`, `2/3`, `1`, 균등 분포, 동률, 허용 오차 내 합계 경계 벡터(16건)
- [invalid-distributions.json](fixtures/invalid-distributions.json): `p=0`, 범위 초과, 합계 오차(`> 1e-6`), 키 누락/추가, 구형 6/7라벨, 비수치/불리언, `truncated=true`, 버전 불일치 거부 사례(17건)
- [api-cases.json](fixtures/api-cases.json): `POST /api/analyze` 200 성공·잘림 불가, 10,000코드포인트 경계, 422 입력 오류, 503 모델 미준비, 500 추론·출력 오류 사례
- [model-intake-samples.json](fixtures/model-intake-samples.json): `MODEL-01` 새 모델 인수 시 10감정 의미·합계·줄바꿈·잘림 검수용 합성 샘플 세트(12건), 기준 문서 [MODEL_INTAKE_2026-11-17.md](../docs/MODEL_INTAKE_2026-11-17.md)

## 핵심 규칙 요약

1. **감정 ID 순서 (`emotion-cardex-3plus10-v1`)**: `pos_1`, `pos_2`, `pos_3`, `neg_1`, `neg_2`, `neg_3`, `neu_1`, `neu_2`, `neu_3`, `neu_4`.
2. **카드 판정 (엄격 초과 `>`)**: `p = max(probabilities)` 기준 `p > 2/3 → 3`, `p > 1/3 → 2`, `p > 0 → 1`. `33.3%`·`66.7%` 등 반올림 문자열로 비교하지 않으며 기존 `blank` 구간은 폐기된다.
3. **유효성·동률**: 10개 키가 모두 `0..1` 유한수이고 합계 오차가 `1e-6` 이하이어야 한다. `p = 0`은 정상 합계 1 분포가 아니므로 무효 분포(`invalid_sum`)다. 동률은 `dominant_ratio == p[id]`로 판별해 분류 ID 순서 첫 번째를 `dominant_emotion`으로 삼고 `ties` 목록을 보존한다.
4. **본문 한도·HTTP 상태**: `text`는 Unicode 코드 포인트(`Python len(text)`, `JS Array.from(text).length`) 기준 `1..10000`자이며 공백 전용·널 바이트·누락 필드는 `422`, 모델 미준비는 `503`, 추론 오류 및 잘못된 모델 확률 출력은 `500`으로 구분한다. 응답에 원문 `text`를 복제하지 않는다.

## 양쪽 언어 검증 명령

```powershell
python -m unittest backend/tests/test_contract.py -v
node --test frontend/tests/contract.test.cjs
```
