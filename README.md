# 감정 분석 웹 MVP

로컬 KcELECTRA 체크포인트로 한국어 문장을 `분노`, `슬픔`, `불안`, `상처`, `당황`, `기쁨` 중 하나로 분류하는 FastAPI 앱입니다. 최대 100줄을 하나의 대화 흐름으로 받아 문장별 감정 변화와 공백 기준 단어 사용 빈도를 표시합니다.

## 모델 경로

앱은 다음 순서로 체크포인트를 찾습니다.

1. `EMOTION_MODEL_DIR`로 지정한 체크포인트 폴더
2. `EMOTION_STUDY_DIR`로 지정한 실험 결과 폴더에서 validation 성능이 가장 높은 체크포인트
3. 프로젝트의 `models/emotion-kcelectra/checkpoint` 폴더
4. `Downloads` 아래 압축 해제된 동일 실험 폴더

체크포인트 폴더에는 최소한 `config.json`, `model.safetensors`, `tokenizer_config.json`이 있어야 합니다.

## 실행 방법 선택

아래 방법은 순서대로 모두 실행하는 단계가 아니라, 환경과 목적에 따라 하나를 선택하는 실행 방법입니다.

| 환경과 목적 | 실행 방법 |
| --- | --- |
| Docker가 없거나 Python으로 직접 개발 | Python 가상환경 |
| Docker 안에서 코드를 수정하며 개발 | Docker Compose |
| 완성된 Docker 이미지를 단독 실행 | `docker build` + `docker run` |

어느 방법을 사용하든 브라우저에서 <http://localhost:8000>을 엽니다. 모델은 서버가 시작될 때 로드됩니다.

## Python 가상환경으로 실행

Docker가 없어도 Python 3.12가 설치되어 있으면 가상환경에서 실행할 수 있습니다.

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install -e .

uvicorn emotion_service.main:app --reload
```

모델이 프로젝트의 `models/emotion-kcelectra/checkpoint`에 없다면 체크포인트 경로를 지정합니다.

```powershell
$env:EMOTION_MODEL_DIR = "C:\path\to\checkpoint"
uvicorn emotion_service.main:app --reload
```

실험 폴더 전체를 사용하는 경우에는 다음처럼 설정할 수 있습니다.

```powershell
$env:EMOTION_STUDY_DIR = "C:\path\to\emotional-dialogue-input-study-20261007-v1"
uvicorn emotion_service.main:app --reload
```

## Docker Compose로 개발

Docker Compose는 로컬의 `src`, `web`, 모델 폴더를 컨테이너에 연결합니다. 최초 실행 전에 체크포인트 폴더의 절대 경로를 지정합니다.

```powershell
$env:EMOTION_MODEL_PATH = "C:\path\to\checkpoint"
docker compose up --build
```

실행 후에는 다음 기준으로 변경 사항을 반영합니다.

- `src/` 변경: Uvicorn이 서버를 자동으로 다시 시작합니다. 모델도 다시 로드됩니다.
- `static/` 변경: 이미지를 다시 빌드하지 않고 브라우저를 새로 고치면 반영됩니다.
- `requirements.txt` 또는 `Dockerfile` 변경: `docker compose up --build`로 이미지를 다시 빌드합니다.
- 모델 파일 변경: `docker compose restart`로 서버와 모델을 다시 로드합니다.

컨테이너를 종료하고 제거하려면 다음 명령을 사용합니다.

```powershell
docker compose down
```

## Docker 이미지 단독 실행

코드 자동 반영이 필요 없는 실행 또는 배포 확인에는 이미지를 직접 빌드하고 실행할 수 있습니다. 모델 파일은 약 500MB이므로 이미지에 포함하지 않고 읽기 전용 볼륨으로 연결합니다.

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
상세 구조와 API 계약은 각각 `docs/architecture.md`, `docs/openapi.yaml`에서 확인할 수 있습니다.

## 프로젝트 구조

```text
src/emotion_service/   FastAPI 서버와 감정 추론 코드
static/                   정적 웹 화면
tests/                 단위 테스트
docs/                  구조 및 API 문서
models/                로컬 서빙 모델(Git 제외)
artifacts/             학습 설정과 평가 결과
```

