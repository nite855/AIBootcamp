"""Subset the UI fonts (SIL OFL 1.1) into styles/base.css.

2026-11-22: Korean UI and diary text use Pretendard Variable (wght 45-930), embedded as ONE
variable face so every weight the CSS asks for (400/500/600/700/800) is drawn by the real
font instead of a neighbouring static weight, and it carries all 11,172 modern Hangul
syllables so text the user types never falls back to the system font.

Pretendard is released with the Reserved Font Name "Pretendard". A subset is a Modified
Version under OFL 1.1 section 3, so the subset is renamed "Moment Sans" (CSS family and the
font's own name table). The source and license stay credited in docs/licenses/.

Bricolage Grotesque (Latin display: logo, "MOMENT CARD", card numbers) is unchanged; pass
--bricolage to rebuild it too, otherwise the existing Bricolage faces in base.css are kept.

The fonts are not stored in the repository. Download Pretendard from
https://github.com/orioncactus/pretendard/releases (public/variable/PretendardVariable.ttf)
and run, from frontend/:

    python tools/subset-ui-fonts.py --pretendard <PretendardVariable.ttf> \
        [--bricolage <BricolageGrotesque[opsz,wdth,wght].ttf>]

Requires `fonttools` and `brotli`.
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
MARK = "/* UI fonts: Moment Sans (Pretendard Variable subset, renamed per OFL RFN) + Bricolage Grotesque subsets (SIL OFL 1.1, see docs/licenses/) */"
OLD_MARKS = (
    "/* Soft UI v1.1 fonts: Gothic A1 + Bricolage Grotesque subsets",
    "/* IBM Plex Sans KR UI glyph subsets",
    "/* Gaegu display subset",
    "/* UI fonts: Moment Sans",
)
FAMILY = "Moment Sans"
ASCII = {chr(code) for code in range(0x20, 0x7F)}
PUNCT = set("·…“”‘’«»→←‹›✦✧♥★☆✓○●◦—–•°%№")
WEIGHT_RANGE = (45, 930)


def hangul() -> set[str]:
    """All 11,172 modern syllables plus compatibility jamo (ㄱ…ㅣ, ㅋㅋ, ㅠㅠ)."""
    return {chr(code) for code in [*range(0xAC00, 0xD7A4), *range(0x3131, 0x318F)]}


NAME_IDS = {1, 3, 4, 6, 16, 17, 18, 21, 22, 25}  # family / style / unique / full / PostScript names only


def rename(font: TTFont, family: str) -> None:
    """Replace the reserved family name in the font-name records (OFL 1.1 section 3).
    Copyright (0), trademark (7), vendor/designer URLs and license (13/14) are kept verbatim."""
    postscript = family.replace(" ", "")
    for record in font["name"].names:
        if record.nameID not in NAME_IDS:
            continue
        text = record.toUnicode()
        if record.nameID in (3, 6, 25):
            new = re.sub(r"Pretendard\w*", postscript, text)
        else:
            new = re.sub(r"Pretendard( Variable)?", family, text)
        if new != text:
            record.string = new


def subset_font(font: TTFont, text: str) -> bytes:
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["kern", "liga", "calt", "ccmp", "locl", "mark", "mkmk"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    subsetter = subset.Subsetter(options)
    subsetter.populate(text=text)
    subsetter.subset(font)
    buffer = io.BytesIO()
    font.flavor = "woff2"
    font.save(buffer)
    return buffer.getvalue()


def face(family: str, weight: int | tuple[int, int], data: bytes) -> str:
    encoded = base64.b64encode(data).decode("ascii")
    weights = f"{weight[0]} {weight[1]}" if isinstance(weight, tuple) else str(weight)
    return (
        f'@font-face{{font-family:"{family}";font-style:normal;font-weight:{weights};'
        f'font-display:swap;src:url(data:font/woff2;base64,{encoded}) format("woff2")}}'
    )


def bricolage_faces(path: Path) -> list[str]:
    latin = "".join(sorted(ASCII | PUNCT))
    faces = []
    for weight in (500, 700, 800):
        variable = TTFont(path)
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
    return faces


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--pretendard", type=Path, required=True)
    parser.add_argument("--bricolage", type=Path)
    args = parser.parse_args()
    base = FRONTEND / "styles" / "base.css"
    lines = base.read_text(encoding="utf-8").split("\n")
    old_bricolage = [line for line in lines if line.startswith('@font-face{font-family:"Bricolage Grotesque"')]

    font = TTFont(args.pretendard)
    axes = {axis.axisTag: (axis.minValue, axis.maxValue) for axis in font["fvar"].axes}
    if "wght" not in axes:
        raise SystemExit("Pretendard Variable with a wght axis is required")
    rename(font, FAMILY)
    data = subset_font(font, "".join(sorted(ASCII | PUNCT | hangul())))
    faces = [face(FAMILY, WEIGHT_RANGE, data)]
    print(f"{FAMILY} (Pretendard Variable, wght {WEIGHT_RANGE[0]}-{WEIGHT_RANGE[1]}): {len(data):,} bytes")
    faces += bricolage_faces(args.bricolage) if args.bricolage else old_bricolage
    if not any("Bricolage Grotesque" in line for line in faces):
        raise SystemExit("No Bricolage Grotesque faces: pass --bricolage")

    first = next(i for i, line in enumerate(lines) if line.startswith("@font-face"))
    head = [line for line in lines[:first] if not line.startswith(OLD_MARKS)]
    tail = [line for line in lines[first:] if not line.startswith("@font-face") and not line.startswith(OLD_MARKS)]
    base.write_text("\n".join([*head, MARK, *faces, *tail]), encoding="utf-8")


if __name__ == "__main__":
    main()
