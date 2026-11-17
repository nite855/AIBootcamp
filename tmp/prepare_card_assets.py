from pathlib import Path
import hashlib
import json
import re
import shutil

root = Path(__file__).resolve().parents[1]
source = root / 'tmp/tcg images'
target = root / 'frontend/public/assets/cards'
report = (root / 'docs/CARD_ASSET_INTAKE_2026-11-17.md').read_text(encoding='utf-8')
entries = []
for line in report.splitlines():
    match = re.match(r'^\| ((?:pos|neg|neu)_[1-3]):([1-3]) \| .*? \| \[([^]]+)\]\(<[^>]+>\) \| .*? \| ([0-9a-f]{12}) \|$', line)
    if not match:
        continue
    emotion, stage, name, expected = match.groups()
    path = source / name
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if not digest.startswith(expected):
        raise ValueError(f'Card image has changed since intake: {name}')
    filename = f'{emotion}-{stage}-{digest[:12]}.png'
    entries.append({'card_key': f'{emotion}:{stage}', 'emotion_id': emotion, 'stage': int(stage),
                    'kind': 'full_card', 'src': f'/assets/cards/{filename}',
                    'placeholder': False, 'source': 'user-provided', 'sha256': digest})
    target.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(path, target / filename)

if len(entries) != 27 or len({entry['card_key'] for entry in entries}) != 27:
    raise ValueError('Expected 27 unique card keys')
manifest = {'manifest_version': 'provided-9class-v1', 'taxonomy_version': 'emotion-cardex-3plus9-v1',
            'card_policy_version': 'card-stage-strict-gt-v1', 'all_provided': True, 'cards': entries}
(target / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Prepared {len(entries)} original card images and manifest.')
