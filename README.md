# 감정 분석 웹 MVP

로컬 KcELECTRA 체크포인트로 한국어 문장을 `분노`, `슬픔`, `불안`, `상처`, `당황`, `기쁨` 중 하나로 분류하는 FastAPI 앱입니다. 최대 100줄을 하나의 대화 흐름으로 받아 문장별 감정 변화와 공백 기준 단어 사용 빈도를 표시합니다.

## 모델 경로

앱은 다음 순서로 체크포인트를 찾습니다.

1. `EMOTION_MODEL_DIR`로 지정한 체크포인트 폴더
2. `EMOTION_STUDY_DIR`로 지정한 실험 결과 폴더에서 validation 성능이 가장 높은 체크포인트
3. 프로젝트와 함께 둔 `emotional-dialogue-input-study-20261007-v1` 폴더
4. `Downloads` 아래 압축 해제된 동일 실험 폴더

체크포인트 폴더에는 최소한 `config.json`, `model.safetensors`, `tokenizer_config.json`이 있어야 합니다.

## 로컬 실행

Python 3.12 환경에서 실행합니다.

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt

$env:EMOTION_MODEL_DIR = "C:\path\to\checkpoint"
uvicorn main:app --reload
```

현재 실험 폴더 전체를 사용하는 경우에는 다음처럼 설정할 수 있습니다.

```powershell
$env:EMOTION_STUDY_DIR = "C:\path\to\emotional-dialogue-input-study-20261007-v1"
uvicorn main:app --reload
```

브라우저에서 <http://localhost:8000>을 엽니다. 모델은 서버 시작 시 한 번만 로드됩니다.

## Docker 실행

모델 파일은 약 500MB이므로 이미지에 포함하지 않고 읽기 전용 볼륨으로 연결합니다.

```powershell
docker build -t emotion-mvp .
$model = "C:\path\to\checkpoint"
docker run --rm -p 8000:8000 -v "${model}:/models/checkpoint:ro" emotion-mvp
```

## API

`POST /api/analyze`

요청:

```json
{
  "text": "오늘은 정말 행복해.\n내일 면접이라 너무 불안해."
}
```

응답:

```json
{
  "lines": ["오늘은 정말 행복해.", "내일 면접이라 너무 불안해."],
  "predictions": [
    {
      "emotion": "기쁨",
      "confidence": 0.94,
      "probabilities": {
        "분노": 0.01,
        "슬픔": 0.01,
        "불안": 0.01,
        "상처": 0.01,
        "당황": 0.02,
        "기쁨": 0.94
      },
      "input_tokens": 12,
      "truncated": false
    },
    {
      "emotion": "불안",
      "confidence": 0.86,
      "probabilities": {
        "분노": 0.02,
        "슬픔": 0.03,
        "불안": 0.86,
        "상처": 0.03,
        "당황": 0.04,
        "기쁨": 0.02
      },
      "input_tokens": 14,
      "truncated": false
    }
  ],
  "word_frequencies": [
    {"word": "오늘은", "count": 1},
    {"word": "정말", "count": 1},
    {"word": "행복해.", "count": 1},
    {"word": "내일", "count": 1},
    {"word": "면접이라", "count": 1},
    {"word": "너무", "count": 1},
    {"word": "불안해.", "count": 1}
  ]
}
```

`confidence`는 감정의 강도가 아니라 모델이 선택한 클래스의 확률입니다.
상세 구조와 API 계약은 각각 `architecture.md`, `openapi.yaml`에서 확인할 수 있습니다.
