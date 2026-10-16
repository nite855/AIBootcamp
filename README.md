# ���� �м� �� MVP

���� KcELECTRA üũ����Ʈ�� �ѱ��� ������ `�г�`, `����`, `�Ҿ�`, `��ó`, `��Ȳ`, `���` �� �ϳ��� �з��ϴ� FastAPI ���Դϴ�. �ִ� 100���� �ϳ��� ��ȭ �帧���� �޾� ���庰 ���� ��ȭ�� ���� ���� �ܾ� ��� �󵵸� ǥ���մϴ�.

## �� ���

���� ���� ������ üũ����Ʈ�� ã���ϴ�.

1. `EMOTION_MODEL_DIR`�� ������ üũ����Ʈ ����
2. `EMOTION_STUDY_DIR`�� ������ ���� ��� �������� validation ������ ���� ���� üũ����Ʈ
3. ������Ʈ�� `models/emotion-kcelectra/checkpoint` ����
4. `Downloads` �Ʒ� ���� ������ ���� ���� ����

üũ����Ʈ �������� �ּ��� `config.json`, `model.safetensors`, `tokenizer_config.json`�� �־�� �մϴ�.

## ���� ��� ����

�Ʒ� ����� ������� ��� �����ϴ� �ܰ谡 �ƴ϶�, ȯ��� ������ ���� �ϳ��� �����ϴ� ���� ����Դϴ�.

| ȯ��� ���� | ���� ��� |
| --- | --- |
| Docker�� ���ų� Python���� ���� ���� | Python ����ȯ�� |
| Docker �ȿ��� �ڵ带 �����ϸ� ���� | Docker Compose |
| �ϼ��� Docker �̹����� �ܵ� ���� | `docker build` + `docker run` |

��� ����� ����ϵ� ���������� <http://localhost:8000>�� ���ϴ�. ���� ������ ���۵� �� �ε�˴ϴ�.

## Python ����ȯ������ ����

Docker�� ��� Python 3.12�� ��ġ�Ǿ� ������ ����ȯ�濡�� ������ �� �ֽ��ϴ�.

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install -e .

uvicorn emotion_service.main:app --reload
```

���� ������Ʈ�� `models/emotion-kcelectra/checkpoint`�� ���ٸ� üũ����Ʈ ��θ� �����մϴ�.

```powershell
$env:EMOTION_MODEL_DIR = "C:\path\to\checkpoint"
uvicorn emotion_service.main:app --reload
```

���� ���� ��ü�� ����ϴ� ��쿡�� ����ó�� ������ �� �ֽ��ϴ�.

```powershell
$env:EMOTION_STUDY_DIR = "C:\path\to\emotional-dialogue-input-study-20261007-v1"
uvicorn emotion_service.main:app --reload
```

## Docker Compose�� ����

Docker Compose�� ������ `src`, `web`, �� ������ �����̳ʿ� �����մϴ�. ���� ���� ���� üũ����Ʈ ������ ���� ��θ� �����մϴ�.

```powershell
$env:EMOTION_MODEL_PATH = "C:\path\to\checkpoint"
docker compose up --build
```

���� �Ŀ��� ���� �������� ���� ������ �ݿ��մϴ�.

- `src/` ����: Uvicorn�� ������ �ڵ����� �ٽ� �����մϴ�. �𵨵� �ٽ� �ε�˴ϴ�.
- `static/` ����: �̹����� �ٽ� ������� �ʰ� �������� ���� ��ġ�� �ݿ��˴ϴ�.
- `requirements.txt` �Ǵ� `Dockerfile` ����: `docker compose up --build`�� �̹����� �ٽ� ����մϴ�.
- �� ���� ����: `docker compose restart`�� ������ ���� �ٽ� �ε��մϴ�.

�����̳ʸ� �����ϰ� �����Ϸ��� ���� ����� ����մϴ�.

```powershell
docker compose down
```

## Docker �̹��� �ܵ� ����

�ڵ� �ڵ� �ݿ��� �ʿ� ���� ���� �Ǵ� ���� Ȯ�ο��� �̹����� ���� ����ϰ� ������ �� �ֽ��ϴ�. �� ������ �� 500MB�̹Ƿ� �̹����� �������� �ʰ� �б� ���� �������� �����մϴ�.

```powershell
docker build -t emotion-mvp .
$model = "C:\path\to\checkpoint"
docker run --rm -p 8000:8000 -v "${model}:/models/checkpoint:ro" emotion-mvp
```

## API

`POST /api/analyze`

��û:

```json
{
  "text": "������ ���� �ູ��.\n���� �����̶� �ʹ� �Ҿ���."
}
```

����:

```json
{
  "lines": ["������ ���� �ູ��.", "���� �����̶� �ʹ� �Ҿ���."],
  "predictions": [
    {
      "emotion": "���",
      "confidence": 0.94,
      "probabilities": {
        "�г�": 0.01,
        "����": 0.01,
        "�Ҿ�": 0.01,
        "��ó": 0.01,
        "��Ȳ": 0.02,
        "���": 0.94
      },
      "input_tokens": 12,
      "truncated": false
    },
    {
      "emotion": "�Ҿ�",
      "confidence": 0.86,
      "probabilities": {
        "�г�": 0.02,
        "����": 0.03,
        "�Ҿ�": 0.86,
        "��ó": 0.03,
        "��Ȳ": 0.04,
        "���": 0.02
      },
      "input_tokens": 14,
      "truncated": false
    }
  ],
  "word_frequencies": [
    {"word": "������", "count": 1},
    {"word": "����", "count": 1},
    {"word": "�ູ��.", "count": 1},
    {"word": "����", "count": 1},
    {"word": "�����̶�", "count": 1},
    {"word": "�ʹ�", "count": 1},
    {"word": "�Ҿ���.", "count": 1}
  ]
}
```

`confidence`�� ������ ������ �ƴ϶� ���� ������ Ŭ������ Ȯ���Դϴ�.
�� ������ API ����� ���� `docs/architecture.md`, `docs/openapi.yaml`���� Ȯ���� �� �ֽ��ϴ�.

## ������Ʈ ����

```text
src/emotion_service/   FastAPI ������ ���� �߷� �ڵ�
static/                   ���� �� ȭ��
tests/                 ���� �׽�Ʈ
docs/                  ���� �� API ����
models/                ���� ���� ��(Git ����)
artifacts/             �н� ������ �� ���
```

