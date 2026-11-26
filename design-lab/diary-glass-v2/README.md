# 오늘의 모먼트 · Pastel Moment

PNG 참고 자산의 라벤더·아이스 블루·피치 색감과 입체 유리 재질을 적용한 독립 시안입니다.

- [시안 열기](index.html)
- [전체 데스크톱 화면](docs/previews/dashboard-1440.png) / [전체 모바일 화면](docs/previews/dashboard-375.png)
- [검증 결과](docs/QA.md)

작성 패널, 감정 카드, 최근 기록, 최근 7일 기록 수 차트를 함께 제공합니다. 하단 메뉴로 작성·카드·기록·통계를 이동합니다. 실제 감정 분석은 미연결이며 설정에서 예시 모드를 선택할 수 있습니다. 감정 통계와 도감은 기존 판정 규칙을 유지합니다.

실제 기록은 메모리에만 보관되며 새로고침하면 사라집니다. 표시 설정만 `moment-card:diary-glass-v2:` 키에 저장합니다. 최초 모드는 밝음이며 어두움·시스템 모드와 유리 효과 줄이기를 지원합니다.

## 빌드와 검증

저장소 루트에서 실행합니다.

```powershell
node design-lab/diary-glass-v2/tools/build.mjs
node --test design-lab/diary-glass-v2/tests/*.test.cjs
node design-lab/diary-glass-v2/tests/browser.cjs
node design-lab/diary-glass-v2/tests/themes.cjs
node design-lab/diary-glass-v2/tests/dashboard.cjs
node design-lab/diary-glass-v2/tools/capture.cjs
```

브라우저 검사는 Playwright와 Chrome을 사용합니다. 필요하면 `CARDEX_PLAYWRIGHT`, `CARDEX_CHROMIUM` 경로를 설정하세요. 신규 패키지는 추가하지 않았습니다.

모듈 소스와 템플릿을 수정한 뒤 HTML을 다시 생성합니다. 빌드에는 `reference/glassmorphism/icons/`의 PNG 원본이 필요합니다. 생성 HTML에는 PNG와 폰트가 내장되어 파일 하나로 오프라인 실행할 수 있습니다(약 7.3 MB). 컴포넌트 PNG는 시각 참고이며 UI는 HTML/CSS로 구현했습니다. 내장 폰트 라이선스는 `docs/licenses/`와 HTML에 포함됩니다.
