"""Subset the Gaegu display font (SIL OFL 1.1) for the "doodle" theme.

The source TTF files are not stored in the repository. Download them from
https://github.com/google/fonts/tree/main/ofl/gaegu and run, from frontend/:

    python tools/subset-display-font.py --regular Gaegu-Regular.ttf --bold Gaegu-Bold.ttf

Requires `fonttools` and `brotli`. The script collects every Hangul syllable
used in UI source files plus printable ASCII, writes WOFF2 subsets, and
replaces the Gaegu @font-face lines in styles/base.css.
"""

from __future__ import annotations

import argparse
import base64
import re
from pathlib import Path

from fontTools import subset

FRONTEND = Path(__file__).resolve().parent.parent
SOURCES = ("scripts", "templates")
FAMILY = "Gaegu"
SIZE_ADJUST = "118%"
MARK ="/* Gaegu display subset (SIL OFL 1.1, see docs/licenses/gaegu-ofl.txt) */"


def collect_text() -> str:
    """Return Hangul syllables found in UI sources and printable ASCII."""
    chars: set[str] = {chr(code) for code in range(0x20, 0x7F)}
    chars.update("·…“”‘’«»→←✦♥★☆")
    for folder in SOURCES:
        for path in sorted((FRONTEND / folder).rglob("*")):
            if path.suffix not in {".js", ".html"} or "generated" in path.parts:
                continue
            chars.update(re.findall(r"[가-힣]", path.read_text(encoding="utf-8")))
    return "".join(sorted(chars))


def subset_font(source: Path, text: str) -> bytes:
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["kern", "liga"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    font = subset.load_font(str(source), options)
    subsetter = subset.Subsetter(options)
    subsetter.populate(text=text)
    subsetter.subset(font)
    out = FRONTEND / ".subset-tmp.woff2"
    try:
        subset.save_font(font, str(out), options)
        return out.read_bytes()
    finally:
        out.unlink(missing_ok=True)


def font_face(data: bytes, weight: int) -> str:
    encoded = base64.b64encode(data).decode("ascii")
    return (
        f'@font-face{{font-family:"{FAMILY}";font-style:normal;font-weight:{weight};'
        # Gaegu glyphs sit small in their em box; size-adjust only affects this face.
        f'font-display:swap;size-adjust:{SIZE_ADJUST};'
        f'src:url(data:font/woff2;base64,{encoded}) format("woff2")}}'
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--regular", type=Path, required=True)
    parser.add_argument("--bold", type=Path, required=True)
    args = parser.parse_args()
    text = collect_text()
    faces = [font_face(subset_font(args.regular, text), 400), font_face(subset_font(args.bold, text), 700)]
    base = FRONTEND / "styles" / "base.css"
    lines = base.read_text(encoding="utf-8").split("\n")
    kept = [line for line in lines if line != MARK and f'font-family:"{FAMILY}"' not in line]
    last_face = max(i for i, line in enumerate(kept) if line.startswith("@font-face"))
    kept[last_face + 1:last_face + 1] = [MARK, *faces]
    base.write_text("\n".join(kept), encoding="utf-8")
    sizes = ", ".join(f"{len(face) // 1024}KB" for face in faces)
    print(f"Subset {len(text)} characters into {base.relative_to(FRONTEND)} ({sizes} base64)")


if __name__ == "__main__":
    main()
