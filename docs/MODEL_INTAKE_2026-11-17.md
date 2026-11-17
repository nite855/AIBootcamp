# 제공 모델 인수 및 9분류 연결 계획 · MODEL-01/02 개정

기준일: 2026-11-17 (Asia/Seoul)  
상위 계획: [구조 전환 v3](MIGRATION_PLAN_2026-11-17.md) · [미완료 작업 및 담당](REMAINING_WORK_PLAN_2026-11-17.md)  
상태: **두 9분류 가중치와 앙상블 명세 제공됨 / 현재 앱 로더 연결·실제 추론·운영 성능 검증은 미완료**

이 문서는 이전의 “새 10감정 모델 미제공” 인수 계획을 대체한다. 코드·스키마가 이미 9분류로 바뀌었다는 의미는 아니다. 현재 backend/app의 모델 인수 게이트·로더는 10분류 기반이다.

## 1. 제공 자료와 판정

| 묶음 | 실제 구성 | 의미 |
|---|---|---|
| [weighted_CE_seed42](../tmp/weighted_CE_seed42/config.json) | config·label_mapping·selection, best_checkpoint/model.pt, tokenizer, encoder_config | 가중 CE 학습 KcELECTRA 9분류 |
| [weighted_RDrop_seed42](../tmp/weighted_RDrop_seed42/config.json) | 동일 형식, rdrop_alpha=1.0 | 가중 CE에 R-Drop 규제를 추가한 9분류 |
| [ensemble_seed42](../tmp/ensemble_seed42/ensemble.json) | manifest·예제·README. 독립 가중치 없음 | 두 모델의 9감정 확률을 50:50 평균하는 구성 |

두 config의 공통값은 기반 `beomi/KcELECTRA-base`, structure=FL, num_labels=9, input_unit=dialogue, max_length=256, head=dropout_then_linear_768_to9다. CE 선택 epoch=13·검증 Macro-F1=0.7239719896, RDrop 선택 epoch=4·검증 Macro-F1=0.7242157403이다. 이는 제공 selection 메타데이터 수치이며 이번 작업에서 평가를 재실행한 값이 아니다. 앙상블 검증/테스트 성능·클래스별 결과·운영 지연은 미확인이다.

중요 정정: 제공 예제는 IH 구조일 때만 가지를 선택한다. 이번 FL 구성은 전체 9개 logits에 softmax를 적용한다. **선택 가지 조건부 확률 모델이라는 이전 설명은 잘못됐으며 9감정 전체 확률 모델로 인수한다.**

기존 models/emotion-kcelectra의 6감정 모델은 참고용으로 보존한다. 새 9분류로 6개 라벨을 임의 변환하지 않는다.

## 2. 9분류 매핑과 출력 계약

[상위 계획 4절](MIGRATION_PLAN_2026-11-17.md#4-9분류-계약과-카드-판정)의 명시 매핑을 사용한다. 모델 인덱스 3=분노는 neg_3, 5=불안은 neg_1이다. 인덱스 위치를 앱 ID 순서로 간주하지 않는다. 마지막 라벨 놀람·당황은 새 taxonomy의 neu_3이며 neu_4는 없다.

목표 taxonomy=emotion-cardex-3plus9-v1, 운영 인터페이스는 predict_record(text)다. model_version, input_tokens, truncated, 전체 9개 probabilities를 반환하고 API가 대표값·동률·카드를 판정한다. 분류 확률 합계는 1±1e-6, 각 값은 유한한 0~1이며 bool·NaN·라벨 누락·추가를 거부한다.

앙상블은 두 모델의 label별 확률을 0.5씩 평균한다. logits 평균·대표 라벨 투표·평균 후 재-softmax를 사용하지 않는다. 대분류 통계는 9개 확률의 해당 소속 합계이며 별도 계층 헤드 확률로 바꾸지 않는다.

## 3. 현재 로더와 제공 포맷의 차이

현재 [predictor.py](../backend/app/ml/predictor.py)는 model.safetensors와 id2label·model_manifest.json을 전제로 AutoModelForSequenceClassification을 사용한다. 제공 가중치는 AutoModel encoder + 별도 9-class linear head의 state_dict인 model.pt이고 label_mapping.json으로 의미를 설명한다. 파일명만 바꿔 넣는 것으로 호환되지 않는다.

제공 inference_example.py의 구현을 검토해 backend/app/ml 내부 어댑터로 연결한다. 로컬 encoder 설정·tokenizer를 사용하고 torch.load(weights_only=True) 및 strict state_dict 검사를 적용한다. 현재 10감정 mock도 9분류 계약으로 갱신하고 실제 모드와 명확히 구별한다.

앙상블 예제는 학습자의 Windows 절대경로를 우선 사용한다. 운영에서는 명시 상위 모델 디렉터리 안의 두 구성원을 상대경로로 지정한다. Linux Path.name은 Windows 역슬래시 경로의 basename을 추출하지 못하므로 원본 fallback을 그대로 복사하지 않는다. 컨테이너는 세 형제 디렉터리를 함께 읽을 수 있는 상위 묶음을 마운트한다.

## 4. 입력 길이와 분석 불가 정책

API 입력 한도는 Unicode 코드포인트 10,000자로 기존 기록 저장 한도와 맞춘다. 모델 입력은 special token을 포함한 tokenizer 결과 최대 256토큰이다. tokenizer의 model_max_length=512와 encoder의 max_position_embeddings=512는 학습 설정 256을 임의로 늘리는 근거가 아니다.

전체 입력을 truncation=False로 먼저 세고 256 이하만 추론한다. 초과하면 status=error·truncated=true·error_code=INPUT_TRUNCATED·카드 필드 null인 분석 불가 응답을 사용한다. 원문을 자르거나 앞 256토큰만 분석한 카드를 발급하지 않는다. 장문 분할·집계는 별도 평가와 계약 없이 도입하지 않는다.

입력 공백·널·형식 오류는 422, 모델 미준비는 503, 추론 내부 오류·잘못된 확률 출력은 500으로 처리한다. 분석 실패가 기록 보관을 취소하거나 원문을 삭제하지 않게 한다.

## 5. 실제 인수 체크리스트와 상태

| 항목 | 현재 확인 | 후속 완료 조건 |
|---|---|---|
| 가중치·tokenizer·encoder 설정 | 두 모델에 파일 존재 | 실제 오프라인 로딩·같은 입력 전처리·손상 파일 거부 |
| 라벨·구조 | 9개, FL, 256토큰 메타데이터 확인 | 명시 9개 앱 ID 매핑과 실제 출력 검사 |
| SHA-256 | 이전 조사에서 model.pt 두 값이 ensemble.json과 일치 | 운영 복사본에서 재확인하고 재현 manifest 기록 |
| 앙상블 구성 | 두 구성원, 0.5/0.5 확인 | 실제 단일 출력 평균과 앙상블 응답 수치 일치 |
| 모델 메타데이터 | 기존 학습 경로·환경 정보 포함 | 모델 버전·가중치 해시·라벨·길이·출력 종류·소속을 인수 manifest로 고정 |
| 긴 입력 | 예제는 자동 절삭 | 서비스 256토큰 전후·한글/줄바꿈·원문 보존 검사 |
| 실제 실행·자원 | 미실행·미측정 | CPU/GPU 지원·RAM/VRAM·cold start·지연·동시 요청 측정 |
| 모델 선택·품질 | 단일 모델 검증 Macro-F1만 제공 | 동일 검증 자료·자원 측정 후 앙상블/단일 운영 선택 근거 기록 |
| 앱 전체 연결 | 현 로더 10분류 | 실제 모델 ready→POST→카드→통계/도감→복원까지 통과 |
| 평가 샘플 | 기존 fixture 10분류 | 전체 9분류와 경계·길이·복수 감정 샘플로 갱신. 예측 라벨의 정답 단정 없이 검수 |

운영 후보는 제공된 앙상블을 기본으로 평가한다. 모델 파일이 준비됐다는 이유만으로 서비스 ready를 보고하지 않고, 로딩·라벨·해시·기준 추론 검수 후 준비 상태를 결정한다. 라이브러리·장치·정밀도·worker 수는 실제 환경에서 검증한다.

## 6. 담당과 최종 산출물

ML·BE가 N9-MODEL을 맡아 기존 predict_record·health·API 오류 인터페이스를 유지하며 어댑터를 연결한다. 인프라는 모델 묶음 볼륨·device·메모리·유예 시간·추론 timeout을 확인한다. FE·QA는 새 9분류 응답과 구형 분석 저장의 호환성을 검증한다.

최종 산출물은 모델 인수 manifest, 라벨 매핑, 실제 단일/앙상블 추론 결과, 입력 한도·오류 검증, 자원·지연 측정표, model_version을 포함한 앱 통합 결과다. 소스가 제공한 학습 성능 수치와 직접 실행한 결과를 구분해 기록한다.

카드 연동 조건도 갱신했다. 사용자 최종 수정 파일명 기준으로 9감정×3단계 원본 27장이 확보되었으며, 파일명의 놀람 3장은 모델의 통합 라벨 놀람·당황(neu_3)에 대응한다. 정확한 원본·키 연결은 [카드 이미지 인수 확인서](CARD_ASSET_INTAKE_2026-11-17.md)를 따른다. 앱 연결·렌더링 검증은 별도 미완료 작업이다.
