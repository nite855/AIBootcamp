# 감정 분석 웹 MVP

Python 3.12, FastAPI, Uvicorn, Chart.js로 만든 최소 기능의 감정 분석 웹 앱입니다. 입력을 줄 단위로 분석하고 줄별 점수를 꺾은선 그래프로 표시합니다.

현재 `analyzer.py`의 `Analyzer`는 실제 모델 대신 간단한 단어 사전 기반 Mock입니다. 실제 모델을 사용할 때는 `predict(text: str) -> float` 인터페이스를 유지한 채 구현을 교체하면 됩니다.

## Docker로 실행

```bash
docker build -t sentiment-mvp .
docker run --rm -p 8000:8000 sentiment-mvp
```

브라우저에서 <http://localhost:8000>을 엽니다.

## 로컬에서 실행

Python 3.12 환경에서 다음 명령을 실행합니다.

```bash
python -m venv .venv
# Windows PowerShell
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload
```

## API

- `GET /`: 입력 및 차트 화면
- `POST /api/analyze`: 입력 문자열을 줄 단위로 분석

요청 예시:

```json
{
  "text": "오늘은 행복\n\n어제는 슬프다"
}
```

응답 예시:

```json
{
  "lines": ["오늘은 행복", "어제는 슬프다"],
  "scores": [0.5, -0.5]
}
```
