# 오늘의 모먼트 · 글라스모피즘 참고 이미지

2026-11-04 제작. 아이콘 8종과 컴포넌트 6종을 각각 PNG·SVG로 제공합니다(총 28개). [미리보기](preview.html)를 브라우저에서 직접 열면 두 형식을 비교할 수 있습니다.

## 디자인 기준

- 참고: 상위 폴더의 `Modern Glassmorphism Dashboard UI Design Inspiration.jpeg`와 현재 프론트엔드의 리퀴드 오로라 테마 설명.
- 라벤더 `#c4b5fd`, 아이스 블루 `#bae6fd`, 피치 `#ffd1bd`, 짙은 자주색 글자 `#342748`.
- 좌측 상단 광원, 부드러운 그림자, 둥근 모서리, 반투명 유리와 밝은 가장자리.
- PNG는 내장 `image_gen` 도구로 자산별 생성했습니다. 원본 알파를 보존하여 복사했으며 리사이즈·자동 벡터화하지 않았습니다. 최종 생성 프롬프트 전체는 [prompts.json](prompts.json)에 있습니다.
- SVG는 도형·경로·그라디언트·필터·편집 가능한 텍스트로 직접 제작했습니다. 래스터 이미지를 포함하지 않습니다. 작은 아이콘의 식별성을 위해 외곽선을 강조한 단순화 버전입니다.

## 파일 목록과 실제 크기

각 이름에 `.png`와 `.svg`가 있습니다.

| 폴더 | 파일 이름 | PNG | SVG viewBox |
|---|---|---|---|
| icons | icon-home | 1254×1254 | 128×128 |
| icons | icon-diary-write | 1254×1254 | 128×128 |
| icons | icon-emotion-heart | 1254×1254 | 128×128 |
| icons | icon-emotion-card | 1254×1254 | 128×128 |
| icons | icon-archive | 1254×1254 | 128×128 |
| icons | icon-calendar | 1254×1254 | 128×128 |
| icons | icon-statistics | 1254×1254 | 128×128 |
| icons | icon-settings | 1254×1254 | 128×128 |
| components | component-diary-input | 1536×1024 | 640×460 |
| components | component-emotion-card | 1024×1536 | 400×580 |
| components | component-record-list | 1536×1024 | 640×460 |
| components | component-weekly-chart | 1536×1024 | 640×460 |
| components | component-bottom-nav | 1774×887 | 640×170 |
| components | component-buttons | 1536×1024 | 640×220 |

아이콘 PNG는 투명 배경이며 컴포넌트는 파스텔 배경을 포함합니다. 프롬프트 목표 크기와 도구의 실제 출력 크기는 다를 수 있습니다.

## 수정과 검증

저장소 루트에서 실행합니다.

```powershell
node reference/glassmorphism/build.cjs
node reference/glassmorphism/verify.cjs
```

`build.cjs`는 이 폴더의 SVG와 preview.html을 재생성합니다. SVG 수정은 해당 스크립트에 반영해야 재생성 시 유지됩니다. PNG는 수정하지 않습니다.

검증 스크립트는 기존 프로젝트와 같은 Playwright·Chrome 경로 규칙을 사용합니다. 필요하면 `CARDEX_PLAYWRIGHT`, `CARDEX_CHROMIUM`을 지정합니다. 새 패키지는 추가하지 않았습니다.

- 28개 이미지 디코딩과 14개 SVG XML 파싱 통과.
- 8개 아이콘 PNG의 투명 픽셀·가시 픽셀 존재 확인.
- 1440px·375px에서 가로 넘침 없음, 세 가지 배경 전환 동작 확인.
- 상세 크기·알파 검사: [qa/verification.json](qa/verification.json).
- 검토 화면: [데스크톱](qa/gallery-desktop.png), [모바일](qa/gallery-mobile.png).
- 기존 앱 코드는 변경하지 않아 앱 빌드·백엔드 테스트는 실행하지 않았습니다.

## 사용상 제약

디자인 참고용 라이트 세트입니다. PNG와 SVG는 동일한 비트맵·벡터 변환 쌍이 아니며 형태와 텍스트에 차이가 있습니다. 한글 문구·컴포넌트 구조의 기준은 SVG입니다. PNG에 표시된 날짜·감정 수치·글자 수는 생성된 가상 예시이며 앱 계산 규칙을 정의하지 않습니다.

SVG 텍스트는 시스템의 맑은 고딕 또는 Apple SD Gothic Neo를 사용합니다. 다른 환경에서는 글꼴과 폭이 달라질 수 있습니다. 갤러리의 작은 썸네일은 구조 비교용이며 상세 문구는 원본 링크에서 확인하세요.

실시간 배경 블러와 버튼 동작은 이미지에 포함되지 않습니다. 실제 앱에 도입할 때에는 HTML/CSS, 접근성 대비, 포커스·로딩·오류 상태를 별도로 구현해야 합니다. SVG 여러 개를 인라인으로 합칠 때는 gradient/filter/title ID를 자산별로 구분하세요.

기존 참고 이미지와 앱 파일은 보존했습니다. 내비게이션 PNG 첫 시안이 전체 화면으로 확장되어 단일 내비게이션 시안으로 다시 생성했고, 선택된 최종본만 포함했습니다.
