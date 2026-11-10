"""Build ingarss_2026/presentation.pptx: 8 slides on the default PowerPoint Office theme.

Every number is copied from TECHNICAL_NOTE.md and the result JSONs. Pictures come from
ingarss_2026/maps/ and ingarss_2026/note_figures/.
Run from the repo root:  python3 scripts/build_presentation_pptx.py   (needs: pip install python-pptx)
"""
from pathlib import Path

from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION, XL_LABEL_POSITION
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt

PKG = Path(__file__).resolve().parents[1] / "ingarss_2026"
OUT = PKG / "presentation.pptx"
GREY = RGBColor(0x59, 0x59, 0x59)
NAVY = RGBColor(0x0B, 0x16, 0x2A)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
SKY = RGBColor(0x7D, 0xD3, 0xFC)
ORANGE = RGBColor(0xF9, 0x73, 0x16)


def map_art():
    """Background pictures for slides 1 and 8, drawn from the packaged L+S class map
    (31 Aug -> 12 Sep 2026): cyan = stable water, orange/amber = new water, teal = water loss."""
    import tempfile
    import numpy as np
    import rasterio
    from PIL import Image
    d = PKG / "results" / "LS_fused_aug31_sep12"
    with rasterio.open(d / "sar-bihar-ls-fused-aug31-sep12_class.tif") as f:
        a = f.read(1)
    with rasterio.open(d / "valid_support.tif") as f:
        v = f.read(1) > 0
    pal = {0: (19, 35, 59), 1: (56, 189, 248), 2: (249, 115, 22), 3: (251, 191, 36), 5: (45, 212, 191)}
    rgb = np.zeros(a.shape + (3,), np.uint8)
    rgb[:] = (9, 15, 28)
    for k, c in pal.items():
        rgb[(a == k) & v] = c
    tmp = Path(tempfile.mkdtemp())
    hero = rgb[640:2418, 420:3580]               # Ganga band in the top half, 16:9
    strip = rgb[760:1100, 360:3520]              # thin river strip for the closing band
    Image.fromarray(hero).save(tmp / "hero.png")
    Image.fromarray(strip).save(tmp / "strip.png")
    return tmp / "hero.png", tmp / "strip.png"


def panel(slide, x, y, w, h, color, alpha):
    """Rectangle with a see-through fill (alpha 0-100 %), no outline."""
    from pptx.enum.shapes import MSO_SHAPE
    from pptx.oxml.ns import qn
    shp = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, w, h)
    shp.fill.solid()
    shp.fill.fore_color.rgb = color
    clr = shp.fill._xPr.find(qn("a:solidFill")).find(qn("a:srgbClr"))
    clr.append(clr.makeelement(qn("a:alpha"), {"val": str(int(alpha * 1000))}))
    shp.line.fill.background()
    shp.shadow.inherit = False
    return shp


def write(slide, x, y, w, h, text, size, color, bold=False, align=PP_ALIGN.LEFT, spacing=None):
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = align
    r = p.add_run()
    r.text = text
    r.font.size, r.font.bold, r.font.color.rgb = Pt(size), bold, color
    if spacing:
        from pptx.oxml.ns import qn
        r._r.get_or_add_rPr().set("spc", str(spacing))
    return tb


HERO, STRIP = map_art()

prs = Presentation()
prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
W, H = prs.slide_width, prs.slide_height
L_TITLE, L_CONTENT, L_TWO, L_TITLE_ONLY = (prs.slide_layouts[i] for i in (0, 1, 3, 5))


def fit_title(slide, text, size=36):
    t = slide.shapes.title
    t.left, t.top, t.width, t.height = Inches(0.6), Inches(0.3), W - Inches(1.2), Inches(1.0)
    t.text = text
    for p in t.text_frame.paragraphs:
        p.alignment = PP_ALIGN.LEFT
        for r in p.runs:
            r.font.size = Pt(size)
    return t


def footer(slide, n):
    tb = slide.shapes.add_textbox(Inches(0.6), H - Inches(0.5), Inches(8), Inches(0.35))
    r = tb.text_frame.paragraphs[0].add_run()
    r.text = "NISAR Pro  |  RunLayer Labs  |  IEEE InGARSS 2026 YP Hackathon"
    r.font.size, r.font.color.rgb = Pt(11), GREY
    tb = slide.shapes.add_textbox(W - Inches(1.2), H - Inches(0.5), Inches(0.6), Inches(0.35))
    p = tb.text_frame.paragraphs[0]
    p.alignment = PP_ALIGN.RIGHT
    r = p.add_run()
    r.text = str(n)
    r.font.size, r.font.color.rgb = Pt(11), GREY


def set_bullet(p, lvl):
    """Give a text-box paragraph a real PowerPoint bullet (text boxes have none by default)."""
    from pptx.oxml.ns import qn
    pPr = p._p.get_or_add_pPr()
    marl = Inches(0.3 + 0.35 * lvl)
    pPr.set("marL", str(int(marl)))
    pPr.set("indent", str(int(-Inches(0.28))))
    for tag in ("a:buNone", "a:buChar", "a:buAutoNum"):
        for el in pPr.findall(qn(tag)):
            pPr.remove(el)
    bu = pPr.makeelement(qn("a:buChar"), {"char": "•" if lvl == 0 else "–"})
    pPr.append(bu)


def bullets(shape_or_frame, items, size=20, left=None, top=None, width=None, height=None, marks=None):
    """items: str or (str, level). marks=True adds bullet characters (for plain text boxes)."""
    if left is not None:
        shape_or_frame.left, shape_or_frame.top = left, top
        shape_or_frame.width, shape_or_frame.height = width, height
    tf = shape_or_frame.text_frame
    tf.word_wrap = True
    first = True
    for it in items:
        text, lvl = (it, 0) if isinstance(it, str) else it
        p = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        p.text, p.level = text, lvl
        p.space_after = Pt(6)
        if marks:
            set_bullet(p, lvl)
        for r in p.runs:
            r.font.size = Pt(size if lvl == 0 else size - 3)
    return tf


def textbox(slide, x, y, w, h, lines, size=16, bold_first=False, color=None):
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        r = p.add_run()
        r.text = line
        r.font.size = Pt(size)
        if color is not None:
            r.font.color.rgb = color
        if bold_first and i == 0:
            r.font.bold = True
    return tb


def picture(slide, path, x, y, w=None, h=None):
    return slide.shapes.add_picture(str(PKG / path), x, y, width=w, height=h)


def table(slide, rows, x, y, w, col_w=None, size=14, row_h=0.4):
    shape = slide.shapes.add_table(len(rows), len(rows[0]), x, y, w, Inches(row_h * len(rows)))
    tbl = shape.table
    if col_w:
        for i, cw in enumerate(col_w):
            tbl.columns[i].width = Inches(cw)
    tbl.rows[0].height = Inches(0.4)
    for r, row in enumerate(rows):
        for c, val in enumerate(row):
            cell = tbl.cell(r, c)
            cell.text = val
            for p in cell.text_frame.paragraphs:
                if c > 0:
                    p.alignment = PP_ALIGN.CENTER
                for run in p.runs:
                    run.font.size = Pt(size)
            cell.margin_top = cell.margin_bottom = Inches(0.04)
    return tbl


# 1. Title -------------------------------------------------------------------------------
s = prs.slides.add_slide(prs.slide_layouts[6])
s.shapes.add_picture(str(HERO), 0, 0, width=W, height=H)
panel(s, 0, 0, W, H, NAVY, 10)                              # darken the whole map a little
panel(s, 0, Inches(4.0), W, H - Inches(4.0), NAVY, 84)       # text band
write(s, Inches(0.7), Inches(0.45), Inches(9), Inches(0.4),
      "IEEE InGARSS 2026  ·  YOUNG PROFESSIONALS HACKATHON  ·  PHASE 1", 13, SKY, bold=True, spacing=150)
bar = s.shapes.add_shape(1, Inches(0.72), Inches(4.3), Inches(1.1), Inches(0.07))
bar.fill.solid(); bar.fill.fore_color.rgb = ORANGE; bar.line.fill.background()
write(s, Inches(0.7), Inches(4.4), Inches(11.9), Inches(1.4),
      "Does combining NISAR L-band and S-band give a better water map?", 40, WHITE, bold=True)
write(s, Inches(0.7), Inches(5.78), Inches(11.9), Inches(0.5),
      "Surface-water change over the Ganga plain, Bihar, July to October 2026", 20, SKY)
write(s, Inches(0.7), Inches(6.4), Inches(8.0), Inches(0.5),
      "Aditya Narayan Nayak   |   Team RunLayer Labs   |   NISAR Pro", 16, WHITE)
write(s, Inches(8.4), Inches(6.62), Inches(4.5), Inches(0.8),
      "Background: our L+S water map, 31 Aug → 12 Sep 2026. Cyan: stable water. "
      "Orange: newly detected water. NISAR L2 GCOV, 80 m, EPSG:32645.", 9, SKY, align=PP_ALIGN.RIGHT)

# 2. Challenge and study area ---------------------------------------------------------------
s = prs.slides.add_slide(L_TITLE_ONLY)
fit_title(s, "The Challenge and Our Study Area")
textbox(s, Inches(0.6), Inches(1.35), Inches(6.6), Inches(3.2), [], size=18)
tb = s.shapes[-1]
bullets(tb, [
    "During the monsoon, Bihar is mostly under cloud, so optical satellites see very little. Radar sees through cloud.",
    "Our question: do NISAR L-band and S-band together map water better than either band alone?",
    "Study area: Ganga plain, Bihar. NISAR track 98, frame 14, ascending. We processed the whole scene, not only the 20 km box.",
    "The three maps are compared on the area both bands cover: 59,083.56 km² (14,599,867 acres).",
], size=18, marks=True)
table(s, [
    ["Band", "Mode", "Source", "Dates (2026)"],
    ["L-band (1.239 GHz)", "DHDH", "ASF DAAC", "26 Jul, 31 Aug, 12 Sep, 18 Oct"],
    ["S-band (3.2 GHz)", "DHNA", "Bhoonidhi (NRSC/ISRO)", "31 Aug, 12 Sep"],
], Inches(0.6), Inches(4.75), Inches(6.7), col_w=[1.75, 0.75, 2.1, 2.1], size=12, row_h=0.36)
textbox(s, Inches(0.6), Inches(6.35), Inches(6.7), Inches(0.5),
        ["L and S were taken seconds apart on 31 Aug and 12 Sep. Sentinel-2 is used only as a check."],
        size=13, color=GREY)
picture(s, "maps/fig0_aoi_and_footprint.png", Inches(7.65), Inches(1.3), h=Inches(5.2))
footer(s, 2)

# 3. Method -------------------------------------------------------------------------------
s = prs.slides.add_slide(L_TITLE_ONLY)
fit_title(s, "Method: One Pipeline, Two Bands")
tb = s.shapes.add_textbox(Inches(0.6), Inches(1.3), Inches(4.6), Inches(5.4))
bullets(tb, [
    "1. Check both dates use the same term (HHHH)",
    "2. Convert power to dB, cut the scene edge",
    "3. 3×3 median filter for speckle",
    "4. Change Δ = dB(after) − dB(before)",
    "5. Stable water: dark on both dates",
    "6. New water: seed at Δ < −5 dB, grow to Δ < −2.5 dB",
    "7. Classes: land, stable water, new water (high / medium), water loss",
], size=17)
textbox(s, Inches(0.6), Inches(5.35), Inches(4.6), Inches(1.4), [
    "Rust engine reads each 1.16-billion-value layer in strips and averages to 80 m.",
    "44–65 s per pair, under 2.4 GB of memory. Same steps for S-band; only the thresholds change.",
], size=14, color=GREY)
picture(s, "note_figures/fig_stages.jpg", Inches(5.3), Inches(1.4), w=Inches(7.5))
footer(s, 3)

# 4. Fusion -------------------------------------------------------------------------------
s = prs.slides.add_slide(L_TITLE_ONLY)
fit_title(s, "How We Combine L and S")
tb = s.shapes.add_textbox(Inches(0.6), Inches(1.3), Inches(6.0), Inches(4.6))
bullets(tb, [
    "Both grids line up exactly at 80 m, so no resampling is needed.",
    "Four simple if/then rules, so every decision can be checked:",
    ("Sandbar: L dark but S bright → not stable water", 1),
    ("Wind: L HH and HV very dark on both dates → stable water", 1),
    ("Canopy: big L-band drop with dark HV → new-water candidate (not proven)", 1),
    ("S-band gate: every new-water candidate must be dark in S on 12 Sep", 1),
    "To see what each rule does, we switched it off and ran again.",
], size=18, marks=True)
textbox(s, Inches(0.6), Inches(5.6), Inches(6.0), Inches(1.1), [
    "The S-band gate matters most: it removed 338.70 km² (83,695 acres) of candidates. "
    "Rule names describe what each rule aims at; the surfaces were not checked on the ground.",
], size=13, color=GREY)
table(s, [
    ["Run", "Stable water", "New water"],
    ["All rules", "2,652.29 km²\n(655,395 ac)", "1,337.15 km²\n(330,417 ac)"],
    ["No sandbar rule", "2,684.26 km²\n(663,296 ac)", "1,322.69 km²\n(326,845 ac)"],
    ["No wind rule", "2,381.78 km²\n(588,551 ac)", "1,386.80 km²\n(342,685 ac)"],
    ["No canopy rule", "2,652.29 km²\n(655,395 ac)", "1,113.61 km²\n(275,180 ac)"],
    ["No S-band gate", "2,652.29 km²\n(655,395 ac)", "1,675.85 km²\n(414,111 ac)"],
], Inches(7.0), Inches(1.45), Inches(5.7), col_w=[2.1, 1.8, 1.8], size=14, row_h=0.75)
footer(s, 4)

# 5. Results L / S / L+S --------------------------------------------------------------------
s = prs.slides.add_slide(L_TITLE_ONLY)
fit_title(s, "Results: L-only, S-only and L+S (31 Aug → 12 Sep)")
picture(s, "maps/fig1_change_maps_aug31_sep12.png", Inches(0.6), Inches(1.25), w=Inches(8.4))
table(s, [
    ["", "New water", "Stable water", "Water loss"],
    ["L-band", "1,137.14 km² (280,993 ac)", "3,314.83 km² (819,112 ac)", "888.84 km² (219,637 ac)"],
    ["S-band", "1,174.89 km² (290,322 ac)", "2,546.37 km² (629,222 ac)", "214.98 km² (53,123 ac)"],
    ["L+S", "1,337.15 km² (330,417 ac)", "2,652.29 km² (655,395 ac)", "723.37 km² (178,749 ac)"],
], Inches(0.6), Inches(4.95), Inches(8.4), col_w=[1.2, 2.4, 2.4, 2.4], size=13)
tb = s.shapes.add_textbox(Inches(9.3), Inches(1.35), Inches(3.5), Inches(5.3))
bullets(tb, [
    "Near the river the bands agree.",
    "L-band marks many small dark patches in the west as water; S-band does not.",
    "L-band reports 4 times more water loss than S-band.",
    "L+S keeps the river pattern and drops most of L-band's extra patches.",
], size=17, marks=True)
footer(s, 5)

# 6. Four dates ----------------------------------------------------------------------------
s = prs.slides.add_slide(L_TITLE_ONLY)
fit_title(s, "Change Detection: Four Dates, July to October")
picture(s, "note_figures/fig_timelapse.jpg", Inches(0.6), Inches(1.25), w=Inches(8.0))
tb = s.shapes.add_textbox(Inches(8.9), Inches(1.3), Inches(3.9), Inches(5.4))
bullets(tb, [
    "Dark water in the 40 km river window:",
    ("26 Jul: 213 km² (52,609 ac)", 1),
    ("31 Aug: 617 km² (152,400 ac)", 1),
    ("12 Sep: 812 km² (200,608 ac)", 1),
    ("18 Oct: 299 km² (73,872 ac)", 1),
    "Water spread along the river until 12 Sep; about half the dark water was gone by 18 Oct.",
    "1,282.78 km² (316,982 acres) of L+S new water lies outside any water seen in July or August.",
], size=17, marks=True)
textbox(s, Inches(0.6), Inches(5.75), Inches(8.0), Inches(0.9), [
    "One pair shows one step. Four dates show where the water rose, when it peaked and what is really new. "
    "Radar shows where water appeared, not why.",
], size=14, color=GREY)
footer(s, 6)

# 7. Validation ----------------------------------------------------------------------------
s = prs.slides.add_slide(L_TITLE_ONLY)
fit_title(s, "Validation Against Sentinel-2")
cd = CategoryChartData()
cd.categories = ["Water, 31 Aug", "Water, 12 Sep", "New water"]
cd.add_series("L-band", (0.807, 0.859, 0.555))
cd.add_series("S-band", (0.874, 0.891, 0.652))
cd.add_series("L+S", (0.834, 0.891, 0.637))
gf = s.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, Inches(0.6), Inches(1.3), Inches(7.2), Inches(5.0), cd)
ch = gf.chart
ch.has_legend = True
ch.legend.position = XL_LEGEND_POSITION.BOTTOM
ch.legend.include_in_layout = False
ch.legend.font.size = Pt(14)
ch.has_title = True
ch.chart_title.text_frame.text = "F1 score against cloud-free Sentinel-2"
ch.chart_title.text_frame.paragraphs[0].runs[0].font.size = Pt(16)
ch.value_axis.maximum_scale, ch.value_axis.minimum_scale = 1.0, 0.0
ch.value_axis.tick_labels.font.size = Pt(12)
ch.category_axis.tick_labels.font.size = Pt(13)
pl = ch.plots[0]
pl.has_data_labels = True
pl.data_labels.number_format, pl.data_labels.number_format_is_linked = "0.000", False
pl.data_labels.position = XL_LABEL_POSITION.OUTSIDE_END
pl.data_labels.font.size = Pt(11)
tb = s.shapes.add_textbox(Inches(8.1), Inches(1.3), Inches(4.7), Inches(5.0))
bullets(tb, [
    "We fixed the water test (NDWI ≥ 0) before scoring, and scored every cloud-free pixel.",
    "L+S beat L-band in all 3 tests, mostly by making fewer false alarms.",
    "L+S did not beat S-band: equal on 12 Sep, lower on 31 Aug and for new water.",
    "Pixels dark in L but bright in S were water in only 8.7% of cases on 12 Sep.",
    "HH separated water better than HV in both bands.",
], size=17, marks=True)
textbox(s, Inches(0.6), Inches(6.35), Inches(12), Inches(0.5), [
    "12 Sep: 7,946.03 km² (1,963,507 acres) scored, Sentinel-2 about 5 h after NISAR. "
    "These are agreement scores with optical labels, not ground truth.",
], size=12, color=GREY)
footer(s, 7)

# 8. Uncertainty and conclusions -------------------------------------------------------------
s = prs.slides.add_slide(L_TWO)
fit_title(s, "Uncertainty and Conclusions")
left, right = s.placeholders[1], s.placeholders[2]
bullets(left, [
    "Uncertainty",
    ("Cloud: only about 14% of the scene could be scored on 12 Sep", 1),
    ("Optical images cannot see water under crops", 1),
    ("Thresholds are set by hand: ±1 dB on the S-band gate moves new water between 1,208.44 and 1,449.29 km² (298,611 to 358,128 acres)", 1),
    ("New water means the echo dropped; features under about 240 m are removed", 1),
], size=19, left=Inches(0.6), top=Inches(1.3), width=Inches(6.0), height=Inches(4.4))
bullets(right, [
    "Conclusions",
    ("L+S improved on L-band in every Sentinel-2 test", 1),
    ("S-band alone was the strongest single band here", 1),
    ("Four L-band dates showed the rise and fall that one pair cannot", 1),
    ("The full scene runs on a normal PC in about 2 GB of memory", 1),
    ("Next: labels under vegetation, more L+S dates, L-band full-pol data", 1),
], size=19, left=Inches(6.9), top=Inches(1.3), width=Inches(5.9), height=Inches(4.4))
for ph in (left, right):
    for r in ph.text_frame.paragraphs[0].runs:
        r.font.bold = True
band_top = Inches(5.85)
s.shapes.add_picture(str(STRIP), 0, band_top, width=W, height=H - band_top)
panel(s, 0, band_top, W, H - band_top, NAVY, 70)
write(s, Inches(0.6), band_top + Inches(0.22), Inches(4.2), Inches(0.8), "Thank you", 34, WHITE, bold=True)
write(s, Inches(4.6), band_top + Inches(0.3), Inches(8.2), Inches(0.4),
      "Code and data: gitlab.com/Aditya-Narayan-Nayak/nisar_pro", 16, WHITE)
write(s, Inches(4.6), band_top + Inches(0.75), Inches(8.2), Inches(0.4),
      "Check every number: python3 run_bihar_analysis.py (in the ingarss_2026 folder)", 14, SKY)
write(s, W - Inches(1.2), H - Inches(0.5), Inches(0.6), Inches(0.35), "8", 11, SKY, align=PP_ALIGN.RIGHT)

prs.core_properties.author = "Aditya Narayan Nayak"
prs.core_properties.title = "NISAR Pro - InGARSS 2026 YP Hackathon"
prs.save(OUT)
print(f"Wrote {OUT}")
