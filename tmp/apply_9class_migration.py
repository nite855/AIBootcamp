from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]


def replace(path, changes):
    p = ROOT / path
    content = p.read_text(encoding='utf-8')
    for old, new in changes:
        if old not in content:
            if new in content:
                continue
            raise RuntimeError(f'{path}: missing {old!r}')
        content = content.replace(old, new)
    p.write_text(content, encoding='utf-8', newline='\n')


legacy = (ROOT / 'frontend/scripts/core.js').read_text(encoding='utf-8')
core = legacy.replace('emotion-cardex-3plus10-v1', 'emotion-cardex-3plus9-v1')
core = core.replace("children:['neu_1','neu_2','neu_3','neu_4']", "children:['neu_1','neu_2','neu_3']")
core = core.replace("name:'놀람',parent:'neutral'", "name:'놀람·당황',parent:'neutral'")
core = core.replace("    {id:'neu_4',number:'010',name:'당황',parent:'neutral',color:'#78899B',pattern:'mixed',asset:'neutral'}\n", '')
core = core.replace("pattern:'exclamation',asset:'neutral'},\n  ]", "pattern:'exclamation',asset:'neutral'}\n  ]")
core = core.replace('neu_3:.03,neu_4:.03', 'neu_3:.06')
core = core.replace('neu_3:0,neu_4:0', 'neu_3:0')
core = core.replace('10소분류 ID 계약', '9소분류 ID 계약')
if 'neu_4' in core or core == legacy:
    raise RuntimeError('core migration failed')
(ROOT / 'frontend/src/domain/core9.js').write_text(core, encoding='utf-8', newline='\n')

replace('frontend/src/domain/index.js', [('import "../../scripts/core.js";', 'import "./core9.js";')])
replace('frontend/src/domain/cardPolicy.mjs', [
    ('emotion-cardex-3plus10-v1', 'emotion-cardex-3plus9-v1'),
    ('  "neu_4",\n', ''), ('10소분류 ID 계약', '9소분류 ID 계약'),
])
replace('frontend/src/composables/useDiaryStore.js', [('return [id, 0.1];', 'return [id, 1 / CardexCore.IDS.length];')])
replace('frontend/src/services/cardAssets.mjs', [('  neu_4: "neutral",\n', ''), ('neu_[1-4]', 'neu_[1-3]')])
replace('frontend/src/views/CatalogView.vue', [('객관적 서술·의문·놀람·당황을 포함해요.', '객관적 서술·의문·놀람·당황을 포함해요.')])

replace('backend/app/ml/intake.py', [
    ('emotion-cardex-3plus10-v1', 'emotion-cardex-3plus9-v1'),
    ('    "neu_4",\n', ''), ('"neu_1", "neu_2", "neu_3", "neu_4"', '"neu_1", "neu_2", "neu_3"'),
    ('10-emotion', '9-emotion'), ('10 emotion IDs', '9 emotion IDs'),
    ('10 labels', '9 labels'), ('10-class', '9-class'), ('all 10 emotion', 'all 9 emotion'),
    ('expected 10 outputs', 'expected 9 outputs'),
])
replace('backend/app/schemas/analysis.py', [
    ('emotion-cardex-3plus10-v1', 'emotion-cardex-3plus9-v1'),
    ('    "neu_4",\n', ''), ('max_length=10)', 'max_length=9)'), ('neu_[1-4]', 'neu_[1-3]'),
])
replace('backend/app/services/card_policy.py', [('all 10 emotion probabilities', 'all 9 emotion probabilities')])
replace('backend/app/main.py', [('10감정 기록 단위 추론기', '9감정 기록 단위 추론기')])

schema_path = ROOT / 'contracts/analysis.schema.json'
schema = json.loads(schema_path.read_text(encoding='utf-8'))
def transform(value):
    if isinstance(value, str):
        return (value.replace('emotion-cardex-3plus10-v1', 'emotion-cardex-3plus9-v1')
                .replace('3+10', '3+9').replace('10소분류', '9소분류').replace('10개 세부', '9개 세부')
                .replace('10감정', '9감정').replace('neu_[1-4]', 'neu_[1-3]'))
    if isinstance(value, list):
        return [transform(item) for item in value if item != 'neu_4' and not (isinstance(item, dict) and item.get('id') == 'neu_4')]
    if isinstance(value, dict):
        return {key: transform(item) for key, item in value.items() if key != 'neu_4'}
    return value
schema = transform(schema)
meta = schema['x-cardex-contract']
meta['contract_version'] = '2.0.0'
for emotion in meta['emotions']:
    if emotion['id'] == 'neu_3':
        emotion['name'] = '놀람·당황'
schema['$defs']['AnalyzeSuccessResponse']['properties']['ties']['maxItems'] = 9
schema_path.write_text(json.dumps(schema, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Migrated active Vue, API types, and schema to 9 emotions; legacy UI retained.')
