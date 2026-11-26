# 검증 결과

2026-11-04에 두 시안 빌드 후 검증했습니다.

## 자동 검사

- `node design-lab/diary-3d-v1/tools/build.mjs`: Lemon & Cocoa, Soft Gray HTML 생성.
- `node --test design-lab/diary-3d-v1/tests/*.test.cjs`: 도메인 회귀 테스트 37개와 신규 투명 자산·빌드 테스트 2개 통과.
- `node design-lab/diary-3d-v1/tests/browser.cjs`: 두 시안 각각 작성·수정·삭제·목록·도감·통계·카드 화면 포함 40개 검사 통과. 브라우저 오류와 외부 요청 없음.
- `node design-lab/diary-3d-v1/tests/themes.cjs`: 두 시안의 밝음·어두움·시스템 모드, 7감정 카드 PNG, 글자 대비, 저장소 차단과 키 분리 통과.
- `node design-lab/diary-3d-v1/tests/dashboard.cjs`: 두 시안 기록 생성·수정·삭제, XSS 텍스트 이스케이프, 1440px·375px 레이아웃 통과.
- `node design-lab/diary-3d-v1/tools/capture.cjs`: 두 시안·두 화면 크기의 대시보드·설정·기록·카드·통계·도감 캡처, 모바일 다크 캡처 통과.
- `node design-lab/diary-3d-v1/tests/screenshots.cjs`: 두 시안의 주요 화면 검토 캡처 통과. 결과는 `screen-verification.json`.
- `node design-lab/diary-3d-v1/tests/themes.cjs`가 만든 카드 PNG는 모두 1080×1620입니다. 픽셀을 열어 캐릭터가 비어 있지 않고 일기 원문은 포함되지 않는지 확인했습니다.

네 가지 색상 모드의 최소 글자 대비는 각각 Lemon 밝음 4.62:1, Lemon 어두움 5.52:1, Gray 밝음 5.02:1, Gray 어두움 6.83:1입니다.

## 반응형 및 화면 자료

320·360·375·390·1440px 화면에서 가로 넘침이 없습니다. 브라우저 검사는 1440·390px, 대시보드 회귀 검사는 1440·375px을 확인합니다. 화면 캡처는 `previews/`에 보관합니다.

## Figma

[Figma 파일](https://www.figma.com/design/2TsBtFYTwjdqPloKZZOOdk)

- Overview, Lemon & Cocoa, Soft Gray, Assets 페이지를 구성했습니다.
- 시안별 데스크톱 6개·모바일 6개·모바일 다크 1개, 총 26개 프레임을 확인했습니다.
- 파일 전체에 편집 가능한 텍스트·Auto Layout·벡터 아이콘과 각 프레임의 3D PNG 자산이 있습니다.
- 시안별 120개의 클릭 이동을 구성하고 모바일·데스크톱 프로토타입 시작점을 지정했습니다.
- 7감정 캐릭터와 하트·별 자산을 Figma에 올리고 이름을 붙였습니다.
- 제작에만 사용한 임시 캡처 프레임은 제거했습니다.

Figma는 시안 검토와 이동 시연용이며 일기 입력·데이터 갱신·분석 계산은 HTML에서 확인합니다. 캡처 날짜와 예시 데이터는 2026-11-04 기준입니다.
