# 오늘의 모먼트 · 독립 프론트엔드

최신 메인 일기 프론트를 독립 실행용으로 제공합니다. 원본은 `NotHyoone/AIBootcamp`의 커밋 `8c88f3f`입니다. 이 폴더는 업스트림의 기존 `static/` 화면과 FastAPI 서버를 변경하지 않습니다.

## 실행

`index.html`을 브라우저에서 직접 엽니다. 필요한 코드·폰트·이미지가 HTML에 내장되어 있어 서버·모델·인터넷 없이 사용할 수 있습니다. 파일 URL과 HTTP URL의 브라우저 저장소는 분리되므로 실행 주소를 바꾸면 다른 기록·설정이 표시될 수 있습니다.

실제 기록과 초안은 IndexedDB `moment-diary-main`에 저장합니다. 계정·기기 간 동기화·서버 백업은 제공하지 않으며 브라우저 데이터 삭제 시 기록도 사라집니다. 예시 모드는 실제 기록과 분리됩니다.

## 제공 기능과 분석 연결 상태

- 기록 작성·수정·삭제, 하루 한 편/여러 편 설정, 긴 기록 읽기.
- 보관함, 돌아보기 통계, 10감정 × 3단계 캐릭터 도감과 카드 PNG 저장.
- 6개 테마와 밝음·어두움·시스템 모드.
- 터치 즉시 빛·기울기, 드래그 효과와 짧은 탭 뒤집기. 드래그·500ms 이상 길게 누르기·본문 스크롤·선택은 뒤집지 않습니다.
- 카드 효과는 기본 켜짐이며 버튼 하나로 전환합니다. 켜짐은 OS 움직임 줄이기 설정보다 우선합니다. 기존 `on/off`를 유지하고 `auto`·누락·손상된 저장값은 켜짐으로 해석합니다.

**실제 분석 API는 연결하지 않았습니다.** 실제 글은 분석 대기로 표시하며, 분석 결과와 수집 카드는 설정의 예시 모드에서 확인합니다. 프론트의 10감정 체계와 업스트림의 6감정 API를 임의로 변환하지 않습니다.

## 소스와 빌드

`scripts/`는 도메인·저장소·화면 동작, `styles/`는 스타일, `templates/`는 HTML 틀, `assets/characters/`는 필수 이미지입니다. 테마 원본은 `design/tokens/`에 있습니다.

아래 명령은 저장소 루트에서 실행합니다. `index.html`과 `*/generated/` 파일을 직접 수정하지 말고 원본 소스를 수정한 뒤 공식 빌드로 생성합니다.

```powershell
node frontend/tools/build.mjs
node frontend/tools/build-tokens.mjs --check
```

기존 파일을 수정하거나 빌드로 덮어쓰기 전 저장소 루트 `.backups/`에 상대 경로를 유지해 버전 백업합니다. 예: `frontend/index.html` → `.backups/frontend/index.v001.html`. 다음 백업은 최대 번호에 1을 더하고 기존 백업을 덮어쓰지 않습니다. 복사본과 원본의 해시가 일치하지 않으면 수정을 중단합니다. 백업·일기·모델·인증 정보는 커밋하지 않습니다.

## 검증

```powershell
node --test frontend/tests/*.test.cjs
node frontend/tests/browser.cjs
node frontend/tests/themes.cjs
node frontend/tests/card-effects.cjs
node frontend/tests/persistence-browser.cjs
```

단위 테스트는 Node의 내장 테스트 러너를 사용합니다. 브라우저 검사는 Playwright와 Chrome이 필요합니다. 기본 Chrome 경로는 `C:/Program Files/Google/Chrome/Application/chrome.exe`, 기본 Playwright 모듈 경로는 시스템 임시 폴더 아래 `aibootcamp-frontend-review/node_modules/playwright`입니다. 환경에 맞게 `CARDEX_PLAYWRIGHT`와 `CARDEX_CHROMIUM`을 지정할 수 있습니다.

브라우저 검사 증거 이미지는 시스템 임시 폴더에 저장합니다. 실기기 터치·키보드와 Safari·Firefox는 별도 수동 확인 대상입니다. 과거 시안·와이어프레임·비교 보고서와 해당 전용 테스트는 이 전달본에 포함하지 않았습니다.

IBM Plex Sans KR의 SIL OFL 라이선스는 [라이선스 파일](docs/licenses/ibm-plex-sans-kr.txt)과 생성 HTML에 포함합니다.
