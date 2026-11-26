# 오늘의 모먼트 프론트엔드 Docker 실행 가이드

작성일: 2026-11-15

## 개요

프론트엔드는 `nginx:alpine` 컨테이너로 실행하고, 브라우저에서 http://localhost:8080 으로 접속합니다. 빌드된 `frontend/index.html`은 fetch가 필요 없는 단일 파일이라 정적 서버 하나면 충분합니다.

저장소 루트의 `Dockerfile`은 FastAPI 백엔드 이미지입니다. 시작할 때 모델 체크포인트(`/models/checkpoint`)가 없으면 실패하므로, 체크포인트 없이 프론트엔드만 띄울 때는 이 이미지를 쓰지 않습니다. 이 방식은 저장소 파일을 하나도 바꾸지 않습니다.

## 사전 준비

1. Docker Desktop을 켭니다. 이 PC에는 사용자 폴더에 설치되어 있습니다.

```powershell
Start-Process "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe"
```

2. 데몬이 준비되었는지 확인합니다. 오류 없이 정보가 출력되면 준비된 것입니다.

```powershell
docker info
```

3. 프론트엔드 소스를 고쳤다면 `index.html`을 다시 빌드합니다. 빌드 전에 기존 `index.html`을 백업해야 합니다(저장소 규칙).

```powershell
node .claude/hooks/backup-guard.mjs --file frontend/index.html
cd frontend
node tools/build.mjs
cd ..
```

## 실행 명령

저장소 루트에서 PowerShell로 실행합니다.

```powershell
docker run -d --name moment-frontend -p 8080:80 `
  -v "${PWD}\frontend\index.html:/usr/share/nginx/html/index.html:ro" `
  nginx:alpine
```

| 옵션 | 의미 |
| --- | --- |
| `-d` | 컨테이너를 백그라운드에서 실행 |
| `--name moment-frontend` | 관리 명령에서 쓸 컨테이너 이름 |
| `-p 8080:80` | PC의 8080 포트를 컨테이너의 80 포트에 연결 |
| `-v ...:ro` | 빌드된 `frontend/index.html`을 nginx 문서 폴더에 읽기 전용으로 연결 |
| `nginx:alpine` | 정적 파일만 제공하는 공식 nginx 이미지 |

8080 포트가 이미 사용 중이면 `-p 8081:80`처럼 앞 번호만 바꿉니다.

## 동작 확인

2026-11-15 실행에서 컨테이너는 `Up` 상태였고, 페이지 요청은 HTTP 200을 반환했습니다.

```powershell
docker ps --filter name=moment-frontend
$r = Invoke-WebRequest http://localhost:8080/ -UseBasicParsing
"status=$($r.StatusCode) bytes=$($r.RawContentLength)"
```

| 확인 항목 | 결과 |
| --- | --- |
| 컨테이너 상태 | `Up`, `0.0.0.0:8080->80/tcp` |
| HTTP 응답 | 200 |
| 응답 크기 | 12,408,910 bytes (`frontend/index.html`과 동일) |
| 페이지 제목 | 오늘의 모먼트 |

브라우저 화면은 직접 열어 확인하지 않았습니다.

## 관리 명령

| 작업 | 명령 |
| --- | --- |
| 로그 확인 | `docker logs moment-frontend` |
| 다시 빌드한 `index.html` 반영 | `docker restart moment-frontend` |
| 중지 | `docker stop moment-frontend` |
| 다시 시작 | `docker start moment-frontend` |
| 중지 후 삭제 | `docker rm -f moment-frontend` |

같은 이름으로 `docker run`을 다시 실행하려면 먼저 `docker rm -f moment-frontend`로 기존 컨테이너를 삭제합니다.

## 참고: 백엔드까지 함께 실행

모델 체크포인트 폴더가 있으면 저장소 `Dockerfile`로 FastAPI 서버를 띄울 수 있습니다. 이 서버는 http://localhost:8000 에서 같은 `index.html`을 제공합니다. 체크포인트에는 `config.json`, `model.safetensors`, `tokenizer_config.json`이 있어야 합니다.

```powershell
docker build -t moment-app .
docker run -d --name moment-app -p 8000:8000 `
  -v "C:\path\to\checkpoint:/models/checkpoint:ro" `
  moment-app
```

이미지에는 빌드된 `frontend/index.html`만 복사되므로, `docker build` 전에 프론트엔드를 먼저 빌드합니다. 이 방법은 체크포인트가 없어 아직 실행해 보지 않았습니다.
