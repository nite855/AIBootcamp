# 오늘의 모먼트 · Frosted Moment

현재 메인 Diary Simple v3를 복제한 독립 프로스트 글래스 시안입니다. `index.html` 하나를 브라우저에서 직접 열면 서버·인터넷 없이 실행됩니다. 원본 메인 기능과 감정 판정 규칙을 유지하고 화면 재질과 카드 장식을 변경했습니다.

- [실행](index.html) / [타깃 분석](docs/REVIEW.md) / [검증 결과](docs/QA.md)
- [데스크톱 작성](docs/previews/write-desktop.png) / [모바일 작성](docs/previews/write-mobile.png) / [카드](docs/previews/card-mobile.png)
- 설정에서 밝음·어두움·시스템과 ‘유리 효과 줄이기’를 선택합니다. 분석된 카드는 설정의 예시 모드에서 확인합니다.
- 컴포넌트 재질: 탐색 버튼 묶음에 10px, 카드 외곽 프레임에 14px 블러를 적용합니다. 헤더 전체는 투명하며 탭·설정 패널은 블러 없이 하이라이트로 표현합니다. 입력·읽기 표면과 저장용 카드 아트는 유지합니다. 효과 감소는 새 재질 영역 전체에 적용됩니다.
- 실제 글과 기록은 메모리에만 보관되며 새로고침하면 사라집니다. 실제 감정 분석·계정·서버 저장은 미연결입니다. 이 시안은 영구 보관용 일기장이 아닙니다.
- 표시 설정만 `moment-card:diary-glass-v1:` 접두사의 localStorage 키로 저장합니다. 메인 설정과 분리되어 있고 저장소 차단 시 현재 실행에서 동작합니다.
- 7감정·21단계 슬롯, 작성/수정/삭제·통계·도감, 1080×1620 PNG 내보내기를 유지합니다. 원문은 PNG에 포함하지 않습니다. 원형 도형은 정식 캐릭터 자산이 아닙니다.

저장소 루트에서 실행:

```powershell
node design-lab/diary-glass-v1/tools/build.mjs
node --test design-lab/diary-glass-v1/tests/*.test.cjs
node design-lab/diary-glass-v1/tests/browser.cjs
node design-lab/diary-glass-v1/tests/themes.cjs
node design-lab/diary-glass-v1/tools/capture.cjs
```

브라우저 검사는 기존 임시 Playwright 설치와 Chrome을 사용합니다. 다른 환경은 `CARDEX_PLAYWRIGHT`, `CARDEX_CHROMIUM`을 지정하세요. 빌드는 내장 Node 기능만 사용합니다. 수정은 모듈 소스에서 하고 HTML을 재생성합니다. 내장 IBM Plex Sans KR의 라이선스는 `docs/licenses/ibm-plex-sans-kr.txt`와 HTML에 유지합니다.
