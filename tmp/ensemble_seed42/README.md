# FL03 9분류 확률 평균 앙상블 seed 42

구성은 가중 CE와 가중 CE R-Drop 두 모델입니다. 각 모델의 9개 softmax 확률을 50:50으로 평균합니다.

## 실행

현재 torch+CUDA 환경:
`D:\감정분석\conversation-emotion\.venv\Scripts\python.exe`

`python ensemble_inference.py --text "오늘은 기분이 좋다" --device auto`

다른 위치에서 실행하면 `--ensemble-dir`로 이 폴더를 지정합니다.

## 공유 또는 이동

아래 세 폴더를 같은 상위 폴더 아래 함께 복사합니다. 앙상블 폴더만으로는 가중치가 포함되지 않습니다.

- ensemble_seed42
- weighted_CE_seed42
- weighted_RDrop_seed42

로더는 ensemble.json의 원래 경로를 우선 사용하고, 원래 경로가 없으면 같은 상위 폴더에서 구성 모델을 찾습니다.
토크나이저와 인코더 설정은 구성 모델의 best_checkpoint 폴더에 포함됩니다. 추론 시 인터넷 연결은 필요하지 않습니다.

학습 2228 · 검증 528 · 테스트 680 고정, 실제 배치96×누적1, lr5e-5,15epoch, 가중치=학습빈도 역제곱근을 평균1로 정규화, R-Drop α1.0입니다.
각 컴포넌트는 검증 Macro-F1 최고 epoch로 선택했습니다. 문서의 10분류 결과와 이번 9분류 결과는 직접 비교하지 않습니다.
