"""Make the figures used in TECHNICAL_NOTE.md, in ingarss_2026/note_figures/.

1. Copies the walkthrough figures (made by make_walkthrough.py into Docs/walkthrough_build/)
   as compressed JPEGs, so the note PDF stays small.
2. Stacks the 40 km window rows of the L-band and S-band 31 Aug -> 12 Sep figures into one
   figure, so the two bands can be compared directly.
3. Draws the L+S fusion workflow diagram.

Numbers come from explainer/walkthrough_numbers.json and the fused result JSON.
Run from anywhere:  python3 ingarss_2026/scripts/make_note_figures.py
"""
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch
from PIL import Image

PKG = Path(__file__).resolve().parents[1]
REPO = PKG.parent
SRC = REPO / "Docs" / "walkthrough_build"
OUT = PKG / "note_figures"
OUT.mkdir(exist_ok=True)
ACRE = 0.004046856

COPY = {
    "walk_A_stages.png": "fig_stages.jpg",
    "walk_C_fusion.png": "fig_fusion_output.jpg",
    "walk_D_timelapse.png": "fig_timelapse.jpg",
}

INK = "#1f2937"
MUTED = "#6b7280"
GRID = "#e5e7eb"
BLUE = "#2563eb"


def copy_walkthrough():
    missing = [s for s in COPY if not (SRC / s).exists()]
    if missing:
        raise SystemExit(f"Run scripts/make_walkthrough.py first; missing {missing}")
    for src, dst in COPY.items():
        im = Image.open(SRC / src).convert("RGB")
        if im.width > 2000:
            im = im.resize((2000, round(im.height * 2000 / im.width)), Image.LANCZOS)
        im.save(OUT / dst, quality=86, optimize=True)


def box(ax, x, y, w, h, title, body, face):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.008,rounding_size=0.015",
                                fc=face, ec="#94a3b8", lw=1))
    ax.text(x + w / 2, y + h - 0.035, title, ha="center", va="top", fontsize=9.5,
            weight="bold", color=INK)
    ax.text(x + w / 2, y + h - 0.105, body, ha="center", va="top", fontsize=7.8,
            color=INK, linespacing=1.35)


def arrow(ax, x0, y0, x1, y1):
    ax.annotate("", xy=(x1, y1), xytext=(x0, y0),
                arrowprops=dict(arrowstyle="-|>", color="#475569", lw=1.3))


def fusion_workflow():
    fused = json.load(open(PKG / "results/LS_fused_aug31_sep12/fusion_diagnostics.json"))
    src = fused["fused_gain_sources"]
    fig = plt.figure(figsize=(10, 4.3), dpi=200)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")

    box(ax, 0.01, 0.62, 0.17, 0.33, "L-band pair",
        "31 Aug + 12 Sep\nHH and HV, 80 m\nengine classes", "#dbeafe")
    box(ax, 0.01, 0.10, 0.17, 0.33, "S-band pair",
        "31 Aug + 12 Sep\nHH and HV, 80 m\nengine classes", "#ccfbf1")
    box(ax, 0.22, 0.32, 0.15, 0.36, "Same 80 m grid",
        "shift 720 m, 2,880 m\n= whole pixels\nno resampling\n4,140 × 4,275 px", "#f1f5f9")
    arrow(ax, 0.18, 0.78, 0.22, 0.60)
    arrow(ax, 0.18, 0.27, 0.22, 0.40)

    rules = [
        ("1 · Sandbar rule", "L HH < −13 dB but S HH ≥ −10.5 dB\n→ not stable water"),
        ("2 · Wind rule", "L HH < −15.5 and HV < −22.0 dB\nboth dates → stable water"),
        ("3 · Canopy rule", "L HH drop ≥ 3.26 dB, later HV < −20 dB,\nHH < −12 dB → new-water candidate"),
        ("4 · S-band gate", "every new-water candidate needs\nS HH < −10.5 dB on 12 Sep"),
    ]
    y = 0.77
    for t, b in rules:
        box(ax, 0.41, y, 0.30, 0.20, t, b, "#fef3c7" if "gate" not in t else "#fde2e2")
        if y > 0.1:
            arrow(ax, 0.56, y, 0.56, y - 0.045)
        y -= 0.245
    arrow(ax, 0.37, 0.60, 0.41, 0.85)

    km = lambda k: f"{src[k]['km2']:,.2f} km²"
    box(ax, 0.75, 0.30, 0.24, 0.48, "L+S class map",
        "new water comes from:\n"
        f"both bands  {km('both_bands')}\n"
        f"S only  {km('s_band_only')}\n"
        f"L only  {km('l_band_only')}\n"
        f"canopy rule only  {km('canopy_rule_only')}", "#e0e7ff")
    arrow(ax, 0.71, 0.13, 0.75, 0.36)
    fig.savefig(OUT / "fig_fusion_workflow.png")
    plt.close(fig)


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
    copy_walkthrough()
    band_compare()
    fusion_workflow()
    for p in sorted(OUT.iterdir()):
        print(f"{p.name}  {p.stat().st_size / 1e3:,.0f} kB")
