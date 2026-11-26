# 메인 프론트 통합 검증

2026-11-11에 Docker 미리보기(:8080)의 diary-benchmark-v1 기능을 메인 모듈에 이식하고 공식 빌드로 생성했습니다. 기존 미리보기 컨테이너는 변경하지 않았습니다.

| 검사 | 결과 |
| --- | --- |
| node tools/build.mjs | 성공, 기존 생성물 버전 백업·원본 일치 확인 |
| node --test tests/*.test.cjs | 62개 통과 |
| node tests/browser.cjs | 46개 검사·1080×1620 PNG·외부 요청/실행 오류 없음 |
| node tests/benchmark-browser.cjs | 55개 통과: 검색·IME·즐겨찾기·JSON·반응형·시안 저장소 격리 |
| node tests/compatibility-browser.cjs | 이전 메인 기록·초안·작성 방식·테마 보존, favorite 기본값·재실행 복원 통과 |
| node tests/persistence-browser.cjs | 저장·수정·삭제·재시도·탭 충돌·손상·차단·초점·터치·10감정/3단계 통과 |
| node tests/themes.cjs | 6테마·12팔레트/PNG·5화면 크기·설정 유지·오프라인 통과 |
| node tests/taxonomy-browser.cjs | 10감정·30슬롯·중립 표식·PNG·반응형 통계 통과 |
| MOMENT_LAN_URL 지정 후 node tests/mobile-lan.cjs | 별도 메인 정적 서버 :8081의 LAN HTTP에서 UUID 대체 생성·저장·재로드·즐겨찾기·읽기 통과 |
| git diff --check | 통과 |

검사는 임시 브라우저와 합성 기록으로 실행했습니다. 실제 iOS Safari와 소프트 키보드는 별도 확인이 필요합니다. 기존 와이어프레임은 이전 화면의 참고 자료입니다.

- [모바일 작성](write-mobile.png)
- [모바일 저장 카드](card-mobile.png)
- [PC 작성](write-pc.png)
- [JSON 이전](restore-mobile.png)
- [LAN 검증](lan-CgNI29/results.json)

시안에서 JSON을 내보낸 뒤 메인 설정 → 데이터 관리에서 파일을 선택하고 미리보기 후 합칩니다. 메인의 저장소·설정 키는 유지하며 자동 이전과 분석 API 연결은 추가하지 않았습니다.
