# Figma 대응
기준: [TCG Social Studio v1 / Draft 02](https://www.figma.com/design/DaIq7zBX9frMFoaa2JKdnA).

| Figma | 프론트 |
|---|---|
| 4:3523 공유 편집기 | #share |
| 4:2029 요약 | #overview |
| 4:2184 캘린더 | #calendar |
| 분석 상세 | #distribution, #flow, #repeats, #summary |
| 일/주/월 상세 | #period, 선택일은 #calendar |
| 7종 도감·상세 | #gallery, #cardex, #detail?id=pos_1 |
| 블로그 8개 상태 | #blog, 공유 상태를 동적으로 유지 |
| 8종 Export | Canvas PNG 생성 |
| Tablet & Dark | CSS 반응형과 표시 모드 |
| 예외·복구 | #states 및 인라인 오류 |

get_design_context로 공유·요약·캘린더의 편집 가능한 구조와 토큰을 읽고 기존 Vanilla JS에 적용했습니다. 정적 UI 스크린샷을 실행 자산으로 넣지 않았습니다. 감정 차트는 데이터에서 생성하는 SVG이며 Figma의 정적 예시 그래프를 붙이지 않습니다. 캐릭터 자산은 비워 둡니다. 내장 폰트와 라이선스를 재사용했습니다.

고정 Figma 상태를 실제 선택값 기반 화면으로 합쳤으므로 파일의 프레임 수와 라우트 수는 다릅니다. 실브라우저 시각 비교는 환경 제한으로 미완료입니다.

