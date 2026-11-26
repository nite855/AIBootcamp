# MOMENT CARD Integrated TCG Dashboard 2026-11-03

하나의 서비스 안에서 **분석 요약 → 상세 탐색 → TCG 카드 → 공유**를 연결한 신규 버전입니다. 기존 `tcg-social-studio-v1`, `emotion-cardex*`, 루트 `index.html`, 서버와 문서는 변경하지 않습니다.

[Figma 신규 파일](https://www.figma.com/design/mSzWvUeNhLC6Gr2rwXJCgb?node-id=5-144) · [모바일](https://www.figma.com/design/mSzWvUeNhLC6Gr2rwXJCgb?node-id=8-117) · [전체 설계 및 다이어그램](docs/DIAGRAMS.md) · [현황 및 변경 비교](docs/AUDIT.md) · [요구사항](docs/SRS_2026-11-03.md) · [구현 설계](docs/SDS_2026-11-03.md) · [화면 명세](docs/SCREENS.md) · [컴포넌트](docs/DESIGN_SYSTEM.md) · [QA](docs/QA.md)

## 실행

`index.html`을 브라우저에서 직접 열 수 있습니다. CSS, JS와 기존 IBM Plex Sans KR 서브셋 폰트가 내장되어 앱 실행에 외부 CDN·빌드·네트워크가 필요하지 않습니다. 미포함 한글은 운영체제 글꼴로 대체됩니다. 폰트 라이선스는 `docs/licenses/ibm-plex-sans-kr.txt`입니다.

선택적으로 저장소 루트에서 `python -m http.server 8000`을 실행하고 `http://localhost:8000/design-lab/integrated-tcg-2026-11-03/`을 여세요. 루트 FastAPI는 이 경로를 자동 제공하지 않습니다.

**실제 분석의 경계:** 운영 3+7 감정 모델·LLM·캐릭터 이미지 API는 미연결입니다. 업로드한 파일은 실제 로컬 파싱·화자 선택 후 연결 대기를 표시합니다. 예시 버튼을 눌렀을 때만 별도의 가상 결과를 표시합니다. 기존 6분류 `/api/analyze`를 새 라벨로 바꾸거나 호출하지 않습니다.

## 변경

- 메인 대시보드에 표본 범위·대표 부모·최다 소분류·3/7분포·3계열 흐름·반복 표현·캘린더·TCG 카드·사실 설명을 함께 배치했습니다.
- 흐름·분포·기간·표현·도감·공유는 상세 화면에서 탐색합니다. 공통 상단 탐색과 모바일 하단 메뉴, 대시보드 복귀 경로를 연결했습니다.
- 드래그앤드롭, 화자 이름 직접 입력 검증, 반복 표현 정렬·등장 비율·원본 근거를 보강했습니다.
- 파일 읽기 요청에 순번을 부여해 이전 비동기 응답이 새 파일을 덮어쓰지 못하게 했습니다.
- 최신 표시명 `pos_3 → 평온`, 7개 전체 확률, 부모 합산, 원본 발화 기준 반복 집계, 날짜 결측, 기존 공유 공개 허용 목록을 유지했습니다.
- 공유 1:1/4:5, 골드/잉크, 수치 공개 선택, PNG, 블로그 요약과 기기 공유 대체 경로를 보존했습니다.

## 검증

도메인 18개·화면 마크업 및 공유 출력 10개 검사 통과. 17개 라우트 마크업, 확률·분모·윈도우·반복 표현·기간 가중 평균·공유 개인정보·두 PNG 규격의 실제 바이트를 확인했습니다. 추가 통합 검사와 최종 결과는 [QA](docs/QA.md)에 있습니다.

Chromium 설치 파일을 정상적으로 받을 수 없어 **실제 브라우저 렌더링·클릭 E2E·다운로드·Web Share·실기기·키보드·WCAG AA 전체 통과는 미검증**입니다. Figma는 편집 가능한 레이어와 이동 대상의 구조 검증이며 실제 파일 업로드나 모델 실행이 아닙니다.

## 재생성과 테스트

```bash
node design-lab/integrated-tcg-2026-11-03/tools/build.mjs
node --test design-lab/integrated-tcg-2026-11-03/tests/core.test.cjs
node --test design-lab/integrated-tcg-2026-11-03/tests/social.test.cjs
node --test design-lab/integrated-tcg-2026-11-03/tests/integration.test.cjs
```

출력 테스트에는 개발 환경의 `@napi-rs/canvas`, 브라우저 테스트에는 `playwright`와 Chromium이 필요합니다. 앱 자체의 의존성은 아닙니다. 원본 도메인·출력 테스트는 이번 버전 경로에서 재사용했습니다. 예전 버전의 브라우저 테스트에 이번 화면 구조가 달라진 부분은 별도 갱신 후 실행해야 합니다.
