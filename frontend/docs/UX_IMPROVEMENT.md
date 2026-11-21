# UX 개선 기록

> 작성일: 2026-11-15
> 브랜치: `HW`
> 대상 커밋: `95e1740` ~ `b6102d6`. 이 중 `91e5baa`는 `244c4b8`로 되돌렸습니다.
> 관련 문서: [화면 명세](UI_SPEC.md) · [분석 계약](API_CONTRACT.md) · [QA](QA.md) · [작업 목록](ROADMAP.md)

## 1. 요약

"오늘의 모먼트"의 목적은 다음 흐름입니다.

> 사용자가 기록을 쓴다 → 학습된 모델이 감정을 분석한다 → 결과가 카드·캐릭터 도감·통계로 쌓인다

이번 작업에서는 실행 중인 메인 프론트의 UX를 점검했고, 실제 서비스 중인 다이어리 앱 5개를 벤치마크했습니다. 개선은 이 목적을 해치지 않는 범위로만 반영했습니다.

모델 연결은 이번 범위에서 제외했고 다음 단계로 남겼습니다. 그래서 지금 실제 기록은 계속 "분석 대기"로 표시됩니다. 분석 결과를 보여 주는 개선(달력의 감정 점, 월간 요약)은 예시 모드로 검증했습니다. 이 개선들은 모델을 연결하면 별도 수정 없이 실제 기록에도 적용됩니다.

## 2. 배경과 판단 기준

### 2.1 출발점
처음 점검했을 때 확인한 문제는 다음과 같습니다.

**분석 상태**
- 실제 기록이 계속 "분석 대기"라서 카드·도감·통계를 사용할 수 없었습니다.
- 대기 카드의 앞면 제목 자리에 보관 상태 문구가 들어가 있었습니다.

**작성 경험**
- 글자 수 카운터가 없었습니다.
- 초안이 10,000자를 넘으면 엉뚱한 "형식 오류" 문구가 나왔습니다.
- 작성 질문이 1개로 고정되어 있었습니다.
- 30편 한도에 닿기 전에는 아무 안내가 없었습니다.

**흐름**
- 예시 모드에서 저장하면 안내 없이 실제 모드로 바뀌었습니다.
- 상세 화면에서 돌아가면 항상 기록 목록으로 이동했습니다.
- 삭제를 되돌릴 수 없었습니다.

**회고**
- 월 이동 버튼이 화면에 없었습니다. 연결 코드만 남아 있었습니다.

**접근성**
- 「무엇을 쓸까요?」 버튼의 `aria-expanded`가 실제 상태와 맞지 않았습니다.
- 카드 효과가 OS의 움직임 줄이기 설정을 무시했습니다.

### 2.2 범위 기준
개선안은 다음 두 가지 중 하나를 만족할 때만 반영했습니다.

1. **분석할 기록을 쓰기 쉽게 한다.**
2. **모델 분석 결과(카드·도감·통계)를 더 잘 전달한다.**

다음 경우에는 둘 중 하나를 만족하더라도 반영하지 않았습니다.
- 모델 분석을 대체하는 기능
- 모델이 분석할 기록 본문을 바꾸는 기능

## 3. 벤치마크 (실제 서비스 중인 다이어리 앱 5개)

| 앱 | 핵심 UX | 이 프로젝트에 반영 | 반영 방식 |
|---|---|---|---|
| **하루콩 (DailyBean)** | 기분 콩 선택, 월 달력이 기분 색으로 채워지고 날짜를 누르면 그날 기록이 열림. 약점: 날짜 숫자가 가려짐 | 일부 | 달력에 **모델이 분석한** 대표 감정 점을 날짜 숫자 아래에 표시합니다. 숫자는 가리지 않습니다. 기분 직접 선택은 반영하지 않았습니다 |
| **Daylio** | 두 번 탭 기분 입력, Year in Pixels, 연속 기록·알림·업적 | 일부 | 월 이동 버튼과 오늘 강조. 연속 기록 압박과 푸시 알림은 제외했습니다 |
| **How We Feel** | 무드 미터로 감정 선택, 감정 단어 정의, 주간 AI 리뷰(그 주 기록 3개 이상일 때) | 일부 | **분석된 기록이 3편 이상일 때만** 보여 주는 월간 요약 문구 |
| **Day One** | 매일 질문·템플릿, 회상 기능, AI 요약 | 반영 | 날짜별 작성 질문과 「다른 질문」 버튼. 질문은 보여 주기만 하고 본문에 넣지 않습니다 |
| **Stoic** | 아침·저녁 체크인, 질문, 기록 직후 짧은 피드백 | 보류 | "분석 결과 공개" 화면은 모델을 연결한 뒤 반영합니다(§9) |

출처
- 하루콩: [App Store](https://apps.apple.com/KR/app/id1553223828), [브런치 리뷰](https://brunch.co.kr/@uibowl/372), [감정앱 비교 후기](https://brunch.co.kr/@sarayun/92)
- Daylio: [daylio.net](https://daylio.net/), [Wikipedia](https://en.wikipedia.com/wiki/Daylio), [리뷰](https://makeheadway.com/blog/daylio-review/)
- How We Feel: [App Store](https://apps.apple.com/sg/app/how-we-feel/id1562706384), [리뷰](https://www.wantedonline.co.za/tech-and-gadgets/2023-02-23-review-how-we-feel-app/)
- Day One: [Release notes 2026-03-30](https://dayoneapp.com/releases/2026-7/)
- Stoic / Reflectly: [App Store](https://apps.apple.com/us/app/stoic/id1312926037), [비교](https://www.reflection.app/best-journaling-apps-compared/stoic-vs-reflectly)

## 4. 결정 기록

| 결정 | 내용과 이유 |
|---|---|
| **감정 직접 고르기 도입 후 되돌림** | `91e5baa`에서 하루콩·Daylio 방식으로 도입했습니다. 기록마다 사용자가 감정을 고르는 선택 필드 `selfLabel`을 추가했습니다. 그런데 이 기능은 모델 분석을 대체해 프로젝트 목적과 맞지 않았고, `244c4b8`로 전부 되돌렸습니다. 이 결정은 `CLAUDE.md`·`AGENTS.md`에 "모델 분석을 매핑이나 직접 선택으로 대체하지 않는다"로 명시했습니다 |
| **카드 효과 기본값을 OS 설정에 맞춤** | 사용자 결정입니다. 저장된 선택이 없으면 OS의 움직임 줄이기 설정을 따르고, 사용자가 직접 고른 `on`/`off`는 OS 설정보다 우선합니다. 이에 맞춰 `UI_SPEC.md`와 `card-effects.cjs`를 고쳤습니다 |
| **홈 「카드 보기」 버튼 제외** | 계획에 있던 항목이지만 넣지 않았습니다. 홈에 보이는 버튼을 8개로 제한하는 사양(`home-view.cjs`)이 있고, 최근 기록 목록의 첫 줄이 이미 같은 카드를 엽니다 |
| **첫 실행 안내를 홈 요약 패널에 표시** | 대화상자는 첫 화면을 가리고 모든 브라우저 테스트의 시작 흐름을 바꿉니다. 그래서 기록이 없을 때만 보이는 비차단형 안내로 만들었습니다. 저장 키를 따로 두지 않습니다 |
| **질문을 본문에 넣지 않음** | 질문 문구가 본문에 들어가면 모델 입력이 오염됩니다 |
| **제외한 기능** | 감정 직접 선택·활동 태그(분석 대체), 연속 기록 압박·푸시 알림(목적과 무관하고 단일 HTML 앱이라 불가), 사진·날씨(분석 대상 아님) |

## 5. 완료한 작업

| 커밋 | 묶음 | 변경 내용 | 주요 파일 | 테스트 |
|---|---|---|---|---|
| `95e1740` | P0 | 글자 수 카운터(9,000자부터 경고, 초과 시 초과분 표시, 자동으로 자르지 않음). 초안이 10,000자를 넘을 때 전용 오류 문구. 예시 모드에서 저장 시 확인 대화상자(`confirmAction`으로 공용화). 모드별 PNG 저장 문구. `aria-haspopup="dialog"` | `diary-core.js`(`lengthState`), `storage.js`, `home-view.js`, `app.js`, `benchmark.css` | `diary.test.cjs`, `storage.test.cjs`, 신규 `ux-p0.cjs` |
| `4c86508` | P0 | 카드 효과 기본값을 OS의 움직임 줄이기 설정에 맞춤 | `theme.js`, `UI_SPEC.md` | `card-effects.cjs` |
| ~~`91e5baa`~~ | — | 감정 직접 고르기. `244c4b8`로 되돌림 | — | — |
| `389ac7e` | A | 대기 카드 앞면 제목을 "분석 대기"로 변경(보관 상태는 카드 아래 설명에만 표시). `record-ui.cjs` 실패 원인 분석과 수정. `CLAUDE.md`·`AGENTS.md`의 감정 체계 설명(3+10, 30칸) 수정 | `app.js`, `CLAUDE.md`, `AGENTS.md` | `record-ui.cjs`, `ux-p0.cjs` |
| `42216ea` | B | 작성 질문 18개를 날짜별로 보여 주고 「다른 질문」 제공(본문 미삽입). 실제 기록 25편부터 남은 편수 안내. 30편이면 「백업 후 정리하기」로 설정 › 데이터 관리 이동 | `diary-core.js`(`PROMPTS`, `writingPrompt`, `recordLimitState`), `benchmark.js`, `home-view.js`, `app.js` | `diary.test.cjs`, 신규 `ux-writing.cjs` |
| `a01737d` | C | 이전 달·다음 달 버튼(이번 달에서는 다음 달 비활성, 포커스 유지). 오늘 강조(`aria-current="date"`). 분석된 날의 대표 감정 점. 월간 요약(분석 3편 이상일 때만, 동률이 3개 이상이면 "고르게") | `statistics.js`(`insight`, `dayEmotion`, `shiftMonth`), `statistics-view.js` | `statistics.test.cjs`, 신규 `ux-retro.cjs` |
| `b6102d6` | D | 삭제 되돌리기 토스트(8초, 포인터나 포커스가 있으면 멈춤, 같은 id·version으로 복원 후 다시 저장, 전체 삭제·모드 전환·30편 한도에서는 미제공). 상세 화면에서 출발한 화면으로 돌아가기(「홈으로」/「목록으로」). 첫 실행 3단계 안내. 삭제·수정 문구 버그 수정. `UI_SPEC.md` 정리 | `app.js`, `home-view.js`, `templates/shell.html`(`#toast`), `benchmark.css`, `UI_SPEC.md` | 신규 `ux-general.cjs`, `record-ui.cjs` |

공통 작업 방식
- 기존 파일은 수정하기 전에 `.backups/`에 버전 백업을 남겼습니다. 셸로 파일을 바꾼 되돌리기 작업 전에는 수동으로 백업했습니다.
- `index.html`은 직접 편집하지 않고 항상 `node tools/build.mjs`로 다시 만들었습니다.

## 6. 함께 발견해 고친 기존 문제

| 문제 | 원인 | 조치 |
|---|---|---|
| `record-ui.cjs`가 변경 전부터 실패 | `action()`이 시작할 때 `state.error`를 먼저 해제합니다. 그래서 테스트가 재시도 저장이 끝나기 전에 다음 확인으로 넘어갔습니다. 앱 화면은 정상이었습니다 | 저장 완료 문구까지 기다리도록 테스트를 수정했습니다(`benchmark-browser.cjs`와 같은 방식) |
| 삭제·수정해도 "기록을 저장했어요"가 표시 | 저장 후 문구가 동작과 관계없이 하나로 고정되어 있었습니다 | 삭제, 수정, 새 기록, 저장마다 문구를 나눴습니다 |
| 초안이 10,000자를 넘으면 "저장된 기록 형식을 확인할 수 없어요" | 스냅샷 검증이 일반 형식 오류만 던졌습니다 | 길이 초과를 먼저 판별해 전용 문구를 보여 줍니다 |

## 7. 데이터·저장 영향

- **IndexedDB:** `moment-diary-main` 스키마 v1을 그대로 유지합니다. 필드는 추가하지 않았습니다. 잠시 추가했던 `selfLabel`과 `draftLabel`은 되돌리면서 제거했습니다.
- **localStorage:** 기존 `card-motion` 키의 기본값 해석만 바뀌었습니다. 새 키는 없습니다.
- **분석 계약:** [`API_CONTRACT.md`](API_CONTRACT.md)는 바뀌지 않았습니다. 달력 점과 월간 요약은 이 계약의 `valid` 분석만 사용합니다.

## 8. 검증 현황

마지막 전체 실행 결과(`b6102d6` 기준)
- 단위 테스트: `node --test tests/*.test.cjs`, **69개 통과**
- 브라우저 스크립트 **15개 통과**
  - 이번 작업에서 새로 만든 것: `ux-p0`, `ux-writing`, `ux-retro`, `ux-general`
  - 기존 스크립트: `ux`, `browser`, `record-ui`, `benchmark-browser`, `persistence-browser`, `home-view`, `card-effects`, `themes`, `simplification`, `taxonomy-browser`, `compatibility-browser`
- 데스크톱(1366px)과 모바일(360px) 화면을 캡처해 눈으로 확인했습니다.

```powershell
cd frontend
node tools/build.mjs
node --test tests/*.test.cjs
node tests/ux-p0.cjs; node tests/ux-writing.cjs; node tests/ux-retro.cjs; node tests/ux-general.cjs
```

**미검증:** 실제 기기와 모바일 키보드, Safari·Firefox, 한국어 화면 낭독기. [QA](QA.md)의 기존 미검증 항목과 같습니다.

## 9. 남은 일

### 9.1 모델 연결 (다음 단계)

3+10 체계(긍정 3·부정 3·중립 4)로 학습된 모델은 이미 있으며 Drive로 공유되어 있습니다. 연결 순서는 다음과 같습니다.

1. **체크포인트 확보:** 체크포인트를 내려받아 저장소 밖에 둡니다.
2. **라벨 확인:** `label_mapping.json`과 `id2label`로 프론트 ID와의 대응을 확정합니다. 표시명은 모델 라벨에 맞춥니다.
3. **모델 선택:** 후보 4종의 validation·test 성능을 비교해 고릅니다.
4. **백엔드:** `POST /api/records/analyze`를 만듭니다.
   - 요청은 기록 단위로 받습니다.
   - 응답은 API_CONTRACT의 분석 객체 형식을 따릅니다.
   - 긴 기록은 토큰 윈도우로 나눠 분석하고 가중 평균을 냅니다.
   - 오류는 422와 503으로 반환합니다.
5. **프론트**
   - 분석 클라이언트 모듈을 추가합니다.
   - 분석 상태를 `pending` → `analyzing` → `valid` 또는 `error`로 바꾸고, 실패 시 「다시 분석」을 제공합니다.
   - 저장소에 유효한 분석을 보존합니다(현재는 불러올 때 전부 대기로 초기화).
   - 개인정보 안내 문구를 바꿉니다(분석 시 서버로 전송).
6. **분석 결과 공개 화면** (Stoic 참고): 분석이 끝나면 카드로 보여 줍니다.

### 9.2 그 밖의 후보

- 작은 조작 영역 점검([ROADMAP](ROADMAP.md) D-04)
- 텍스트·Markdown 내보내기
- 1년 격자 보기(Year in Pixels)
