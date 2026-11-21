# 오늘의 모먼트 · 기록 중심 벤치마킹 시안

하루콩의 낮은 작성 부담, 데이그램의 글 중심 화면, 데일리오의 월간 회고, Day One의 검색·즐겨찾기를 반영한 독립 시안입니다. 테마와 캐릭터는 기존 자산을 사용합니다.

- [시안 열기](index.html)
- [PC·모바일 비교 페이지](../../reports/diary-benchmark-v1/review.html)
- [검증 결과와 제한](../../reports/diary-benchmark-v1/README.md)

## 실행과 사용

`index.html`을 브라우저로 열면 됩니다. 외부 요청·서버·계정 없이 실행합니다. 메인 앱에 통합하거나 외부에 배포하지 않았습니다.

1. **오늘 쓰기:** 한 줄부터 작성할 수 있습니다. 작성 도움말은 필요할 때 펼치며 원문에 삽입되지 않습니다. 초안은 자동 저장되고 기록 버튼으로 보관합니다.
2. **지난 기록:** 본문 검색, 날짜 필터, 즐겨찾기 필터를 함께 적용합니다. 한글 입력 조합 중에는 입력창을 교체하지 않습니다. 기록 상세에서 읽기·즐겨찾기를 사용하고 더보기에서 수정·삭제합니다.
3. **돌아보기:** 월간 캘린더의 날짜를 눌러 기록을 읽습니다. 감정 분석 대기는 중립 감정으로 바꾸지 않습니다. 상세 통계와 도감은 예시 모드로 확인할 수 있습니다.
4. **설정 → 데이터 관리:** JSON으로 기록을 내보내거나, 파일을 골라 추가·동일·충돌 건수를 확인한 뒤 합칩니다. 동일 기록은 건너뛰며 충돌·용량 초과 시 합치기를 차단합니다.

하루 한 편은 오늘 기록을 갱신합니다. 별도 항목을 여러 번 작성하려면 설정의 기록 방식을 ‘하루 여러 편’으로 바꾸고 ‘새 기록 쓰기’를 사용하세요.

## 저장 계약

- 전용 IndexedDB: `moment-diary-benchmark-v1`. 메인 저장소와 다른 시안을 자동으로 읽거나 가져오지 않습니다.
- 표시 설정 접두사: `moment-card:diary-benchmark-v1:`.
- 기록당 최대 10,000자, 최대 30편입니다. 모델 연결은 없으며 실제 기록의 분석은 대기 상태입니다. 예시 기록은 실제 기록과 분리합니다.
- 기록의 `favorite`은 불리언이며 미지정은 `false`입니다. 기록 버전과 감정 분류 규칙은 기존 구조를 재사용합니다.
- 백업 형식: `{format:"moment-benchmark-backup",version:1,exportedAt,entries}`. 항목은 `id`, `text`, `recordDate`, `version`, `createdAt`, `updatedAt`, `favorite`입니다. 초안·예시·분석·테마는 제외합니다.
- 복원 파일 최대 5MiB. 파일 전체 검증 후 한 트랜잭션으로 합치며, 저장 완료 후에만 화면의 실제 기록을 바꿉니다. 같은 ID의 원문·즐겨찾기·날짜·버전·시각 중 하나라도 다르면 충돌로 취급합니다.
- 브라우저 데이터 삭제 시 기록도 사라집니다. 백업에는 개인 일기 원문이 포함되므로 사용자가 안전한 장소에 보관해야 합니다. 파일 URL과 서버 URL의 저장소는 공유되지 않을 수 있습니다.

## 소스와 빌드

`scripts/app.js`가 기존 상태·기록 흐름을, `scripts/benchmark.js`가 검색·즐겨찾기·백업 UI를 처리합니다. `scripts/backup.js`는 파일 검증·병합을 담당합니다. `styles/benchmark.css`는 작성·목록·캘린더의 반응형 배치를 정의합니다.

```powershell
# 저장소 루트에서 실행
node design-lab/diary-benchmark-v1/tools/build.mjs
node --test design-lab/diary-benchmark-v1/tests/*.test.cjs
node design-lab/diary-benchmark-v1/tests/benchmark-browser.cjs
node design-lab/diary-benchmark-v1/tests/persistence-browser.cjs
node design-lab/diary-benchmark-v1/tests/themes.cjs
```

`index.html`은 생성물이며 직접 편집하지 않습니다. 공식 빌드는 기존 HTML과 생성 토큰을 루트 `.backups/`의 상대 경로에 다음 버전으로 백업하고 SHA-256 일치를 확인한 뒤 덮어씁니다. 일반 소스를 변경하는 후속 작업에서도 저장소의 수정 전 백업 규칙을 따릅니다.

브라우저 검사는 기존 Playwright 설치를 사용합니다. `CARDEX_PLAYWRIGHT`로 모듈 경로, `CARDEX_CHROMIUM`으로 브라우저 실행 파일을 지정할 수 있습니다. 기본값은 설치된 Playwright와 맞는 Chromium이며 없으면 Edge 경로를 사용합니다. 새 의존성은 추가하지 않았습니다.

## PC·모바일 구성

Docker 미리보기는 PC에서 `http://localhost:8080`, 같은 공유기에 연결된 휴대폰에서는 `http://PC의IPv4주소:8080`으로 접속합니다. PC 주소는 `ipconfig`의 실제 이더넷/Wi-Fi IPv4를 사용하며 WSL 가상 어댑터 주소를 사용하지 않습니다. 게스트 Wi-Fi의 기기 격리나 방화벽 차단이 있으면 연결되지 않을 수 있습니다.

LAN HTTP에서도 기록 ID를 생성할 수 있도록 `crypto.randomUUID`가 없으면 `crypto.getRandomValues`로 UUID v4를 만듭니다. 보안 난수 기능 자체가 없으면 저장 오류를 안내합니다. 휴대폰과 PC는 각 브라우저에 별도로 저장되며 자동 동기화하지 않습니다.

실행 중인 Docker를 통한 LAN HTTP 회귀 검사는 `MOMENT_LAN_URL` 환경변수에 실제 PC 주소를 지정하고 `node design-lab/diary-benchmark-v1/tests/mobile-lan.cjs`를 실행합니다. 테스트는 임시 브라우저의 합성 기록만 사용하며 별도의 `reports/diary-benchmark-v1/lan-*` 폴더에 증거를 남깁니다.

960px 이상에서는 저장 결과의 작성창과 카드를 두 열로 표시합니다. 그보다 좁으면 한 열이며 저장 결과에서 작성창을 감춰 카드와 읽기 조작에 집중합니다. 작성·설정·목록은 문서 스크롤을 허용하고 터치 영역은 최소 44px입니다. 기기의 움직임 줄이기 설정이 카드 효과보다 우선합니다.

실제 모바일 기기·iOS Safari의 키보드 검증은 별도로 필요합니다. 자동 검사는 데스크톱 브라우저의 뷰포트·터치 에뮬레이션입니다.
