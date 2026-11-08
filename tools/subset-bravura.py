"""
Crea un sottoinsieme del font musicale Bravura con i soli blocchi SMuFL usati da Piano Tutor
(tools/bravura-subset.json): da ~241 KB a pochi KB, quindi download e decodifica molto più rapidi.

Uso:  npx tsx tools/extract-vexflow-fonts.ts   (estrae i font completi da VexFlow)
      python tools/subset-bravura.py            (riduce Bravura)
Richiede: pip install fonttools brotli
"""
import json
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parent.parent
cfg = json.loads((root / "tools" / "bravura-subset.json").read_text(encoding="utf-8"))
font_path = root / "public" / "fonts" / "Bravura.woff2"

unicodes = []
for start, end, _ in cfg["ranges"]:
    unicodes.extend(range(int(start, 16), int(end, 16) + 1))

before = font_path.stat().st_size
font = TTFont(font_path)
options = subset.Options()
options.flavor = "woff2"
options.layout_features = ["*"]
options.name_IDs = ["*"]
options.notdef_outline = True
options.hinting = False
sub = subset.Subsetter(options)
sub.populate(unicodes=unicodes)
sub.subset(font)
font.flavor = "woff2"
font.save(font_path)
after = font_path.stat().st_size
glyphs = len(font.getGlyphOrder())
print(f"Bravura: {before // 1024} KB -> {after // 1024} KB ({glyphs} glifi)")
