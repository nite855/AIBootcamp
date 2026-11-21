"""Optional font rebuild, using a local @fontsource/ibm-plex-sans-kr package.
Usage: python tools/subset-fonts.py /path/to/node_modules/@fontsource/ibm-plex-sans-kr
Requires fontTools. The app does not need Python or these dependencies.
"""
import base64, io, re, sys
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

base = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
corpus = ''.join(p.read_text() for directory in ['scripts', 'templates', 'tests', 'docs'] for p in (base / directory).rglob('*') if p.is_file() and p.suffix in ['.js', '.html', '.cjs', '.md'])
characters = {ord(c) for c in corpus} | set(range(32, 127))
output = ['/* IBM Plex Sans KR UI glyph subsets; SIL OFL preserved in docs/licenses/. */']
for weight in [400, 600]:
    for match in re.finditer(r"@font-face\s*\{(.*?)\}", (source / f'{weight}.css').read_text(), re.S):
        block = match.group(1)
        filename = re.search(r'url\(\./(files/[^)]+\.woff2)\)', block).group(1)
        ranges = re.search(r'unicode-range:\s*([^;]+)', block).group(1)
        allowed = set()
        for fragment in ranges.split(','):
            ends = fragment.strip().lower().removeprefix('u+').split('-')
            low = int(ends[0], 16); high = int(ends[-1], 16)
            allowed.update(char for char in characters if low <= char <= high)
        if not allowed:
            continue
        font = TTFont(source / filename.replace('.woff2', '.woff'))
        allowed.intersection_update(font.getBestCmap())
        if not allowed:
            continue
        options = subset.Options()
        options.name_IDs = ['*']
        options.name_legacy = True
        sub = subset.Subsetter(options=options)
        sub.populate(unicodes=allowed); sub.subset(font)
        font.flavor = 'woff'; memory = io.BytesIO(); font.save(memory)
        encoded = base64.b64encode(memory.getvalue()).decode()
        unicode_range = ','.join(f'U+{char:X}' for char in sorted(allowed))
        output.append("@font-face{font-family:'IBM Plex Sans KR';font-style:normal;font-display:swap;font-weight:"+str(weight)+";src:url(data:font/woff;base64,"+encoded+") format('woff');unicode-range:"+unicode_range+';}')
(base / 'styles/fonts.css').write_text('\n'.join(output)+'\n')
print('Embedded UI font CSS:', (base / 'styles/fonts.css').stat().st_size, 'bytes')
