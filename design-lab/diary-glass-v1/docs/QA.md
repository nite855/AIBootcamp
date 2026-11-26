# 검증 결과

2026-11-04 · Windows, Node 22.16.0, Playwright + 설치된 Chrome headless.

## 컴포넌트 재질 후속 검증

헤더 전체의 블러 제거, 탐색 묶음의 10px 블러, 카드 프레임의 14px 블러를 계산 스타일로 확인합니다. 효과 감소 후 탐색 묶음과 카드 프레임 모두 `backdrop-filter: none`인지 검사합니다. 기존 모드·뷰포트·PNG·저장소·오프라인 검사를 재실행했고 통과했습니다. 대표 캡처 7개를 갱신하고 모바일 카드 화면을 확인했습니다. 캐릭터와 카드 SVG 생성 로직은 이번 변경 대상이 아닙니다.

| 명령 / 범위 | 결과 |
|---|---|
| `node design-lab/diary-glass-v1/tools/build.mjs` | 모듈·폰트·라이선스 내장 HTML 생성 |
| `node --test design-lab/diary-glass-v1/tests/*.test.cjs` | 37개 통과 |
| `node design-lab/diary-glass-v1/tests/browser.cjs` | 40개 확인 통과, PNG 1080×1620, JS 오류·외부 요청 0 |
| `node design-lab/diary-glass-v1/tests/themes.cjs` | 1개 테마·2개 팔레트/PNG, 5개 뷰포트, 시스템 반영·잘못된 설정·저장소 차단·초안 유지·효과 감소·오프라인 통과 |
| `node design-lab/diary-glass-v1/tools/capture.cjs` | 대표 캡처 7개, 불투명 표면의 텍스트·경계 대비 검사 |
| 기존 보고서 `verify.cjs` | 8개 대상·로컬 링크·1440/390 너비 통과 |
| 기존 보고서 `verify_standalone.cjs` | 별도 빈 폴더에서 오프라인 실행, 이미지 16개·내장 링크 74개(앱 8개 포함), 외부 요청·JS 오류 0 |

뷰포트: 1366×768, 1440×900, 390×844, 360×640, 320×568. 기능 검사에는 작성·보관함·통계·도감·예시 카드·원문 수정 후 분석 무효화·PNG·재시작 후 원문 초기화가 포함됩니다. 모바일 캡처의 카드 동작 버튼은 줄바꿈 가능한 배치이며 단어 중간 줄바꿈을 막았습니다.

불투명 본문 대비는 팔레트의 주/보조 글자와 paper/surface, 강조 버튼을 4.5:1 이상으로 검사합니다. 다크 모드 추가 경계 검사 결과: 주 글자 11.76 이상, 보조 글자 7.83 이상, 경계 3.36 이상. 기준: [WCAG 텍스트 대비](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [비텍스트 대비](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html). 이는 전체 WCAG 인증이 아닙니다. 반투명 헤더의 모든 합성 픽셀에 대한 자동 판정은 수행하지 않았습니다.

## 폴더 이동과 기존 실패

기존 시안 10개의 파일 172개를 새 경로에 복사한 뒤 모든 파일의 바이트 일치를 확인하고 이전 경로를 제거했습니다. 읽기 전용 디렉터리 속성 때문에 직접 이름 변경이 거부되어 파일 이동 후 빈 디렉터리의 읽기 전용 속성을 해제했습니다. 기존 실행 경로·빌드 안내·보고서 참조를 갱신했습니다. 과거 QA·변경 이력은 과거 경로 표기를 보존합니다.

이동 전 확인한 기존 실패: Diary Simple v1의 `isDiary` 및 `co` 참조 오류 2개, v2의 `co` 오류 1개, Social Studio/Integrated TCG의 `STUDIO_CANVAS` 미설정 각 1개. 이동 후 신규 시안을 포함한 전체 단위 테스트는 220개 중 215개 통과, 동일한 기존 실패 5개입니다. 신규 시안의 실패로 합산하지 않으며 관련 없는 수정은 하지 않았습니다.

## 남은 수동 확인

실기기 키보드·Safari/Firefox, 스크린리더, 200% 확대, OS의 투명도 감소 설정 전달, 강제 색상, 저사양 폰 성능·배터리와 실제 타깃 조사는 미검증입니다. `prefers-reduced-transparency` 미지원 브라우저에서는 앱 내부 ‘유리 효과 줄이기’를 사용할 수 있습니다. CSS 블러 미지원 시 기본 불투명 표면이 적용됩니다.
