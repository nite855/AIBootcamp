from pathlib import Path
import json

root = Path(__file__).resolve().parents[1]
directory = root / 'contracts/fixtures'
ids = ('pos_1', 'pos_2', 'pos_3', 'neg_1', 'neg_2', 'neg_3', 'neu_1', 'neu_2', 'neu_3')
taxonomy = 'emotion-cardex-3plus9-v1'
policy = 'card-stage-strict-gt-v1'


def write(name, data):
    (directory / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def distribution(score, winners=('pos_1',)):
    rest = (1 - score * len(winners)) / (len(ids) - len(winners))
    return {key: score if key in winners else rest for key in ids}


cases = []
for name, score, winners in [
    ('uniform_ninth', 1/9, ids),
    ('one_third_minus', 1/3-1e-6, ('pos_1',)),
    ('one_third_exact', 1/3, ('pos_1',)),
    ('one_third_plus', 1/3+1e-6, ('pos_1',)),
    ('two_thirds_minus', 2/3-1e-6, ('neg_3',)),
    ('two_thirds_exact', 2/3, ('neu_3',)),
    ('two_thirds_plus', 2/3+1e-6, ('neu_3',)),
    ('maximum', 1.0, ('neg_1',)),
    ('tie', 0.4, ('pos_1', 'neg_3')),
]:
    probs = {key: 1/9 for key in ids} if len(winners) == len(ids) else distribution(score, winners)
    dominant = max(probs.values())
    ties = [key for key in ids if probs[key] == dominant]
    stage = 3 if dominant > 2/3 else 2 if dominant > 1/3 else 1
    cases.append({'id': name, 'description': name, 'probabilities': probs,
                  'expected': {'dominant_emotion': ties[0], 'dominant_ratio': dominant,
                               'ties': ties, 'card_stage': stage, 'card_key': f'{ties[0]}:{stage}'}})
write('card-boundaries.json', {'taxonomy_version': taxonomy, 'card_policy_version': policy,
                               'synthetic': True, 'cases': cases})

valid = distribution(0.6)
invalid = [
    ('all_zero', {key: 0 for key in ids}, 'invalid_sum'),
    ('negative', {**valid, 'pos_1': -0.1}, 'out_of_range'),
    ('above_one', {**valid, 'pos_1': 1.1}, 'out_of_range'),
    ('bad_sum', {key: 0.01 for key in ids}, 'invalid_sum'),
    ('missing_neu3', {key: value for key, value in valid.items() if key != 'neu_3'}, 'key_mismatch'),
    ('legacy_10', {**valid, 'neu_4': 0.0}, 'key_mismatch'),
    ('null', {**valid, 'pos_1': None}, 'non_finite_number'),
    ('boolean', {**valid, 'pos_1': True}, 'non_finite_number'),
    ('string', {**valid, 'pos_1': 'NaN'}, 'non_finite_number'),
]
analysis = {'status': 'valid', 'version': 1, 'taxonomy_version': taxonomy,
            'truncated': False, 'probabilities': valid}
analysis_cases = [
    {'id': 'truncated', 'analysis': {**analysis, 'truncated': True}, 'expected_error': 'truncated_unanalyzable'},
    {'id': 'old_taxonomy', 'analysis': {**analysis, 'taxonomy_version': 'emotion-cardex-3plus10-v1'}, 'expected_error': 'taxonomy_mismatch'},
    {'id': 'pending', 'analysis': {'status': 'pending', 'taxonomy_version': taxonomy}, 'expected_error': 'not_valid_status'},
]
write('invalid-distributions.json', {'taxonomy_version': taxonomy, 'card_policy_version': policy,
                                    'synthetic': True,
                                    'probability_cases': [{'id': n, 'probabilities': p, 'expected_error': e} for n, p, e in invalid],
                                    'analysis_cases': analysis_cases})

path = directory / 'api-cases.json'
data = json.loads(path.read_text(encoding='utf-8'))
data['taxonomy_version'] = taxonomy
data['contract_version'] = '2.0.0'
for case in data['valid_exchange_cases']:
    response = case['response']
    response['taxonomy_version'] = taxonomy
    if response.get('status') == 'valid':
        probs = response['probabilities']
        probs['neu_3'] += probs.pop('neu_4', 0)
write('api-cases.json', data)

path = directory / 'model-intake-samples.json'
data = json.loads(path.read_text(encoding='utf-8'))
data['taxonomy_version'] = taxonomy
data['contract_version'] = '2.0.0'
for sample in data['samples']:
    if sample.get('category_hint') == 'neu_4':
        sample['category_hint'] = 'neu_3'
write('model-intake-samples.json', data)
print('Prepared nine-class shared contract fixtures.')
