# 공통 디자인 시스템과 컴포넌트

기존 Social Studio 코드의 TCG 토큰과 제품 글꼴을 재사용합니다. 신규 Figma의 UI 변수에는 Light/Dark 두 모드와 특정 scope·WEB 코드 문법이 있습니다. IBM Plex Sans KR Regular/SemiBold, 제목36/모바일28, 섹션20/18, 본문16, 도움말13, 8/16/24/40 간격, 패널 radius16, 버튼10, 카드20을 사용합니다. 원본 카드 이미지를 임의 생성하지 않았습니다.

| 의미 | Light | Dark |
|---|---|---|
| Background | #F6F3EA | #101725 |
| Surface | #FFFFFF | #1B2739 |
| Text | #18283D | #E5EDF8 |
| Muted | #59677B | #B6C3D7 |
| Border | #D7DCE3 | #435269 |
| Primary | #264D8B | #9BBCF2 |
| Accent | #AA7E35 | #D0AD6B |
| Positive / Negative / Neutral | #278E81 / #D25B35 / #78899B | 동일 계열 |
| Success / Warning / Error | #17664F / #805700 / #A42F35 | 기존 themes.css 의미색 |

아래는 프레임워크 비종속 계약입니다. 이번 vanilla JS에서는 함수·메모리 state로 구현하며 JSX Props가 존재하는 것으로 오해하지 않도록 구분합니다.

| 개념 컴포넌트 | 입력 데이터 | 출력 이벤트 / 상태 |
|---|---|---|
| AppShell/Header/Navigation | route,theme,result | navigate,setTheme / current |
| FileUpload | fileName,parsed,error | acceptFile,replace / idle,error,ready |
| SpeakerSelector | speakers,speaker,manualSpeaker | select,validate / selected,mismatch |
| AnalysisProgress | progress,parseScope | retry,back / unavailable |
| SummaryCard | summary,scope | openDetail / empty,partial,success |
| EmotionDistributionChart | summary.leaf/parents | selectParent,openCard |
| EmotionTimelineChart | rows,view,hiddenSeries | selectPoint,toggle / missing |
| EmotionCalendar | rows,month,date | setDate,changeMonth / no-time,no-record |
| TrendDetail | segments | openRange / detected,none |
| RepeatedExpressionList | expressions,repeatSort | sort,expand / no-candidates |
| TCGCard/CardGallery | type,summary,query,sort | select,zoom,back / search-empty |
| SharePreview | publicPayload,format,frame,numbers | export,share,copy / busy,error,ready |
| FilterBar | parent,query,sort,period | change,reset / selection retained |
| StatusMessage/Loading/Empty/Error | code,message,action | retry,replace,back |

Figma에는 공통 Header 인스턴스, 버튼·카드·입력·분포·흐름·반복 표현 마스터, 버튼 기본/호버/포커스/선택/비활성/로딩/오류 시안이 있습니다. 나머지 화면은 오토 레이아웃 기반 편집 가능 프레임입니다. 전체 UI가 모든 마스터 컴포넌트의 인스턴스로 변환된 것은 아닙니다. Figma 마스터와 HTML 함수의 정식 Code Connect는 미설정입니다.

접근성 목표는 WCAG2.2 AA입니다. 대비·44px 터치·키보드·200% 확대·스크린리더 전수 검사는 미완료이며 디자인 토큰 존재만으로 통과라고 판단하지 않습니다.
