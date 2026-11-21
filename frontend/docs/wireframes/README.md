# 오늘의 모먼트 와이어프레임

index.html을 열어 PC·모바일 화면과 상태를 선택하세요. 기본 14개 화면과 12개 상태를 각 크기로 만든 SVG 52개입니다. SVG는 벡터 도형과 텍스트이며 래스터 이미지·foreignObject·외부 글꼴 요청을 포함하지 않습니다.

## 화면 목록

- WF-01 일기 작성 ([PC](svg/desktop/WF-01.svg), [모바일](svg/mobile/WF-01.svg))
- WF-02 예시 감정 카드 ([PC](svg/desktop/WF-02.svg), [모바일](svg/mobile/WF-02.svg))
- WF-03 보관함 ([PC](svg/desktop/WF-03.svg), [모바일](svg/mobile/WF-03.svg))
- WF-04 기록 상세 ([PC](svg/desktop/WF-04.svg), [모바일](svg/mobile/WF-04.svg))
- WF-05 기록 수정 ([PC](svg/desktop/WF-05.svg), [모바일](svg/mobile/WF-05.svg))
- WF-06 설정 ([PC](svg/desktop/WF-06.svg), [모바일](svg/mobile/WF-06.svg))
- WF-07 감정 추이 ([PC](svg/desktop/WF-07.svg), [모바일](svg/mobile/WF-07.svg))
- WF-08 월간 기록 ([PC](svg/desktop/WF-08.svg), [모바일](svg/mobile/WF-08.svg))
- WF-09 감정 분포 ([PC](svg/desktop/WF-09.svg), [모바일](svg/mobile/WF-09.svg))
- WF-10 날짜별 기록 목록 ([PC](svg/desktop/WF-10.svg), [모바일](svg/mobile/WF-10.svg))
- WF-11 캐릭터 도감 ([PC](svg/desktop/WF-11.svg), [모바일](svg/mobile/WF-11.svg))
- WF-12 해제한 캐릭터 ([PC](svg/desktop/WF-12.svg), [모바일](svg/mobile/WF-12.svg))
- WF-13 미발견 캐릭터 ([PC](svg/desktop/WF-13.svg), [모바일](svg/mobile/WF-13.svg))
- WF-14 유형·단계별 기록 ([PC](svg/desktop/WF-14.svg), [모바일](svg/mobile/WF-14.svg))
- ST-09 빈 카드: 30% 미만 ([PC](svg/desktop/ST-09.svg), [모바일](svg/mobile/ST-09.svg))
- ST-10 1단계: 30% 이상 ([PC](svg/desktop/ST-10.svg), [모바일](svg/mobile/ST-10.svg))
- ST-11 2단계: 60% 이상 ([PC](svg/desktop/ST-11.svg), [모바일](svg/mobile/ST-11.svg))
- ST-12 3단계: 90% 이상 ([PC](svg/desktop/ST-12.svg), [모바일](svg/mobile/ST-12.svg))
- ST-01 입력 오류 ([PC](svg/desktop/ST-01.svg), [모바일](svg/mobile/ST-01.svg))
- ST-02 브라우저 보관 · 분석 준비 ([PC](svg/desktop/ST-02.svg), [모바일](svg/mobile/ST-02.svg))
- ST-03 보관함에 기록 없음 ([PC](svg/desktop/ST-03.svg), [모바일](svg/mobile/ST-03.svg))
- ST-04 선택 월에 기록 없음 ([PC](svg/desktop/ST-04.svg), [모바일](svg/mobile/ST-04.svg))
- ST-05 감정 분석 없음 ([PC](svg/desktop/ST-05.svg), [모바일](svg/mobile/ST-05.svg))
- ST-06 분석된 날짜 하루 ([PC](svg/desktop/ST-06.svg), [모바일](svg/mobile/ST-06.svg))
- ST-07 삭제 재확인 ([PC](svg/desktop/ST-07.svg), [모바일](svg/mobile/ST-07.svg))
- ST-08 이미지 저장 실패 ([PC](svg/desktop/ST-08.svg), [모바일](svg/mobile/ST-08.svg))

## 흐름과 제약

작성 → 임시 보관 안내 / 설정 → 예시 카드 / 보관함 → 기록 상세 → 수정·삭제 확인 / 돌아보기 → 통계 3종 → 날짜별 기록 → 상세 → 목록 → 돌아보기. 입력과 실제 분석은 시연하지 않습니다. SVG의 버튼 링크는 함께 배포한 HTML을 엽니다. 상단 검토 도구는 제품 메뉴가 아닙니다. HTML 문서는 스크롤할 수 있지만 각 앱 프레임은 고정 크기입니다. 작은 화면에서는 SVG 전체를 비례 축소합니다.

예시 날짜는 검토를 위해 2026-11-03으로 고정했습니다. 예시 통계는 구조 설명용이며 실제 데이터 집계 결과가 아닙니다. 기록 한 편에 카드 한 장을 연결하며 도감은 10유형 × 3단계입니다. 30% 미만은 빈 카드, 30% 이상은 1단계, 60% 이상은 2단계, 90% 이상은 3단계입니다. 현재 유효한 기록만으로 도감을 재계산합니다. 원문 스크롤·입력·분석·이미지 저장 로딩은 주석으로 표시하고 오류 상태는 별도 프레임으로 제공합니다. 기존 앱은 수정하지 않았습니다.

재생성: 프로젝트 폴더에서 node tools/build-wireframes.mjs
검증: node tests/wireframes.cjs
글꼴 라이선스: font-license.txt
