> 이 문서는 v1 Figma 참고 기록입니다. v2 다크 모드는 GitHub의 HTML/CSS/JS에 추가했으며 Figma 원본은 변경하지 않았습니다.

# Figma · Emotion Cardex

[신규 독립 디자인 파일](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=20-2)

- Desktop 결과: [Overview](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=12-2)
- Mobile 결과: [Overview](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=14-298)
- Mobile 3→7 탐색: [부정 갤러리](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=15-1054)

## 페이지

| 페이지 | 내용 |
|---|---|
| 00_Overview_and_Plan | 컨셉·IA·컴포넌트·데이터·로드맵·검증·미완료 항목, 4개 안내 프레임 |
| 01_Foundations | TCG 색상·간격·반경·글꼴, 버튼12상태, 카드7ID×2크기 |
| 02_Desktop | 1440px, 기본14화면·상태·7카드 상세·3→7필터·차트5보기·기간/실패, 40개+확대7개 |
| 03_Mobile | 390px, 동일 주요 흐름40개+확대7개+전체메뉴1개 |
| 04_Tablet | 834px, Overview·갤러리·상세 대표3개 |

83개 본문 화면/상태와15개 오버레이, 61개 변수·42개 텍스트 스타일·2개 컴포넌트 세트/26개 변형을 사용한다. 본문6178개 편집 텍스트와283개 인스턴스를 구조 확인했다. 캐릭터 슬롯은 빈 상태이며 전체 UI 스크린샷을 fill로 사용하지 않았다. 카드와 버튼은 재사용 인스턴스를 사용하고 본문 컨테이너는 가능한 범위에서 Auto Layout으로 구성했다.

HTML과 동일한 예시 결과 및 DOM 영역 배치를 기준으로 제작했다. 모바일은 전체 페이지를 검토할 수 있도록 긴 프레임으로 표시하고 하단 메뉴를 프레임 아래에 배치했다. 실제 HTML에서는 메뉴가 브라우저 viewport 하단에 고정된다. Figma는 대표 상태 사이의 이동 시안이며 실제 파일 파싱·동적 검색·날짜별 계산·운영 API를 실행하지 않는다. 태블릿3개는 정적 레이아웃 검토용이다. 자세한 검증 범위는 QA.md에 기록했다.

## 화면 매핑

| 기준 폭 | 라우트/상태 | 실제 노드 |
|---|---|---|
| 1440 | overview | [12:2](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=12-2) |
| 1440 | start | [13:3](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=13-3) |
| 1440 | upload | [13:109](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=13-109) |
| 1440 | speaker | [13:205](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=13-205) |
| 1440 | progress | [13:304](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=13-304) |
| 1440 | cardex | [13:418](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=13-418) |
| 1440 | gallery | [13:551](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=13-551) |
| 1440 | detail | [13:697](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=13-697) |
| 1440 | distribution | [13:929](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=13-929) |
| 1440 | flow | [13:1183](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=13-1183) |
| 1440 | period | [13:1446](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=13-1446) |
| 1440 | calendar | [13:1877](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=13-1877) |
| 1440 | repeats | [13:2158](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=13-2158) |
| 1440 | summary | [13:2280](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=13-2280) |
| 1440 | states | [13:2402](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=13-2402) |
| 1440 | detail-pos_1 | [13:2508](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=13-2508) |
| 1440 | detail-pos_2 | [13:2740](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=13-2740) |
| 1440 | detail-pos_3 | [13:2958](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=13-2958) |
| 1440 | detail-neg_2 | [13:3176](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=13-3176) |
| 1440 | detail-neg_3 | [13:3394](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=13-3394) |
| 1440 | detail-neutral | [13:3612](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=13-3612) |
| 1440 | cardex-positive | [13:3831](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=13-3831) |
| 1440 | cardex-negative | [13:4011](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=13-4011) |
| 1440 | cardex-neutral | [13:4191](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=13-4191) |
| 1440 | cardex-all | [13:4339](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=13-4339) |
| 1440 | gallery-positive | [13:4583](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=13-4583) |
| 1440 | gallery-negative | [13:4776](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=13-4776) |
| 1440 | gallery-neutral | [13:4969](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=13-4969) |
| 1440 | gallery-all | [13:5130](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=13-5130) |
| 390 | start | [14:2](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=14-2) |
| 390 | upload | [14:79](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=14-79) |
| 390 | speaker | [14:145](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=14-145) |
| 390 | progress | [14:214](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=14-214) |
| 390 | overview | [14:298](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=14-298) |
| 390 | cardex | [14:734](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=14-734) |
| 390 | gallery | [14:837](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=14-837) |
| 390 | detail | [14:953](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=14-953) |
| 1440 | flow-positive | [14:1665](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=14-1665) |
| 1440 | flow-negative | [14:1925](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=14-1925) |
| 1440 | flow-neutral | [14:2185](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=14-2185) |
| 1440 | flow-seven | [14:2352](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=14-2352) |
| 1440 | period-week | [14:2801](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=14-2801) |
| 1440 | period-month | [14:3111](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=14-3111) |
| 1440 | state-no-time | [14:3393](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=14-3393) |
| 1440 | state-empty | [14:3470](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=14-3470) |
| 1440 | state-invalid | [14:3540](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=14-3540) |
| 1440 | state-neutral | [14:3610](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=14-3610) |
| 1440 | state-partial | [14:4068](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=14-4068) |
| 390 | distribution | [14:4193](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=14-4193) |
| 390 | flow | [14:4417](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=14-4417) |
| 390 | period | [14:4650](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=14-4650) |
| 390 | calendar | [14:5051](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=14-5051) |
| 390 | repeats | [14:5302](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=14-5302) |
| 390 | summary | [14:5394](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=14-5394) |
| 390 | states | [14:5486](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=14-5486) |
| 390 | detail-pos_1 | [14:5562](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=14-5562) |
| 390 | detail-pos_2 | [14:5764](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=14-5764) |
| 390 | detail-pos_3 | [14:5952](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=14-5952) |
| 390 | detail-neg_2 | [14:6140](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=14-6140) |
| 390 | detail-neg_3 | [14:6328](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=14-6328) |
| 390 | detail-neutral | [15:70](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=15-70) |
| 390 | cardex-positive | [15:259](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=15-259) |
| 390 | cardex-negative | [15:409](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=15-409) |
| 390 | cardex-neutral | [15:559](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=15-559) |
| 390 | cardex-all | [15:677](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=15-677) |
| 390 | gallery-positive | [15:891](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=15-891) |
| 390 | gallery-negative | [15:1054](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=15-1054) |
| 390 | gallery-neutral | [15:1217](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=15-1217) |
| 390 | gallery-all | [15:1348](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=15-1348) |
| 390 | flow-positive | [15:1575](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=15-1575) |
| 390 | flow-negative | [15:1805](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=15-1805) |
| 390 | flow-neutral | [15:2035](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=15-2035) |
| 390 | flow-seven | [15:2172](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=15-2172) |
| 390 | period-week | [15:2591](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=15-2591) |
| 390 | period-month | [15:2871](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=15-2871) |
| 390 | state-no-time | [15:3123](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=15-3123) |
| 390 | state-empty | [15:3170](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=15-3170) |
| 390 | state-invalid | [15:3211](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=15-3211) |
| 390 | state-neutral | [15:3252](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=15-3252) |
| 390 | state-partial | [15:3686](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=15-3686) |
| 834 | overview | [15:3781](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=15-3781) |
| 834 | gallery | [15:4240](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=15-4240) |
| 834 | detail | [15:4414](https://www.figma.com/design/gITGJDkuTzV3rWFKmj5wLz?node-id=15-4414) |

기존 파일 rbltFfXw8DHEstuit2ycLZ의 00·01·TCG·다른 테마는 읽기 전용으로 참고했다. 그 파일의 페이지19개, TCG top-level164개, 기존 핵심ID가 보존되어 있음을 재확인했다.
