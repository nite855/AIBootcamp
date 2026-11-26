> V3는 pos_3 표시명 **평온**을 반영한 편집 가능한 복제 페이지입니다. HTML의 라이트/다크/시스템 모드 중 Figma에는 라이트 시안이 있습니다. 추가 디자인 개선은 [별도 계획](DESIGN_IMPROVEMENT_PLAN.md)이며 미구현입니다.

# Figma · Emotion Cardex V3 · 평온 표시명

[신규 독립 디자인 파일](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-2)

- Desktop 결과: [Overview](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-593)
- Mobile 결과: [Overview](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-11350)
- Mobile 3→7 탐색: [부정 갤러리](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-15840)

## 페이지

| 페이지 | 내용 |
|---|---|
| V3_00_Overview_and_Plan | 컨셉·IA·컴포넌트·데이터·로드맵·검증·미완료 항목, 4개 안내 프레임 |
| V3_01_Foundations | TCG 색상·간격·반경·글꼴, 버튼12상태, 카드7ID×2크기 |
| V3_02_Desktop | 1440px, 기본14화면·상태·7카드 상세·3→7필터·차트5보기·기간/실패, 40개+확대7개 |
| V3_03_Mobile | 390px, 동일 주요 흐름40개+확대7개+전체메뉴1개 |
| V3_04_Tablet | 834px, Overview·갤러리·상세 대표3개 |

V3는 기존5페이지의126개 루트를 신규5페이지로 복제한 명칭 개정본이다. 원본은 보존했다. 83개 본문 화면/상태와15개 오버레이, 61개 변수·42개 텍스트 스타일·2개 컴포넌트 세트/26개 변형을 사용한다. 이하 편집성 수치는 원본 제작 당시의 기록이며, V3는 새5페이지의 이전 감정 표시명0개와 프로토타입 대상 재연결을 추가 검사했다. 캐릭터 슬롯은 빈 상태이며 전체 UI 스크린샷을 fill로 사용하지 않았다. 카드와 버튼은 재사용 인스턴스를 사용하고 본문 컨테이너는 가능한 범위에서 Auto Layout으로 구성했다.

라이트 기준 HTML과 동일한 예시 결과 및 DOM 영역 배치를 기준으로 제작했다. 모바일은 전체 페이지를 검토할 수 있도록 긴 프레임으로 표시하고 하단 메뉴를 프레임 아래에 배치했다. 실제 HTML에서는 메뉴가 브라우저 viewport 하단에 고정된다. Figma는 대표 상태 사이의 이동 시안이며 실제 파일 파싱·동적 검색·날짜별 계산·운영 API를 실행하지 않는다. 태블릿3개는 정적 레이아웃 검토용이다. 자세한 검증 범위는 QA.md에 기록했다.

## 화면 매핑

| 기준 폭 | 라우트/상태 | 실제 노드 |
|---|---|---|
| 1440 | overview | [33:593](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-593) |
| 1440 | start | [33:1054](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-1054) |
| 1440 | upload | [33:1163](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-1163) |
| 1440 | speaker | [33:1262](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-1262) |
| 1440 | progress | [33:1364](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-1364) |
| 1440 | cardex | [33:1482](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-1482) |
| 1440 | gallery | [33:1617](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-1617) |
| 1440 | detail | [33:1765](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-1765) |
| 1440 | distribution | [33:2003](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-2003) |
| 1440 | flow | [33:2258](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-2258) |
| 1440 | period | [33:2522](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-2522) |
| 1440 | calendar | [33:2954](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-2954) |
| 1440 | repeats | [33:3236](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-3236) |
| 1440 | summary | [33:3359](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-3359) |
| 1440 | states | [33:3484](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-3484) |
| 1440 | detail-pos_1 | [33:3596](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-3596) |
| 1440 | detail-pos_2 | [33:3834](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-3834) |
| 1440 | detail-pos_3 | [33:4058](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-4058) |
| 1440 | detail-neg_2 | [33:4282](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-4282) |
| 1440 | detail-neg_3 | [33:4506](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-4506) |
| 1440 | detail-neutral | [33:4730](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-4730) |
| 1440 | cardex-positive | [33:4955](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-4955) |
| 1440 | cardex-negative | [33:5182](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-5182) |
| 1440 | cardex-neutral | [33:5409](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-5409) |
| 1440 | cardex-all | [33:5574](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-5574) |
| 1440 | gallery-positive | [33:5925](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-5925) |
| 1440 | gallery-negative | [33:6165](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-6165) |
| 1440 | gallery-neutral | [33:6405](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-6405) |
| 1440 | gallery-all | [33:6583](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-6583) |
| 390 | start | [33:11041](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-11041) |
| 390 | upload | [33:11121](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-11121) |
| 390 | speaker | [33:11190](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-11190) |
| 390 | progress | [33:11262](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-11262) |
| 390 | overview | [33:11350](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-11350) |
| 390 | cardex | [33:11787](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-11787) |
| 390 | gallery | [33:11892](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-11892) |
| 390 | detail | [33:12010](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-12010) |
| 1440 | flow-positive | [33:6947](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-6947) |
| 1440 | flow-negative | [33:7208](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-7208) |
| 1440 | flow-neutral | [33:7469](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-7469) |
| 1440 | flow-seven | [33:7637](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-7637) |
| 1440 | period-week | [33:8087](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-8087) |
| 1440 | period-month | [33:8398](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-8398) |
| 1440 | state-no-time | [33:8681](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-8681) |
| 1440 | state-empty | [33:8760](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-8760) |
| 1440 | state-invalid | [33:8833](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-8833) |
| 1440 | state-neutral | [33:8906](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-8906) |
| 1440 | state-partial | [33:9365](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-9365) |
| 390 | distribution | [33:12218](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-12218) |
| 390 | flow | [33:12443](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-12443) |
| 390 | period | [33:12677](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-12677) |
| 390 | calendar | [33:13079](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-13079) |
| 390 | repeats | [33:13331](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-13331) |
| 390 | summary | [33:13424](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-13424) |
| 390 | states | [33:13519](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-13519) |
| 390 | detail-pos_1 | [33:13601](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-13601) |
| 390 | detail-pos_2 | [33:13809](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-13809) |
| 390 | detail-pos_3 | [33:14003](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-14003) |
| 390 | detail-neg_2 | [33:14197](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-14197) |
| 390 | detail-neg_3 | [33:14391](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-14391) |
| 390 | detail-neutral | [33:14585](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-14585) |
| 390 | cardex-positive | [33:14780](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-14780) |
| 390 | cardex-negative | [33:14977](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-14977) |
| 390 | cardex-neutral | [33:15174](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-15174) |
| 390 | cardex-all | [33:15309](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-15309) |
| 390 | gallery-positive | [33:15630](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-15630) |
| 390 | gallery-negative | [33:15840](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-15840) |
| 390 | gallery-neutral | [33:16050](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-16050) |
| 390 | gallery-all | [33:16198](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-16198) |
| 390 | flow-positive | [33:16532](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-16532) |
| 390 | flow-negative | [33:16763](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-16763) |
| 390 | flow-neutral | [33:16994](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-16994) |
| 390 | flow-seven | [33:17132](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-17132) |
| 390 | period-week | [33:17552](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-17552) |
| 390 | period-month | [33:17833](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-17833) |
| 390 | state-no-time | [33:18086](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-18086) |
| 390 | state-empty | [33:18135](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-18135) |
| 390 | state-invalid | [33:18179](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-18179) |
| 390 | state-neutral | [33:18223](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-18223) |
| 390 | state-partial | [33:18658](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-18658) |
| 834 | overview | [33:9657](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-9657) |
| 834 | gallery | [33:10117](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-10117) |
| 834 | detail | [33:10293](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=33-10293) |

기존 파일 rbltFfXw8DHEstuit2ycLZ의 00·01·TCG·다른 테마는 읽기 전용으로 참고했다. 그 파일의 페이지19개, TCG top-level164개, 기존 핵심ID가 보존되어 있음을 재확인했다.
