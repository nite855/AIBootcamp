# 오늘의 모먼트

Diary Simple v3를 메인 프론트로 사용하는 일기·감정 카드 프로젝트입니다. 프론트는 기록 작성·보관함·통계·캐릭터 도감·테마와 예시 카드를 제공합니다. 블라썸 로즈 기본 테마와 3D 감정 카드, 카드 뒤집기·확대 읽기를 제공합니다. 실제 기록과 초안은 메인 전용 IndexedDB에 보관되며 새로고침 후 복원됩니다. 계정·기기 간 동기화·서버 백업은 제공하지 않습니다.

기존 FastAPI 백엔드는 로컬 KcELECTRA 체크포인트로 한국어 문장을 `분노`, `슬픔`, `불안`, `상처`, `당황`, `기쁨` 중 하나로 분류합니다. 프론트의 10감정 체계와 기존 6감정 API는 아직 연결하지 않았습니다. 실제 글은 프론트에서 분석 대기로 표시되며 예시 모드에서만 분석된 카드를 확인할 수 있습니다.

## 프로젝트 구조

```text
frontend/                   메인 프론트와 단일 HTML 빌드 결과
  scripts/ styles/ templates/  모듈 소스
  tools/ tests/ docs/          빌드·검증·디자인 문서
backend/
  main.py                   FastAPI 진입점
  emotion_model.py          체크포인트 탐색·추론·CLI
  requirements.txt          Python 의존성
  tests/                    모델 가중치 없이 실행하는 단위 테스트
design-lab/                 시안 실험실 · 기존 시안과 글래스 시안
  emotion-mvp/index.html    이전 루트 MVP 화면 보존본
reports/                    기존 시안 비교 보고서
image/                      디자인 참고 자산
```

시안 목록은 [Design Lab](design-lab/README.md), 새 [프로스트 글래스 시안](design-lab/diary-glass-v1/index.html)과 [타깃 분석](design-lab/diary-glass-v1/docs/REVIEW.md)을 참고하세요.

## 프론트 단독 실행

`frontend/index.html`을 브라우저에서 직접 엽니다. 서버·모델·인터넷 없이 사용할 수 있습니다. 개발 시 Node.js로 소스를 빌드합니다.

```powershell
node frontend/tools/build.mjs
```

자세한 동작·테스트·디자인 문서는 [프론트 README](frontend/README.md)를 참고하세요. 테마 저장 키는 기존 v3 값을 유지합니다. 브라우저는 파일 URL과 서버 URL의 저장소를 구분하므로 실행 주소를 바꾸면 테마를 다시 선택해야 할 수 있습니다.

이전 MVP 화면은 보존용입니다. 파일을 직접 열어서는 상대 경로 `/api/analyze`를 호출할 수 없으며, 서버 기본 화면은 메인 프론트로 변경되었습니다.

## 모델 경로

앱은 다음 순서로 체크포인트를 찾습니다.

1. `EMOTION_MODEL_DIR`로 지정한 체크포인트 폴더
2. `EMOTION_STUDY_DIR`로 지정한 실험 결과 폴더에서 validation 성능이 가장 높은 체크포인트
3. 프로젝트와 함께 둔 `emotional-dialogue-input-study-20261007-v1` 폴더
4. 저장소 상위 디렉터리의 `experiments/emotional-dialogue-input-study-20261007-v1` 폴더
5. `Downloads` 아래 압축 해제된 동일 실험 폴더

체크포인트 폴더에는 최소한 `config.json`, `model.safetensors`, `tokenizer_config.json`이 있어야 합니다.

## 실행 방법 선택

저장소 루트에서 Python 3.12 환경으로 실행합니다. 기존 `uvicorn main:app` 명령은 아래의 새 모듈 경로로 변경되었습니다.

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt

$env:EMOTION_MODEL_DIR = "C:\path\to\checkpoint"
uvicorn backend.main:app --reload
```

모델이 프로젝트의 `models/emotion-kcelectra/checkpoint`에 없다면 체크포인트 경로를 지정합니다.

```powershell
$env:EMOTION_MODEL_DIR = "C:\path\to\checkpoint"
uvicorn emotion_service.main:app --reload
```

실험 폴더 전체를 사용하는 경우에는 다음처럼 설정할 수 있습니다.

```powershell
$env:EMOTION_STUDY_DIR = "C:\path\to\emotional-dialogue-input-study-20261007-v1"
uvicorn backend.main:app --reload
```

브라우저에서 <http://localhost:8000>을 열면 메인 프론트가 표시됩니다. 모델은 서버 시작 시 한 번만 로드됩니다. 서버 시작에는 유효한 체크포인트가 필요합니다. 모델 없이 화면을 확인할 때는 프론트 단독 실행을 사용하세요.

모델 CLI도 저장소 루트에서 실행합니다.

```powershell
python -m backend.emotion_model --checkpoint "C:\path\to\checkpoint" --text "오늘의 기록"
```

## 검증

```powershell
python -m unittest discover -s backend/tests -v
node --test frontend/tests/*.test.cjs
node frontend/tests/browser.cjs
node frontend/tests/themes.cjs
node frontend/tests/persistence-browser.cjs
node frontend/tools/build-wireframes.mjs
node frontend/tests/wireframes.cjs
```

Python 단위 테스트는 모델 가중치 없이 실행합니다. 브라우저 검사는 Playwright와 Chrome이 필요하며, `CARDEX_PLAYWRIGHT`와 `CARDEX_CHROMIUM`으로 경로를 지정할 수 있습니다.

Docker Compose는 로컬의 `src`, `web`, 모델 폴더를 컨테이너에 연결합니다. 최초 실행 전에 체크포인트 폴더의 절대 경로를 지정합니다.

먼저 `node frontend/tools/build.mjs`로 프론트를 빌드합니다. Docker는 생성된 `frontend/index.html`을 복사합니다. 모델 파일은 약 500MB이므로 이미지에 포함하지 않고 읽기 전용 볼륨으로 연결합니다.

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

## 기록 중심 기능 통합

메인에서 본문 검색·날짜 필터·즐겨찾기·월간 캘린더 탐색과 JSON 내보내기·가져오기를 제공합니다. 기존 메인 기록과 설정을 유지하며 Docker 시안의 기록은 JSON으로 선택 이전합니다. [사용법](frontend/README.md#메인-기능-통합-2026-11-11)과 [검증 결과](reports/frontend-integration/README.md)를 참고하세요.
