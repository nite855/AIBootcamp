# API 연결 계약과 구현 경계

## 현재 사실

저장소 main `7b991ba`의 FastAPI는 `POST /api/analyze {text}`로 줄마다 6분류(분노·슬픔·불안·상처·당황·기쁨)를 반환한다. 감정 도감의 pos_1–3, neg_1–3, neutral과 의미가 다르다. 이 UI는 해당 endpoint를 호출하거나 결과를 이름 변경하지 않는다.

최신 SDS가 제안하는 다음 endpoint는 향후 연결 계약이며 현재 서버 구현 완료를 뜻하지 않는다.

| Endpoint | 요청 | 응답/사용 |
|---|---|---|
| POST /api/conversation/parse | PC TXT multipart | parse_id, 전체텍스트수, 최근100개, 화자별표본, 시간누락수 |
| POST /api/analysis | parse_id, target_speaker, taxonomy_version | analysis_id, meta, emotion_summary, emotion_timeline, repeated_expressions, trend_segments |
| POST /api/analysis/narrative | analysis_id | status, JSON 사실에 한정한 설명 |
| POST /api/analysis/image | analysis_id, 승인asset_mapping_version | status, image 또는 빈 슬롯 원인 |

## 프론트엔드 정규화 형식

```json
{
  "id": "analysis-id",
  "taxonomy_version": "운영에서 확정할 버전",
  "demo": false,
  "speaker": "직접 선택한 화자",
  "recentCount": 100,
  "target": [{"id":"u-12","order":12,"timestamp":null,"speaker":"선택 화자","text":"원본 발화"}],
  "rows": [{
    "anchor":"u-12", "order":1, "timestamp":null,
    "status":"valid", "truncated":false,
    "probabilities":{"pos_1":0.18,"pos_2":0.15,"pos_3":0.12,"neg_1":0.25,"neg_2":0.09,"neg_3":0.06,"neutral":0.15}
  }]
}
```

`emotion-cardex-ui-demo-3plus7-v1`은 오직 UI fixture 버전이다. 운영 taxonomy 또는 학습 라벨 확정 버전으로 사용하지 않는다. timestamp는 대화의 시간대로 정규화한 ISO8601이며 현재 데모는 +09:00이다. 운영 어댑터는 다른 offset을 대화 시간대로 변환한 뒤 dateKey에 전달해야 한다.

## 연결 순서와 검증

1. 서버에서 taxonomy_version, 안정된 ID, 학습/평가 및 라벨 매핑을 먼저 확정한다.
2. 비텍스트 제외 후 전체 최근100개를 선택하고 화자 목록/표본을 반환한다. 이름으로 자동 선택하지 않는다.
3. 대상 화자 최대3개 윈도우, stride1, 첫 anchor, 장문 축소/재분석을 구현한다.
4. 어댑터에서 7ID 누락/추가, NaN·음수·1초과, 합계오차1e-6, truncated, 중복 anchor와 대상 외 anchor를 거절한다. 어댑터는 서버 부모합과 클라이언트 합의 일치도 검증해야 한다.
5. 전체기준7확률을 `aggregate`에 전달하고 부모합을 계산한다. 계층 모델이면 모든 부모의 조건부 출력으로 P(leaf)=P(parent)×P(leaf|parent)를 복원한다. 선택하지 않은 가지를0으로 만드는 hard gating은 허용하지 않는다.
6. stats가 성공하면 먼저 표시한다. narrative/image는 별도 status와 요청 ID를 갖는다. Promise.allSettled로 부분 실패를 관리하고 통계를 지우지 않는다. 자산 미승인은 이미지 실패와 구분한다.
7. AbortController와 request epoch로 이전 요청의 늦은 응답이 현재 화자/분석을 덮어쓰지 못하게 한다. 중복 실행을 차단하고 실패 후 파일·화자를 유지한다.
8. 실제 API E2E, 개인정보 처리 안내와 보관/삭제 정책을 검증한 후 demo=false 결과를 허용한다. 현재는 이 단계가 미완료이다.

## 파서 경계

데모는 `[화자] [오전/오후 h:mm] 메시지`와 PC의 날짜 구분선, 멀티라인을 지원한다. UTF-8 실패 시 EUC-KR로 읽는다. 사진·동영상·이모티콘·파일 등의 비텍스트 표식을 제외한다. 실제 카카오톡 버전별 포맷, 시스템 이벤트와 모든 첨부 표기의 완전한 처리는 운영 파서 시험 대상이다. 브라우저의5MB 한도는 데모의 메모리 보호값이며 확정된 서버 정책이 아니다.

## 상태

statistics: idle/loading/success/partial/error/empty/unanalyzable. narrative: idle/loading/success/error. image: unmapped/loading/success/error. 시간 없음은 유효한 통계의 metadata 상태이며 neutral과 다르다. 실패한 모델 결과에 임의 확률을 채우지 않는다. 미래 저장·획득·희귀도 기능은 분석 API와 별도 도메인으로 설계한다.

