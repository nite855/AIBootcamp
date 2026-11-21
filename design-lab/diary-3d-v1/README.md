# 오늘의 모먼트 · 부분 3D 시안 2종

- [Lemon & Cocoa](lemon.html): 연한 레몬 배경, 크림 패널, 갈색 텍스트.
- [Soft Gray](gray.html): 연회색 배경, 흰 패널, 검은 텍스트.
- [Figma 디자인](https://www.figma.com/design/2TsBtFYTwjdqPloKZZOOdk): 편집 가능한 데스크톱·모바일 화면과 개별 3D 자산.
- [디자인 기준](docs/DESIGN.md) / [검증 결과](docs/QA.md)

두 HTML을 브라우저에서 직접 열 수 있습니다. 폰트·이미지가 내장되어 서버나 인터넷 없이 작동합니다. 각 파일은 약 12.3 MB입니다.

작성·수정·삭제, 기록, 카드, 통계, 7감정×3단계 도감과 예시 모드를 제공합니다. **실제 입력은 현재 실행의 메모리에만 보관되며 새로고침하면 사라집니다.** 감정 분석 API는 연결하지 않았습니다. 설정의 ‘예시 모드 둘러보기’에서 합성 기록의 캐릭터 카드를 확인하세요.

표시 설정만 `moment-card:diary-3d-v1:lemon:`, `moment-card:diary-3d-v1:gray:`로 분리해 저장합니다. 기본 모드는 밝음이고 어두움·시스템 모드도 지원합니다. 저장소가 차단되어도 현재 실행에서 선택할 수 있습니다.

## 빌드와 검증

저장소 루트에서 실행합니다. 신규 런타임 의존성은 없습니다.

```powershell
node design-lab/diary-3d-v1/tools/build.mjs
node --test design-lab/diary-3d-v1/tests/*.test.cjs
node design-lab/diary-3d-v1/tests/browser.cjs
node design-lab/diary-3d-v1/tests/themes.cjs
node design-lab/diary-3d-v1/tests/dashboard.cjs
node design-lab/diary-3d-v1/tests/screenshots.cjs
node design-lab/diary-3d-v1/tools/capture.cjs
```

브라우저 검사는 기존 Playwright·Chrome을 사용합니다. 필요하면 `CARDEX_PLAYWRIGHT`와 `CARDEX_CHROMIUM`을 지정하세요. 원본 모듈·템플릿·`design.json`을 수정한 뒤 빌드합니다. 생성 HTML은 직접 편집하지 않습니다.

카드 PNG는 1080×1620이며 일기 원문을 포함하지 않습니다. 캐릭터와 단계 표시는 카드·도감·PNG에서 같은 판정 결과를 사용합니다. 단계는 감정 강도가 아닌 분류 확률 구간입니다.

## 제작 자료

- `assets/`: 내장 imagegen으로 생성한 투명 PNG 9종. 생성 프롬프트는 `assets/prompts.json`.
- `docs/previews/`: 두 시안의 1440px·390px 화면, 모바일 다크 모드, 내보낸 PNG.
- `docs/figma-source.json`: Figma 제작에 사용한 합성 화면 문구와 차트.
- `tools/figma-build.js`: Figma Plugin API용 화면 제작 템플릿. Node에서 직접 실행하는 파일이 아닙니다. 주입 값은 `__CONFIG__`, `__HASHES__`, `__PAGE__`, `__CHART__`입니다.
- IBM Plex Sans KR 라이선스는 `docs/licenses/`와 생성 HTML에 포함됩니다.

Figma는 정적인 검토·프로토타입 자료이며 실제 기록 입력·저장·계산 검증은 HTML에서 수행합니다. Figma 화면 날짜는 2026-11-04의 합성 예시 스냅샷입니다.
