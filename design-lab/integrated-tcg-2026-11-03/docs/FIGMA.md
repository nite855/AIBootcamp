# Figma 동기화 2026-11-03

[새 파일](https://www.figma.com/design/mSzWvUeNhLC6Gr2rwXJCgb) / [Desktop 대시보드](https://www.figma.com/design/mSzWvUeNhLC6Gr2rwXJCgb?node-id=5-144) / [Mobile 대시보드](https://www.figma.com/design/mSzWvUeNhLC6Gr2rwXJCgb?node-id=8-117)

| 페이지 | 구성 |
|---|---|
| 00 Overview · Foundations | 범위·API 경계·Light/Dark 변수·공통 컴포넌트·버튼 상태 |
| 01 Desktop | 주요14화면과 동일 페이지 이동을 위한 상태/유형 상세20개, 총34프레임 |
| 02 Mobile | 주요14화면과 상태/유형 상세20개, 총34프레임 |
| 03 Tablet & Dark | Tablet 요약 / Dark 요약·공유 / Mobile Dark 요약, 4프레임 |
| 04 States & QA | Desktop/Mobile 각 오류·결측·부분실패·공유 상태16개와 카드7개 상세, 총46프레임 |

프로토타입 링크 구조 검사: Desktop184개·Mobile145개, 대상 누락0. 각 페이지 Header 인스턴스14개, 편집 가능한 TEXT Desktop598개·Mobile552개를 확인했습니다. 문자 수정 후 실제 개수는 소폭 달라질 수 있습니다. 화면 전체를 이미지로 올리지 않았습니다. 주요 UI는 오토 레이아웃·문자·도형·벡터이며 캐릭터 슬롯은 비워 두었습니다.

공통 컴포넌트와 노드 대응은 `figma-map.json`입니다. Header의 모바일 너비 전용 마스터와 onPrimary 토큰을 추가했습니다. 파일 간 원본 로컬 컴포넌트 import가 지원되지 않아 동일 코드 토큰으로 새 로컬 마스터를 만들었습니다.

대시보드·모바일·다크·업로드·공유의 렌더를 검토했고 너비/문자 높이 문제를 수정했습니다. 주요 Desktop/Mobile 이동은 실제 존재하는 동일 페이지 프레임에 연결했습니다. Figma의 화자 입력·파일 선택·저장 버튼은 상태 시안 이동이며 파일 읽기·PNG 생성은 HTML에서 실행합니다. Tablet & Dark와 QA 템플릿 페이지는 디자인 참조용이며 전체 동적 프로토타입과 같지 않습니다. 필터·8개 공유 조합·스크롤/포커스 등의 전수 클릭과 HTML의 픽셀 일치 검증은 미완료입니다.
