# 디자인 작업 안내

기준일: 2026-11-04. 현재 화면을 유지하며 편집 기준을 정리한 초기 버전입니다.

## 읽는 순서

[현황](AUDIT.md) → [원칙](PRINCIPLES.md) → [사용자 흐름](USER_FLOWS.md) → [기초 규칙](FOUNDATIONS.md) → [배치](LAYOUT.md) → [컴포넌트](COMPONENTS.md) → [패턴](PATTERNS.md).

[화면 명세](../UI_SPEC.md), [문구](CONTENT.md), [자산](ASSETS.md), [접근성](ACCESSIBILITY.md), [구조](../ARCHITECTURE.md), [작업 목록](../ROADMAP.md), [QA](../QA.md), [결정 기록](DECISIONS.md).

## 수정 위치

| 작업 | 편집 원본 | 확인 위치 |
|---|---|---|
| 색·간격·글자 값 | ../../design/tokens/*.json | [디자인 검토 페이지](preview/index.html) |
| 화면·상태 목록 | ../../design/wireframes/screens.json | [와이어프레임](../wireframes/index.html) |
| SVG 도형·실제 클릭 동작 | ../../tools/build-wireframes.mjs | 와이어프레임 검증 |
| 실제 UI 배치 | ../../styles/diary.css | ../../index.html |
| 테마 재질 | ../../styles/themes.css | 앱과 검토 페이지 |
| 자산 슬롯·권리 | ../../design/assets/manifest.json | ASSETS.md |

`styles/generated/`, `scripts/generated/`, 와이어프레임 결과, preview/index.html, frontend/index.html은 생성물입니다. 직접 편집하지 않습니다. JSON은 런타임 fetch 없이 빌드에서 내장합니다.

## 재생성

frontend에서 `node tools/build.mjs`, `node tools/build-wireframes.mjs`, `node tools/build-design-preview.mjs`를 순서대로 실행합니다. 전체 검사는 [QA](../QA.md)를 따릅니다. 새 문서의 수치는 현재 구현과 제안 여부를 함께 확인하세요.

## 2026-11-14 작업 위치

- `../../scripts/home-view.js`: 작성·최근 기록·상단 메뉴의 렌더링.
- `../../scripts/theme-view.js`: 갤러리·임시 선택·미리보기·적용·초점 복귀.
- `../../styles/benchmark.css`: 홈과 테마 갤러리의 실제 배치·미리보기 재질.
- `../../design/tokens/themes.json`과 `primitives.json`: 9개 테마/18개 팔레트.
- `../../assets/themes/`: 숲·노을·별밤 원본 SVG. `../../tools/build.mjs`가 단일 HTML에 내장합니다.

참고: [day4-lab 메모장](https://github.com/NotHyoone/day4-lab/blob/main/memo.html)의 입력·목록 구성과 [My Diary](https://play.google.com/store/apps/details?id=mydiary.journal.diary.diarywithlock.diaryjournal.secretdiary)의 공개 테마 스크린샷을 프로젝트에 맞게 재구성했습니다. 외부 그림을 복제하지 않았습니다. 기존 와이어프레임은 이전 구조의 참고 자료이며 현재 화면은 UI_SPEC의 최신 절과 실행 앱을 기준으로 합니다.
