# 일기 감정 분석 3→7 계약 및 검증 현황

## 범위와 현재 상태
시안의 표시명은 긍정: 기쁨(pos_1), 만족(pos_2), 평온(pos_3), 부정: 슬픔(neg_1), 분노(neg_2), 불안(neg_3), 중립(neutral)이다. taxonomy_version은 diary-hierarchical-3x7-v1이다. 실제 입력은 아직 분석 대기이며 API 연결은 없다.

기존 backend/main.py의 /api/analyze는 기쁨·슬픔·불안·분노·상처·당황을 출력하는 6분류다. 이를 7분류처럼 변환하거나 중립을 추정하지 않는다. 새 모델, 학습 데이터, 검증 지표, 체크포인트가 확보되기 전에는 실제 추론에 사용하지 않는다.

## 구현된 확률 계약
hierarchical_contract.combine은 전체 기준 3부모 확률, 긍정 내부 3조건부 확률, 부정 내부 3조건부 확률을 검증한다. 각 부모 확률에 대응 자식의 조건부 확률을 곱하고 neutral은 부모 중립 확률을 유지한다. 대표 대분류와 전체 기준 최다 소분류를 따로 산출한다. 잘못되거나 빠진 확률을 임의 보정하지 않는다. 이 모듈은 추론기나 API가 아니다.

## 추후 API 제안 (미구현)
요청: record_id, record_version, text, taxonomy_version.
성공: record_id, record_version, taxonomy_version, model_version, status=valid, parents, probabilities, representative_parent, top_subcategory.
실패: 같은 record_id와 record_version, status=error 또는 unavailable, 기계 판독 가능한 오류 코드. 빈 입력·초과 길이·입력 잘림·서버 실패를 별도 처리한다. 원문은 서버 로그나 오류 메시지에 기록하지 않는다. 토큰 길이 초과의 분할 및 집계 방식과 모델별 입력 길이는 실제 모델 기준으로 확정한다. JSON은 제안이며 실제 엔드포인트가 아니다.

기록이 수정되거나 삭제된 후 늦게 도착한 결과는 record_id와 record_version을 확인하여 버린다. 실패와 데이터 없음은 중립이 아니다. 이전 라벨 매핑의 valid 결과는 현재 분류로 재해석하지 않으며 복원 시 previousAnalysis로 보존하고 pending 처리한다.

## 평가 전제
데이터 라이선스와 문장 단위 및 3+7 라벨 정책을 확인하고 독립된 일기 평가셋을 분리한다. 동일한 입력·분할에서 1단계 7분류와 2단계 모델을 비교하며 전체 Macro F1, 클래스별 precision/recall/F1, 혼동행렬 및 확률 보정을 보고한다. 현재 성능 및 모델 준비 완료 여부는 확인되지 않았다.

## 검증
python -m unittest -v test_hierarchical_contract.py (이 디렉터리에서 실행). 계약 검사는 모델 학습·분석 정확도나 API 동작을 입증하지 않는다. IndexedDB의 새로고침 복원, 실패·여러 탭 충돌, 모바일 터치와 접근성은 실제 브라우저 검증 대기이다.
