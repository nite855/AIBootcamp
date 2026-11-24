---
name: 오늘의 모먼트
description: 하루 한 편의 일기를 감정 카드로 돌려주는 모바일 우선 소프트 UI
colors:
  night-ink: "#111114"
  daysky-blue: "#3b5bfd"
  dawn-pink: "#ffb3c7"
  noon-paper: "#ffffff"
  morning-mist: "#f7f7f8"
  dusk-line: "#f0f0f2"
  afternoon-gray: "#5f5f68"
  twilight-subtle: "#b8b8c0"
  error-rose: "#a12b43"
  card-deep-pos-1: "#e8789a"
  card-deep-pos-2: "#ee9467"
  card-deep-pos-3: "#e2b94c"
  card-deep-neg-1: "#8cc55a"
  card-deep-neg-2: "#55c2a0"
  card-deep-neg-3: "#669fe6"
  card-deep-neu-1: "#7c86ec"
  card-deep-neu-2: "#a083ec"
  card-deep-neu-3: "#d97cc6"
typography:
  display:
    fontFamily: "Moment Sans, Pretendard, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "52px"
    fontWeight: 600
    lineHeight: 1.18
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Moment Sans, Pretendard, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Moment Sans, Pretendard, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.4
  body:
    fontFamily: "Moment Sans, Pretendard, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.85
  label:
    fontFamily: "Moment Sans, Pretendard, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  numeral:
    fontFamily: "Bricolage Grotesque, Moment Sans, Pretendard, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    letterSpacing: "-0.02em"
rounded:
  sm: "8px"
  md: "16px"
  card: "23px"
  tile: "28px"
  panel: "32px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "28px"
  3xl: "36px"
  4xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.night-ink}"
    textColor: "{colors.noon-paper}"
    rounded: "{rounded.pill}"
    padding: "13px 24px"
    height: "44px"
  button-primary-empty:
    backgroundColor: "{colors.dusk-line}"
    textColor: "{colors.afternoon-gray}"
    rounded: "{rounded.pill}"
  button-secondary:
    backgroundColor: "{colors.morning-mist}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.pill}"
    padding: "13px 24px"
    height: "44px"
  chip:
    backgroundColor: "{colors.morning-mist}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.pill}"
  chip-selected:
    backgroundColor: "{colors.night-ink}"
    textColor: "{colors.noon-paper}"
    rounded: "{rounded.pill}"
  panel:
    backgroundColor: "{colors.noon-paper}"
    rounded: "{rounded.panel}"
    padding: "28px"
  tile:
    backgroundColor: "{colors.noon-paper}"
    rounded: "{rounded.tile}"
  editor-textarea:
    backgroundColor: "{colors.noon-paper}"
    textColor: "{colors.night-ink}"
    typography: "{typography.body}"
    padding: "36px 40px 0"
  composer-bar:
    backgroundColor: "{colors.morning-mist}"
    rounded: "{rounded.pill}"
    height: "56px"
  nav-tab-active:
    backgroundColor: "{colors.morning-mist}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.pill}"
    height: "44px"
---

# Design System: 오늘의 모먼트

<!-- 원본 토큰: frontend/design/tokens/*.json → styles/generated/tokens.css. 이 문서의 값은 기본 테마 clean 기준이며, 나머지 9개 테마는 같은 역할 이름에 다른 값을 넣습니다. 토큰을 바꿀 때는 JSON을 고치고 빌드합니다. -->

## Overview

**Creative North Star: "하루의 포켓 카드 (Pocket Moment)"**

하루 한 편의 일기가 휴대폰 주머니에 쏙 들어가는 작은 카드 한 장이 됩니다. 화면은 흰 종이처럼 조용하게 비워 두고, 색과 빛은 감정 카드에만 둡니다. 패널은 부드러운 그림자로 바닥에서 살짝 떠 있고 모서리는 크게 둥글어서 손에 쥐는 물건처럼 보입니다. 버튼은 누르면 살짝 눌리고, 카드는 기울기를 따라 빛이 흐릅니다. 가볍게 매일 꺼내 보는 일상의 손맛이 목표입니다.

밀도는 낮습니다. 기록 화면의 결정은 "쓰기 → 카드 받기" 하나로 모으고, 보조 동작은 `…` 메뉴와 텍스트 링크로 물러나 있습니다. 테마 10종은 바탕·표면·잉크·강조색만 바꾸며 레이아웃·형태·그림자 문법은 공유합니다.

피하는 분위기는 네 가지입니다.
- 병원·심리검사 같은 임상 느낌(점수, 게이지, 진단지)
- 게임 가챠처럼 요란한 느낌(네온, 과한 번쩍임, 희귀도 서열)
- 업무용 대시보드 느낌(촘촘한 표, 회색 관리자 화면)
- 유아적인 캐릭터 앱 느낌(과한 파스텔, 손글씨, 스티커 남발)

**Key Characteristics:**
- 조용한 흰 바탕 위에 3겹의 옅은 그림자로 떠 있는 둥근 패널(32px)
- 잉크색 알약 버튼 하나가 화면의 주 행동
- 색은 감정 카드(9색 블롭과 광채)에만 집중
- 데스크톱은 1440 기준 16:9 스테이지, 모바일은 하단 플로팅 3탭
- 누르면 0.97로 눌리고, 카드는 포인터를 따라 기울고 빛나는 촉감

## Colors

UI는 거의 무채색인 "하루의 시간" 팔레트이고, 채도는 감정 카드 9색이 맡습니다.

### Primary
- **밤 잉크 Night Ink** (`night-ink`): 주 버튼 바탕, 제목, 본문, 선택된 칩. 한 화면에서 가장 강한 면은 이 잉크 알약 하나입니다.
- **낮하늘 블루 Daysky Blue** (`daysky-blue`): 포커스 링(3px), 텍스트 링크, 연속 기록 칩처럼 "지금 여기를 누를 수 있다"는 신호에만 씁니다. 면을 채우는 색으로 쓰지 않습니다.

### Secondary
- **새벽 핑크 Dawn Pink** (`dawn-pink`): `● moment` 워드마크의 점. 브랜드 표식으로만 씁니다(빈 카드 계열 `--card-base-pos-1`과 같은 값).

### Tertiary: 감정 카드 9색
- 이 색들은 카드 블롭의 짙은 색(`--card-deep-*`)입니다. 각각 base(밝은 바탕)·mix(중간) 단계가 함께 있습니다.
  - 긍정: 기쁨·활력 `card-deep-pos-1` · 만족·감사 `card-deep-pos-2` · 안정·자신감 `card-deep-pos-3`
  - 부정: 불안 `card-deep-neg-1` · 슬픔 `card-deep-neg-2` · 분노 `card-deep-neg-3`
  - 중립: 객관적 서술 `card-deep-neu-1` · 의문 `card-deep-neu-2` · 놀람·당황 `card-deep-neu-3`
- 감정은 이 색으로만 구분합니다.

### Neutral
- **한낮 종이 Noon Paper** (`noon-paper`): 페이지 바탕과 패널 표면(clean). 글은 언제나 표면 위에서 씁니다.
- **아침 안개 Morning Mist** (`morning-mist`): 보조 버튼·칩 바탕, 작성 바(composer), 활성 탭 바탕, 무대 배경.
- **저녁 경계 Dusk Line** (`dusk-line`): 아주 옅은 구분선과 비어 있는 저장 버튼 바탕.
- **흐린 오후 Afternoon Gray** (`afternoon-gray`): 보조 글자(`--muted`). 의미 있는 글자는 최소 이 색입니다.
- **해질녘 Twilight Subtle** (`twilight-subtle`): placeholder, 요일 머리글 같은 장식용 힌트만.
- **오류 로즈 Error Rose** (`error-rose`): 저장 실패 표식, 글자 수 초과.

### Named Rules
**The Color Lives in the Card Rule.** 채도 높은 색은 감정 카드와 그 광채에만 둡니다. UI 크롬(바, 패널, 버튼)은 잉크·안개·종이로만 칠합니다. 카드 뒤 광채(`stage-glow`)도 카드 base 색에서 가져옵니다.

**The Muted Floor Rule.** 정보를 담은 글자는 `--muted` 이상의 대비로 씁니다. `--subtle`은 장식용 힌트에만 씁니다.

**The Theme Swaps Values, Not Roles Rule.** 새 색은 역할 토큰(`--color-*`)으로만 추가하고, 10개 테마 모두에 값을 넣습니다. 컴포넌트 CSS에 hex를 직접 쓰지 않습니다. 카드 색만 예외로, 카드 색은 테마와 무관하게 고정입니다.

## Typography

**Body Font:** Moment Sans (Pretendard Variable 서브셋, 한글 11,172자, 굵기 45~930 가변) → Pretendard → Apple SD Gothic Neo → Malgun Gothic
**Numeral/Wordmark Font:** Bricolage Grotesque (서브셋) → Moment Sans

**Character:** 한글은 담백하고 또렷한 Moment Sans 하나로 위계를 만듭니다. 워드마크·카드 번호·숫자에만 Bricolage Grotesque의 둥글고 개성 있는 라틴 글꼴을 씁니다.

### Hierarchy
- **Display** (600, 52px, 1.18, −0.02em; 첫 실행은 48px): 기록 화면의 오늘 질문형 제목. `word-break: keep-all`.
- **Headline** (600, 28~36px, 1.12): 화면 제목과 모바일 기록 제목(28px).
- **Title** (500, 15~18px, 1.4): 패널 머리글, 오늘 카드 문구, 달력 제목. 자간 0.
- **Body** (400, 17px, 1.85): 일기 입력창. 읽기 본문은 16px, 1.8.
- **Label** (400~500, 13px; 모바일 최소 11px): 상태 줄, 날짜, 보조 링크, 탭 라벨.
- **Numeral** (Bricolage 700~800): `moment` 워드마크 19px, 카드 머리 번호, 단계 숫자, 카운트업 숫자.

### Named Rules
**The One Family for Hangul Rule.** 한글에는 Moment Sans만 씁니다. Bricolage는 라틴 문자와 숫자 전용입니다.

**The Medium-Not-Bold Rule.** 제목은 600, 패널 머리글은 500을 씁니다. 700 이상은 워드마크·숫자·오늘 날짜 강조에만 씁니다.

## Layout

- **데스크톱(≥960px)**: 1440×810 기준 16:9 스테이지입니다. `app.js size()`가 `--stage-w`·`--stage-zoom`을 정합니다.
  - 1440 미만에서는 배율 1의 유동 레이아웃, 이상에서는 비례 확대입니다.
  - 셸 안쪽 여백은 상하 24px, 좌우 `clamp(24px, 2.78vw, 40px)`이고, 본문은 다시 40px 들어갑니다.
  - 기록 화면은 19:12 두 열입니다(간격 28×40px). 왼쪽은 제목·작성 패널·최근 기록 타일 2개, 오른쪽은 오늘의 카드 무대와 주간/월간 카드 달력입니다.
- **모바일(≤959px)**: 최대 760px 한 열입니다.
  - 여백은 `clamp(14px, 4.2vw, 20px)`과 safe-area 중 큰 값입니다.
  - 상단은 워드마크와 아바타만 둡니다. 탭은 하단 플로팅 알약(좌우 20px, 하단 12px + safe-area)으로 내려갑니다.
  - 입력 중에는 하단 탭을 숨깁니다.
- **간격 리듬**: 4의 배수를 기본으로 12·24·28·36이 자주 쓰입니다. 패널 안쪽 28px, 패널 사이 24px, 제목과 패널 사이 36px.

## Elevation & Depth

떠 있는 말랑함입니다. 표면은 3겹의 옅은 그림자로 바닥에서 살짝 떠 있으며, 선(border)으로 구분하지 않습니다. 다크 테마(night, tearoom)에서는 같은 구조의 검은 그림자로 바꿉니다. 카드는 UI보다 한 단계 더 떠서 `drop-shadow`와 감정색 광채를 가집니다.

### Shadow Vocabulary
- **Soft panel** (`box-shadow: 0 30px 60px -20px rgb(38 38 51 / .08), 0 10px 24px -6px rgb(38 38 51 / .06), 0 1px 2px rgb(38 38 51 / .06)`): 패널, 상단 바, 대화상자, 타일, 모바일 하단 탭.
- **Soft small** (`box-shadow: 0 10px 24px -8px rgb(38 38 51 / .08), 0 1px 2px rgb(38 38 51 / .06)`): 부채꼴 배경 카드와 작은 떠 있는 요소.
- **Card lift** (`filter: drop-shadow(0 18px 28px rgb(17 17 20 / .14))`): 5:7 감정 카드 본체.
- **Mini card** (`box-shadow: 0 1px 2px rgb(0 0 0 / .06), 0 6px 14px rgb(0 0 0 / .08)`): 도감·달력·목록의 미니카드.

### Named Rules
**The No-Border Rule.** 패널과 버튼에는 테두리가 없습니다(`border: 0`). 구분은 그림자와 안개색 바탕으로만 합니다. 포커스만 파란 링으로 둡니다(작성 패널은 `0 0 0 2px` 링 + 그림자).

**The Card Floats Highest Rule.** 감정 카드보다 높이 뜨는 UI는 대화상자와 바텀시트뿐입니다.

## Shapes

- 큰 곡률로 손에 쥐는 물건처럼 만듭니다.
  - 패널: 32px
  - 타일: 28px
  - 카드: 폭 × 96/1080, 320px 카드에서 약 28px. `--card-r`로 계산합니다.
  - 오늘 카드: 23px
  - 버튼·칩·탭·작성 바·상단 바: 완전한 알약(999px)
- 미니카드 모서리는 `9% / 6.43%`의 비율 반경이라 크기가 달라도 같은 모양으로 보입니다.
- 원형은 아바타(40px, 모바일 34px), 브랜드 점(22px), 상태 점(14px), 단계 원에 씁니다.
- 카드 캐릭터는 물결 블롭에 빛나는 알약 눈 두 개입니다(`blob-art.js`, Figma 수치 그대로).
- 등급 광채의 링은 카드 모서리와 동심원입니다.

## Components

### Buttons
촉감 있고 반응합니다. 누르면 0.97로 눌리고, hover에서는 살짝 옅어집니다.
- **Shape:** 완전한 알약(999px), 최소 높이 44px
- **Primary:** 밤 잉크 바탕에 흰 글자, 15px/600, 패딩 13×24px. 화면마다 하나만 둡니다("기록하고 카드 받기", 모바일 "카드 받기").
- **Primary (empty):** 초안이 비면 저녁 경계색 바탕과 흐린 글자로 쉬는 상태가 됩니다. 눌렀을 때 이유를 알려 줍니다(`aria-disabled`).
- **Secondary / Quiet / Icon:** 아침 안개 바탕, 500. hover에서는 안개와 선을 섞은 색이 됩니다.
- **Text link:** 낮하늘 블루 500, 44px 터치 영역.
- **Hover / Focus / Active:** transform·opacity .18s ease, 포커스는 3px 블루 링(offset 2px), 눌림은 `scale(.97)`

### Chips
- **Style:** 아침 안개 바탕, 잉크 글자, 알약, 테두리 없음
- **State:** 선택(`aria-pressed`/`aria-current`)되면 잉크 바탕과 흰 글자로 반전됩니다. 연속 기록 칩은 바탕 없이 블루 12px입니다.

### Cards / Containers
- **Corner Style:** 패널 32px, 타일 28px
- **Background:** 표면색(clean은 흰색)
- **Shadow Strategy:** Soft panel (Elevation 참조)
- **Border:** 없음
- **Internal Padding:** 28px. 작성 패널은 입력창 36×40px, 아래 24px.
- **최근 기록 타일:** 왼쪽 위 74px 흐린 감정색 구슬(`tile-orb`)과 한 줄 미리보기(15px/500)를 둡니다. hover에서 2px 떠오릅니다.

### Inputs / Fields
- **일기 입력창:** 테두리·배경 없이 패널 표면에 바로 씁니다. 17px/1.85, 최소 높이 264px, placeholder는 해질녘색입니다.
- **작성 바(composer):** 패널 안 아래쪽의 안개색 알약(높이 56px)입니다. 상태 점, 상태 줄(자동 저장·글자 수), `…` 메뉴, 주 버튼이 들어갑니다.
- **Focus:** 입력창 자체는 외곽선이 없고, 패널 전체에 2px 블루 링이 둘러집니다.
- **Error:** 저장에 실패하면 연분홍 바와 오류 로즈색 원 표식이 나타나고, `storage-details` 링크와 "다시 시도"가 붙습니다. 글자 수는 ok → warn(#a15c00) → over(오류 로즈, 600) 순으로 바뀝니다.

### Navigation
- **데스크톱:** 하나의 흰 알약 상단 바(높이 64px, Soft panel)에 `● moment` · 탭 3개(기록·통계·도감) · 아바타가 들어갑니다.
  - 탭은 15px/400 흐린 글자입니다. 활성 탭은 안개 바탕에 잉크 600, hover는 안개 60%입니다.
- **모바일:** 상단 바는 투명하게 두고 워드마크(18px)와 아바타(34px)만 남깁니다. 탭은 하단 플로팅 3칸 알약(아이콘 22px + 라벨 11px, 칸 높이 50px)입니다.
- **아바타:** 테마 표면과 62% 섞은 색 동그라미(다크는 38%)에 블롭 화풍 아이콘을 얹습니다. 활성일 때 2px 표면 + 4px 잉크 이중 링입니다.

### Moment Card (Signature)
- 5:7(1080×1512) 카드입니다.
  - 위: 머리 번호
  - 가운데: 감정색 창 안의 블롭 캐릭터
  - 아래: 감정 이름 띠
- 색은 감정, 테두리·재질·움직임은 등급을 나타냅니다.
  - 빈 카드: 점선과 정지
  - 1단계: 광채와 반광 펄스
  - 2단계: 이중 링, 금속 프레임, 꺾쇠
  - 3단계: 홀로그램 링, 프리즘 반사광, 포인터 추적
- 카드는 포인터·기울기를 따라 포일 빛이 움직입니다.
- 미니카드는 같은 틀을 HTML과 컨테이너 단위로 축소한 것입니다.
- 오늘의 카드 무대에서는 부채꼴로 놓인 파스텔 카드 두 장 위에 오늘 카드를 올리고, 뒤에 복숭아→라벤더 광채를 깝니다.

## Do's and Don'ts

### Do:
- **Do** 한 화면의 주 행동은 밤 잉크 알약 버튼 하나로 둡니다.
- **Do** 패널은 흰 표면, 32px 모서리, Soft panel 그림자로 띄우고 테두리를 쓰지 않습니다.
- **Do** 감정은 카드 9색(`--card-deep-*`/base/mix)으로만 구분하고, 등급은 효과로만 구분합니다.
- **Do** 터치 영역은 최소 44px로 하고, 작은 버튼은 투명 `::after`로 넓힙니다.
- **Do** 새 색은 역할 토큰으로 10개 테마 모두에 정의하고, 토큰 JSON을 고친 뒤 빌드합니다.
- **Do** 움직임은 `--soft-ease`(cubic-bezier(.22,.8,.3,1))를 기본으로 하고, `prefers-reduced-motion`에서는 불투명도만 쓰는 정지 대체를 둡니다.

### Don't:
- **Don't** 점수, 게이지, 퍼센트를 크게 강조하지 않습니다. 진단지처럼 보이는 "병원·심리검사 같은 임상 느낌"을 내지 않습니다.
- **Don't** 네온, 무지개 번쩍임, 희귀도 서열을 쓰지 않습니다. "게임 가챠처럼 요란한 느낌"이 되지 않게 하고, 3단계 홀로그램도 초당 3회 미만으로 맥동합니다.
- **Don't** 촘촘한 표나 회색 관리자 화면 같은 "업무용 대시보드 느낌"을 내지 않습니다.
- **Don't** 손글씨 글꼴, 스티커 남발, 과포화 파스텔을 쓰지 않습니다. "유아적인 캐릭터 앱 느낌"이 되지 않게 합니다.
- **Don't** UI 크롬(바·패널·버튼)에 감정 카드 색이나 그라데이션을 칠하지 않습니다.
- **Don't** 의미 있는 글자에 `--subtle`을 쓰지 않고, 모바일에서도 정보 글자를 11px 미만으로 줄이지 않습니다.
- **Don't** 공유 PNG에 등급 이펙트를 넣지 않습니다.
