"""Test a locally saved input-study checkpoint with its training input format."""
import argparse
import csv
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STUDY = ROOT.parent / 'experiments' / 'emotional-dialogue-input-study-20261007-v1'
DEMO = [
    ['친구가 약속을 또 어겼어.', '매번 나만 기다리게 해서 정말 화가 나.'],
    ['내일 면접인데 실수할까 봐 걱정돼.', '계속 긴장돼서 잠도 안 와.'],
    ['믿었던 친구가 내 뒷담화를 했대.', '배신당한 것 같고 마음이 너무 아파.'],
    ['오랫동안 키우던 강아지가 세상을 떠났어.', '너무 보고 싶어서 자꾸 눈물이 나.'],
    ['발표 자료가 갑자기 사라졌어.', '곧 내 차례인데 어떻게 해야 할지 모르겠어.'],
    ['드디어 원하던 회사에 합격했어!', '노력한 보람이 있어서 정말 행복해.'],
]


def select_checkpoint(study):
    with (study / 'study_runs.csv').open(encoding='utf-8-sig', newline='') as stream:
        rows = [r for r in csv.DictReader(stream) if r['split'] == 'validation_fixed']
    # Select with validation only, using the original experiment's metric.
    row = max(rows, key=lambda r: float(r['negative_macro_f1']))
    checkpoint = study / row['condition'] / 'emotional_dialogue' / 'kcelectra' / 'finetune' / f"seed-{row['seed']}" / 'checkpoint'
    if not checkpoint.is_dir():
        raise FileNotFoundError(f'체크포인트가 없습니다: {checkpoint}')
    return checkpoint


class EmotionPredictor:
    def __init__(self, checkpoint=None, study=STUDY, device='auto'):
        for name in ('HF_HUB_OFFLINE', 'TRANSFORMERS_OFFLINE', 'HF_HUB_DISABLE_TELEMETRY'):
            os.environ[name] = '1'
        os.environ['TOKENIZERS_PARALLELISM'] = 'false'
        import torch
        from transformers import AutoModelForSequenceClassification, AutoTokenizer
        self.torch = torch
        torch.set_num_threads(4)
        self.checkpoint = Path(checkpoint) if checkpoint else select_checkpoint(Path(study))
        self.settings = json.loads((self.checkpoint.parent / 'metrics.json').read_text(encoding='utf-8'))['settings']
        self.max_length = self.settings['max_length']
        if self.settings['context_turns'] != 0:
            raise ValueError('이 스크립트는 context_turns=0 입력 실험용입니다.')
        self.human_dialogue = 'human-dialogue' in str(self.checkpoint)
        self.device = ('cuda' if torch.cuda.is_available() else 'cpu') if device == 'auto' else device
        if self.device == 'cuda' and not torch.cuda.is_available():
            raise RuntimeError('CUDA를 사용할 수 없습니다. --device cpu를 사용하세요.')
        options = dict(local_files_only=True, trust_remote_code=False)
        self.tokenizer = AutoTokenizer.from_pretrained(self.checkpoint, **options)
        self.model = AutoModelForSequenceClassification.from_pretrained(self.checkpoint, **options).to(self.device).eval()

    def predict(self, utterances):
        from local_experiments.context_encoding import encode_rows
        from local_experiments.preprocess_korean import clean, human_dialogue_text
        if isinstance(utterances, str):
            utterances = [utterances]
        if not isinstance(utterances, list) or not 1 <= len(utterances) <= 3:
            raise ValueError('사용자 발화 1~3개를 문자열 목록으로 입력하세요.')
        if any(not isinstance(t, str) or not clean(t) for t in utterances):
            raise ValueError('빈 발화 또는 문자열이 아닌 발화가 있습니다.')
        if self.human_dialogue:
            text = human_dialogue_text({f'HS0{i}': t for i, t in enumerate(utterances, 1)})
        else:
            if len(utterances) != 1:
                raise ValueError('HS01 모델에는 사용자 발화 1개만 입력하세요.')
            text = clean(utterances[0])
        encoded, clipped, _ = encode_rows(self.tokenizer, [{'text': text}], 0, self.max_length, True)
        batch = self.tokenizer.pad([{k: v[0] for k, v in encoded.items()}], return_tensors='pt').to(self.device)
        with self.torch.inference_mode():
            values = self.model(**batch).logits.float().softmax(-1)[0].cpu().tolist()
        scores = sorted(((self.model.config.id2label[i], p) for i, p in enumerate(values)), key=lambda x: x[1], reverse=True)
        return dict(emotion=scores[0][0], score=scores[0][1], probabilities=dict(scores),
                    input_tokens=len(encoded['input_ids'][0]), truncated=bool(clipped))


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--study-dir', type=Path, default=STUDY)
    p.add_argument('--checkpoint', type=Path)
    p.add_argument('--device', choices=['auto', 'cpu', 'cuda'], default='auto')
    source = p.add_mutually_exclusive_group()
    source.add_argument('--text', nargs='+', help='사용자 발화 1~3개 (각 발화를 따옴표로 구분)')
    source.add_argument('--input', type=Path, help='대화별 사용자 발화 목록을 담은 JSON 파일')
    source.add_argument('--demo', action='store_true')
    p.add_argument('--output', type=Path, help='예측 결과 JSON 저장 경로')
    a = p.parse_args()
    predictor = EmotionPredictor(a.checkpoint, a.study_dir, a.device)
    print(f'모델: {predictor.checkpoint}\n장치: {predictor.device}; 최대 토큰: {predictor.max_length}', flush=True)
    if a.demo:
        conversations = DEMO
    elif a.text:
        conversations = [a.text]
    elif a.input:
        conversations = json.loads(a.input.read_text(encoding='utf-8-sig'))
        if not isinstance(conversations, list) or not conversations:
            p.error('JSON 최상위는 비어 있지 않은 대화 목록이어야 합니다.')
    else:
        conversations = None
    results = []
    def show(utterances):
        result = predictor.predict(utterances)
        results.append(result)
        print(json.dumps(result, ensure_ascii=False, indent=2), flush=True)
    if conversations is not None:
        for conversation in conversations:
            show(conversation)
    else:
        print('사용자 발화를 입력하세요. 발화 구분: | / 종료: exit (상담자 응답은 제외)')
        while True:
            try:
                value = input('발화> ').strip()
            except (EOFError, KeyboardInterrupt):
                break
            if value.lower() in ('exit', 'quit', '종료'):
                break
            if not value:
                continue
            try:
                show(value.split('|'))
            except ValueError as error:
                print(error)
    if a.output:
        a.output.parent.mkdir(parents=True, exist_ok=True)
        a.output.write_text(json.dumps(dict(checkpoint=str(predictor.checkpoint), device=predictor.device,
                                             predictions=results), ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
