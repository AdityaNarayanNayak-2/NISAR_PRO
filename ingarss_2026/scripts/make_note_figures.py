"""Make the figures used in TECHNICAL_NOTE.md, in ingarss_2026/note_figures/.

1. Copies the walkthrough figures (made by make_walkthrough.py into Docs/walkthrough_build/)
   as compressed JPEGs, so the note PDF stays small.
2. Stacks the 40 km window rows of the L-band and S-band 31 Aug -> 12 Sep figures into one
   figure, so the two bands can be compared directly.

Run from anywhere:  python3 ingarss_2026/scripts/make_note_figures.py
"""
from pathlib import Path

import matplotlib
from PIL import Image

PKG = Path(__file__).resolve().parents[1]
REPO = PKG.parent
# walk_*.png from make_walkthrough.py: its --out folder (explainer/ in the README steps),
# or Docs/walkthrough_build/ in the GitLab repo. Override with --src <folder>.
SRC = next((d for d in (PKG / "explainer", REPO / "Docs" / "walkthrough_build")
            if (d / "walk_A_stages.png").exists()), PKG / "explainer")
OUT = PKG / "note_figures"
OUT.mkdir(exist_ok=True)

COPY = {
    "walk_A_stages.png": "fig_stages.jpg",
    "walk_D_timelapse.png": "fig_timelapse.jpg",
}

INK = "#1f2937"


def copy_walkthrough():
    missing = [s for s in COPY if not (SRC / s).exists()]
    if missing:
        raise SystemExit(f"Missing {missing} in {SRC}. Run scripts/make_walkthrough.py first, or pass --src <folder>.")
    for src, dst in COPY.items():
        im = Image.open(SRC / src).convert("RGB")
        if im.width > 2000:
            im = im.resize((2000, round(im.height * 2000 / im.width)), Image.LANCZOS)
        im.save(OUT / dst, quality=86, optimize=True)


def band_compare():
    """L-band row over S-band row, 40 km window, 31 Aug -> 12 Sep."""
    from PIL import ImageDraw, ImageFont
    font = ImageFont.truetype(str(Path(matplotlib.get_data_path()) / "fonts/ttf/DejaVuSans.ttf"), 30)
    L = Image.open(SRC / "walk_B2_L_aug31_sep12.png").convert("RGB")
    S = Image.open(SRC / "walk_B4_S_aug31_sep12.png").convert("RGB")
    # 1950 x 1080 sources: row 2 (40 km window) is y 522-982, legend and footer y 990-1080
    rows = [L.crop((66, 522, 1950, 982)), S.crop((66, 522, 1950, 982))]
    legend = L.crop((0, 990, 1950, 1080))
    lab_w = 70
    W = lab_w + rows[0].width
    out = Image.new("RGB", (W, sum(r.height for r in rows) + 20 + legend.height + 24), "white")
    y = 0
    for r, name in zip(rows, ("L-band", "S-band")):
        out.paste(r, (lab_w, y))
        t = Image.new("RGB", (r.height, lab_w), "white")
        d = ImageDraw.Draw(t)
        tw = d.textlength(name, font=font)
        d.text(((r.height - tw) / 2, 18), name, fill=INK, font=font)
        out.paste(t.rotate(90, expand=True), (0, y))
        y += r.height + 20
    out.paste(legend.resize((W, round(legend.height * W / legend.width))), (0, y))
    if out.width > 2000:
        out = out.resize((2000, round(out.height * 2000 / out.width)), Image.LANCZOS)
    out.save(OUT / "fig_L_vs_S_aug31_sep12.jpg", quality=86, optimize=True)


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--src", type=Path, help="Folder with walk_*.png from make_walkthrough.py")
    args = ap.parse_args()
    if args.src:
        SRC = args.src
    copy_walkthrough()
    band_compare()
    for p in sorted(OUT.iterdir()):
        print(f"{p.name}  {p.stat().st_size / 1e3:,.0f} kB")
