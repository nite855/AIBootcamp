# 감정 분석 시스템 구조

## 개요

이 시스템은 여러 줄의 한국어 문장을 하나의 대화 흐름으로 받아 문장별 감정 확률과 전체 입력의 단어 사용 빈도를 시각화하는 단일 서버 애플리케이션이다. 빈 줄을 제외한 각 줄을 대화의 한 문장으로 취급하며, 한 요청에는 최대 100개 문장을 허용한다.

## 구성 요소

```text
브라우저 (web/index.html, Chart.js)
  └─ POST /api/analyze
       └─ FastAPI (src/emotion_service/api.py)
            ├─ 입력 정리 및 100줄 제한
            ├─ Counter 기반 단어 빈도 집계
            └─ EmotionPredictor (src/emotion_service/predictor.py)
                 └─ 로컬 KcELECTRA 체크포인트
```

### 웹 클라이언트

`web/index.html`은 별도의 빌드 과정이 없는 정적 화면이다.

- 입력 중 빈 줄을 제외한 문장 수를 표시하고, 100줄을 초과하면 분석 버튼을 비활성화한다.
- 분석 결과의 대표 감정과 신뢰도를 문장별로 표시한다.
- API가 반환한 단어 빈도를 내림차순 목록으로 표시한다.
- 각 감정을 하나의 데이터 계열로 두고, 문장 순서에 따른 확률 변화를 Chart.js 꺾은선 그래프로 표시한다.

### API 서버

`src/emotion_service/api.py`의 FastAPI 애플리케이션이 정적 화면과 분석 API를 제공한다.

1. 입력을 줄바꿈으로 나누고 빈 줄과 줄 앞뒤 공백을 제거한다.
2. 유효 문장이 없거나 100개를 초과하면 HTTP 422를 반환한다.
3. 각 문장을 `EmotionPredictor.predict()`에 개별 전달한다.
4. 모든 문장의 단어를 공백 기준으로 나누고 `collections.Counter`로 집계한다.
5. 문장 목록, 문장별 감정 결과, 빈도 내림차순 단어 목록을 한 응답으로 반환한다.

동일 빈도의 단어는 `Counter.most_common()`의 동작에 따라 입력에서 처음 등장한 순서를 유지한다.

### 감정 추론

`src/emotion_service/predictor.py`는 서버 시작 시 로컬 체크포인트를 한 번 로드한다. 각 문장은 독립적으로 추론되지만, 응답과 화면에서는 입력 순서대로 배열하여 전체 대화의 감정 변화로 표현한다. 모델 출력은 대표 감정, 대표 감정 확률, 전체 감정별 확률, 토큰 수, 잘림 여부를 포함한다.

## 요청 처리 흐름

```text
사용자 입력
  → 클라이언트 100줄 검사
  → POST /api/analyze
  → 서버 입력 정리 및 100줄 재검사
  → 문장별 감정 추론
  → 전체 단어 빈도 집계
  → JSON 응답
  → 문장별 결과 + 단어 빈도 + 감정 변화 그래프 렌더링
```

클라이언트 검사는 빠른 사용자 피드백을 위한 것이며, API를 직접 호출하는 경우도 보호하도록 서버가 같은 제한을 최종 적용한다.

## 실행 및 배포

- 애플리케이션: FastAPI/Uvicorn 단일 프로세스
- 모델: 로컬 파일 시스템에 저장된 PyTorch/Transformers 체크포인트
- 프런트엔드: FastAPI가 `/`에서 제공하는 정적 HTML
- 컨테이너: 모델을 이미지에 포함하지 않고 읽기 전용 볼륨으로 연결

모델 추론은 요청 안에서 문장 수만큼 순차 실행된다. 최대 100줄 제한은 과도한 추론 시간과 메모리 사용을 제한하는 경계이기도 하다.

## 관련 파일

- `src/emotion_service/api.py`: HTTP API, 입력 검증, 단어 빈도 집계
- `src/emotion_service/predictor.py`: 체크포인트 선택 및 감정 추론
- `web/index.html`: 입력 화면과 결과 시각화
- `docs/openapi.yaml`: 분석 API 계약
- `tests/`: API 및 추론 단위 테스트
- `models/emotion-kcelectra/`: 로컬 서빙 체크포인트와 추론 메타데이터
- `artifacts/emotional-dialogue-study/`: 학습 설정과 평가 산출물
