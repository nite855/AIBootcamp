"""Subset the soft UI v1.1 fonts (SIL OFL 1.1) into styles/base.css.

Gothic A1 (Korean UI and diary text) and Bricolage Grotesque (Latin display:
logo, "MOMENT CARD", card numbers) are not stored in the repository. Download
them from https://github.com/google/fonts (ofl/gothica1, ofl/bricolagegrotesque)
and run, from frontend/:

    python tools/subset-ui-fonts.py --gothic-dir <dir with GothicA1-*.ttf> \
        --bricolage <BricolageGrotesque[opsz,wdth,wght].ttf>

Requires `fonttools` and `brotli`.

Coverage:
- Gothic A1 400 and 600 carry every KS X 1001 Hangul syllable (2,350) plus
  compatibility jamo and printable ASCII, so user-written diary text renders.
- Gothic A1 300 (large titles) and 800 (card emotion names) only carry glyphs
  found in UI sources; anything else falls back to the 400/600 faces.
- Bricolage Grotesque 500/700/800 are static instances with Latin and digits.

Every previous @font-face line (IBM Plex Sans KR, Gaegu) is removed from
styles/base.css and replaced by the new faces.
"""

from __future__ import annotations

import argparse
import base64
import io
import re
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

FRONTEND = Path(__file__).resolve().parent.parent
SOURCES = ("scripts", "templates")
MARK = "/* Soft UI v1.1 fonts: Gothic A1 + Bricolage Grotesque subsets (SIL OFL 1.1, see docs/licenses/) */"
ASCII = {chr(code) for code in range(0x20, 0x7F)}
PUNCT = set("·…“”‘’«»→←‹›✦♥★☆✓○●◦—–•°%")


def ksx1001_hangul() -> set[str]:
    """Hangul syllables and compatibility jamo that EUC-KR (KS X 1001) encodes."""
    chars = set()
    for code in [*range(0xAC00, 0xD7A4), *range(0x3131, 0x3164)]:
        ch = chr(code)
        try:
            ch.encode("euc-kr")
        except UnicodeEncodeError:
            continue
        chars.add(ch)
    return chars


def ui_text() -> set[str]:
    chars: set[str] = set()
    for folder in SOURCES:
        for path in sorted((FRONTEND / folder).rglob("*")):
            if path.suffix not in {".js", ".html"} or "generated" in path.parts:
                continue
            chars.update(re.findall(r"[가-힣]", path.read_text(encoding="utf-8")))
    return chars


def subset_font(font: TTFont, text: str) -> bytes:
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["kern", "liga", "calt"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    subsetter = subset.Subsetter(options)
    subsetter.populate(text=text)
    subsetter.subset(font)
    buffer = io.BytesIO()
    font.flavor = "woff2"
    font.save(buffer)
    return buffer.getvalue()


def face(family: str, weight: int, data: bytes) -> str:
    encoded = base64.b64encode(data).decode("ascii")
    return (
        f'@font-face{{font-family:"{family}";font-style:normal;font-weight:{weight};'
        f'font-display:swap;src:url(data:font/woff2;base64,{encoded}) format("woff2")}}'
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--gothic-dir", type=Path, required=True)
    parser.add_argument("--bricolage", type=Path, required=True)
    args = parser.parse_args()
    base_chars = ASCII | PUNCT
    full = "".join(sorted(base_chars | ksx1001_hangul() | ui_text()))
    ui = "".join(sorted(base_chars | ui_text()))
    latin = "".join(sorted(base_chars))
    faces: list[str] = []
    for style, weight, text in (("Light", 300, ui), ("Regular", 400, full), ("SemiBold", 600, full), ("ExtraBold", 800, ui)):
        data = subset_font(TTFont(args.gothic_dir / f"GothicA1-{style}.ttf"), text)
        faces.append(face("Gothic A1", weight, data))
        print(f"Gothic A1 {weight}: {len(data):,} bytes")
    for weight in (500, 700, 800):
        variable = TTFont(args.bricolage)
        axes = {axis.axisTag for axis in variable["fvar"].axes}
        location = {"wght": weight}
        if "opsz" in axes:
            location["opsz"] = 14
        if "wdth" in axes:
            location["wdth"] = 100
        static = instancer.instantiateVariableFont(variable, location)
        data = subset_font(static, latin)
        faces.append(face("Bricolage Grotesque", weight, data))
        print(f"Bricolage Grotesque {weight}: {len(data):,} bytes")
    base = FRONTEND / "styles" / "base.css"
    lines = base.read_text(encoding="utf-8").split("\n")
    first = next(i for i, line in enumerate(lines) if line.startswith("@font-face"))
    # Drop old face lines and their comment headers (IBM Plex, Gaegu, previous runs).
    kept = [
        line for line in lines
        if not line.startswith("@font-face")
        and not line.startswith("/* IBM Plex Sans KR UI glyph subsets")
        and not line.startswith("/* Gaegu display subset")
        and line != MARK
    ]
    insert_at = min(first, len(kept))
    # Comment lines removed above sat before `first`; clamp to the first kept line.
    insert_at = max(0, insert_at - sum(1 for line in lines[:first] if line not in kept))
    kept[insert_at:insert_at] = [MARK, *faces]
    base.write_text("\n".join(kept), encoding="utf-8")


if __name__ == "__main__":
    main()
