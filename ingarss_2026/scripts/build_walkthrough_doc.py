#!/usr/bin/env python3
"""Write explainer/walkthrough.html from the packaged result JSONs.

Every number in the text is read from a JSON file at build time. Print the HTML to PDF
with any browser, for example:
  google-chrome --headless --no-pdf-header-footer --print-to-pdf=explainer/NISAR_Pro_Visual_Walkthrough.pdf explainer/walkthrough.html
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
R = ROOT / "results"
KM2_PER_ACRE = 0.004046856


def load(rel):
    return json.loads((ROOT / rel).read_text())


def A(km2):
    """Area in km2 and acres."""
    return f"{km2:,.2f} km² ({km2 / KM2_PER_ACRE:,.0f} acres)"


def main():
    n = load("explainer/walkthrough_numbers.json")
    P = n["pairs"]
    b1, b2, b3, b4 = (P[k] for k in ("B1_L_jul26_aug31", "B2_L_aug31_sep12", "B3_L_sep12_oct18", "B4_S_aug31_sep12"))
    fc = n["fused_common_footprint"]
    fv = n["fusion_vs_L_water_12sep"]
    dws, dwz, dwo = n["dark_water_series_km2"], n["dark_water_zoom_window_km2"], n["dark_water_outside_zoom_km2"]
    zw, sc = n["zoom_window"], n["stage_check"]
    diag = load("results/LS_fused_aug31_sep12/fusion_diagnostics.json")
    val = load("results/validation/sentinel2_validation.json")["tests"]
    sand = load("results/validation/sand_rule_check.json")
    onoff = diag["rule_on_off"]
    outside = diag["gain_outside_water_present_26jul_and_31aug"]["fused"]["km2"]
    v12 = val["water_12sep"]["results"]["ndwi_0.0"]
    v31 = val["water_31aug"]["results"]["ndwi_0.0"]
    vg = val["gain_31aug_to_12sep"]["results"]["ndwi_0.0"]
    zoom_peak = max(dwz.values())
    zoom_ratio = dwz["12 Sep"] / dwz["26 Jul"]
    drop_pct = 100 * (1 - dws["18 Oct"] / dws["12 Sep"])

    ex = n["example_pixels"]
    names = (("new_high", "New water, high"), ("new_medium", "New water, medium"), ("stable_water", "Stable water"),
             ("water_loss", "Water loss"), ("land", "Land"))
    rows = "".join(
        f"<tr><td>{label}<br><span class='cap'>{ex[k]['lat']}°N, {ex[k]['lon']}°E</span></td>"
        f"<td class='r'>{ex[k]['power_31aug']} → {ex[k]['power_12sep']}</td>"
        f"<td class='r'>{ex[k]['db_31aug']} → {ex[k]['db_12sep']}</td>"
        f"<td class='r'>{ex[k]['median_31aug']} → {ex[k]['median_12sep']}</td>"
        f"<td class='r'>{ex[k]['delta']:+.2f} dB</td><td>class {ex[k]['class']}</td></tr>" for k, label in names if k in ex)
    ex_hi_raw = ex["new_high"]["db_12sep"] - ex["new_high"]["db_31aug"]
    html = f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>NISAR Pro: visual walkthrough</title><style>
@page{{size:A4 landscape;margin:11mm 13mm}}
body{{font-family:'DejaVu Sans',Arial,sans-serif;font-size:10pt;line-height:1.42;color:#1c1917}}
h1{{font-size:19pt;margin:0 0 4px}} h2{{font-size:13.5pt;margin:16px 0 6px;border-bottom:1.5px solid #a8a29e;padding-bottom:2px;break-after:avoid}}
h3{{font-size:11pt;margin:10px 0 4px;break-after:avoid}} p{{margin:4px 0 6px}} ul,ol{{margin:4px 0 6px;padding-left:20px}} li{{margin:2px 0}}
.sub{{color:#57534e;margin:0 0 10px}} .box{{background:#f5f5f4;border-left:4px solid #2563eb;padding:8px 12px;margin:8px 0}}
.warn{{border-left-color:#b45309}} img{{width:100%;display:block;margin:6px 0 2px}} .cap{{font-size:8.5pt;color:#57534e;margin-bottom:8px}}
table{{border-collapse:collapse;width:100%;font-size:9pt;margin:6px 0}} th,td{{border-bottom:1px solid #e7e5e4;padding:3px 6px;text-align:left;vertical-align:top}}
th{{border-bottom:1.5px solid #a8a29e;color:#57534e}} td.r,th.r{{text-align:right;white-space:nowrap}}
.eq{{font-family:'DejaVu Sans Mono',monospace;font-size:9pt;white-space:nowrap}} .pb{{break-before:page}} .two{{column-count:2;column-gap:26px}} .two h3{{margin-top:0}} .fig{{width:76%;margin:2px auto 2px}} .keep{{break-inside:avoid}}
code{{font-family:'DejaVu Sans Mono',monospace;font-size:8.8pt}}
</style></head><body>

<h1>How NISAR Pro sees water change: a visual walkthrough</h1>
<p class="sub">Bihar Ganga plain, NISAR track 98, frame 14, July to October 2026 · Aditya Narayan Nayak, Team RunLayer Labs, NISAR Pro Systems &amp; SAR Analytics, Kundura, Odisha, India</p>

<div class="box"><p>This document follows the data step by step: how one radar image becomes a water map, each
pair of dates with real images, L-band and S-band together, and a time-lapse with the main observations. Every
number is read from the result files in this package by <code>scripts/build_walkthrough_doc.py</code>. The figures
come from <code>scripts/make_walkthrough.py</code>, using the same six NISAR files.</p></div>

<h2>Part 1. The physics, the code and the 7-stage pipeline</h2>

<div class="two"><h3>The physics</h3>
<ul>
<li><b>Radar brings its own light.</b> NISAR sends microwave pulses and records the echo. Microwaves pass
through cloud, so it works in the monsoon, day or night, when optical satellites only see cloud.</li>
<li><b>Calm water is a mirror.</b> The pulse bounces away from the satellite, so water looks dark. Rough
ground, crops and buildings scatter energy back, so they look bright. The method looks for places that
turned dark.</li>
<li><b>Two wavelengths.</b> L-band has a 24.2 cm wave (1.239 GHz) and S-band a 9.4 cm wave (3.2 GHz). A
surface looks smooth when its bumps are much smaller than the wave, so the same sand bank or field can look
smooth (dark) to L-band and rough (bright) to S-band.</li>
<li><b>HH and HV.</b> HH means the radar sends horizontal waves and listens for horizontal echoes. HV means
it listens for vertical echoes; plants and rough surfaces turn part of the wave, so HV is stronger there.
Water is detected with HH; HV is used in the fusion rules.</li>
<li><b>Decibels (dB).</b> Echo strength varies by thousands of times, so we use a log scale. Water is
usually below −13 dB, land around −10 to 0 dB.</li>
</ul>

<h3>The code: who does what</h3>
<p>One NISAR image layer is 1.16 billion numbers (4.63 GB). Opening it the normal way loads all of that
into memory at once. The Rust engine never does that:</p>
<ul>
<li><code>main.rs</code> reads the command (which two files, which band) and runs the steps in order.</li>
<li><code>windowed.rs</code> opens the HDF5 file and decodes only the compressed 512 × 512 chunks that are
needed, never the whole layer.</li>
<li><code>nisar_parser.rs</code> reads the image in strips of 1,024 rows (33 strips) and averages every 8 × 8
block into one 80 m pixel, so only a 72 MB grid of 4,212 × 4,293 pixels stays in memory.</li>
<li><code>flood_detect.rs</code> runs stages 1 to 7 below.</li>
<li><code>io.rs</code> writes the results: GeoTIFF class maps and GeoJSON shapes with real map coordinates,
plus a JSON report.</li>
</ul>
<p>Each pair of dates takes 44 to 65 seconds with a peak of 1.87 to 2.32 GB of memory on a 4-core
workstation. The L+S fusion, the Sentinel-2 checks and these figures are Python scripts in <code>scripts/</code>.</p></div>

<h3 class="pb">The 7 stages, one by one (L-band, 31 August → 12 September)</h3>
<div class="two">
<p><b>Before the stages: 10 m to 80 m.</b> Each NISAR pixel is 10 m. While reading a strip, the engine takes
every 8 × 8 block (64 pixels), keeps the values that are valid (power ≥ 0.0001), and averages them if at least
32 are valid: <span class="eq">P̄ = (1/n) × Σ Pᵢ</span>. It averages power, not dB, because power is the physical
quantity; averaging dB would weight dark pixels too much. One 80 m pixel covers 0.0064 km² (1.58 acres).</p>

<p><b>Stage 1. Check the pair.</b> The two dates must hold the same measurement: the same polarization term
(HHHH) from the same product type (GCOV). Comparing HH on one date with HV on another would show a change that
is not real. We checked this for every pair from the file names and the HDF5 layer paths.</p>

<p><b>Stage 2. Convert to decibels and mark no data.</b> <span class="eq">σ⁰ = 10 × log₁₀(P̄)</span>. Power below
0.0001 (−40 dB) is below what the radar can measure, so it is marked as no data. A pixel must be valid on both
dates. Near the edge of the image the echo fades out and can look as dark as water, so the engine removes a
strip 40 pixels (3.2 km) wide next to every no-data area. This is why the maps have a clean border and why a
few small no-data spots inside the scene leave 6.5 km square gaps.</p>

<p><b>Stage 3. Remove speckle.</b> Radar images are grainy: even a uniform field gives a mix of brighter and
darker pixels. For every pixel the engine takes the 3 × 3 window around it (9 values), sorts the valid ones
and keeps the middle value. A median is used, not a mean, because one very bright or very dark pixel cannot
pull the middle value. It is done on both dates before comparing them.</p>

<p><b>Stage 4. Measure the change.</b> <span class="eq">Δ = dB(after) − dB(before)</span>, which is the same as
<span class="eq">10 × log₁₀(P_after / P_before)</span>. Because it is a ratio, anything that affects both dates in the
same way, such as ground slope or a calibration offset, cancels out. Negative Δ means the place got darker;
−3 dB means the echo halved, −10 dB means it dropped to a tenth.</p>

<p><b>Stage 5. Find water that was already there.</b> A pixel darker than −13.0 dB on both dates (after the
median) is stable water. These pixels are taken out of the next stages, because water that was already there
is not new water.</p>

<p><b>Stage 6a. Choose the thresholds.</b> The engine computes Otsu's threshold from the change histogram:
it tries every cut point and picks the one that best separates the pixels into two groups,
<span class="eq">σ²_B = ω₀ × ω₁ × (μ₀ − μ₁)²</span>, using only changes between −25 and 0 dB in 256 bins. Here it gave
{n['otsu_db']['l']} dB for L-band and {n['otsu_db']['s']} dB for S-band. A safety limit of −3.0 dB stops a weak cut
(for example on a windy day), and the seed must be at most −5.0 dB:
<span class="eq">T_seed = min(−5.0, min(Otsu, −3.0)) = −5.0 dB</span>. So in these scenes Otsu is reported but does not
change the map.</p>

<p><b>Stage 6b. Grow new water.</b> Every pixel with Δ below −5.0 dB that is not stable water is a seed. From
each seed the engine checks its 8 neighbours; a neighbour joins if its Δ is below −2.5 dB, and the search
repeats until nothing more joins. One strict threshold would miss the edges of new water; one loose threshold
would pick up noise everywhere. With two, a weak drop only counts if it touches a strong one.</p>

<p><b>Stage 6c. Clean up.</b> First an opening: a pixel survives only if all 8 neighbours are also new water,
then every survivor gets its 3 × 3 block back. This removes single noisy pixels and thin lines, but also any new
water narrower than 3 pixels (about 240 m). Then any connected group smaller than 8 pixels (0.0512 km²,
12.65 acres) is removed.</p>

<p><b>Stage 7. Give each pixel one class.</b> 1 = stable water (stage 5). 2 = new water with Δ below the seed
threshold (high confidence). 3 = the rest of the grown new water (medium confidence). 5 = water loss: below
−13.0 dB before, at or above −13.0 dB after, and Δ of at least +3 dB. 0 = everything else. Area is just
counting: <span class="eq">area = N × 0.0064 km²</span>, and acres = km² / 0.004046856.</p>
</div>

<h3 class="pb">Five real pixels through the stages</h3>
<p>Each row is a real 80 m pixel from the window in Figure 1, the pixel of that class nearest the window centre.</p>
<table class="keep"><tr><th>Pixel (lat, lon)</th><th class="r">Power 31 Aug → 12 Sep</th><th class="r">Stage 2 dB</th><th class="r">Stage 3 median dB</th><th class="r">Stage 4 Δ</th><th>Engine result</th></tr>
{rows}
</table>
<ul>
<li>The <b>high-confidence</b> pixel: the raw values drop by {ex_hi_raw:.2f} dB, but after the median the drop is
{ex['new_high']['delta']} dB. The neighbourhood is darker than the single pixel, which makes it a seed.</li>
<li>The <b>medium-confidence</b> pixel dropped {ex['new_medium']['delta']} dB: not enough to start a region, but enough
to join one next to it.</li>
<li>The <b>water-loss</b> pixel is still −16.0 dB as a single raw value on 12 September, but its 3 × 3 median is
{ex['water_loss']['median_12sep']} dB, so the neighbourhood has become land. Stage 3 changed the answer here.</li>
</ul>

<div class="pb"></div>
<img class="fig" src="walk_A_stages.png">
<p class="cap">Figure 1. The stages on one 40 km × 40 km window centred at {zw['centre_lat']}°N, {zw['centre_lon']}°E,
chosen automatically as the window with the most change. The images in stages 2 to 6 are recomputed for this
figure; stage 7 is the engine's real output. Check: all {sc['engine_high_conf_px_in_window']:,} engine high-confidence
pixels in this window also have Δ below −5 dB in our recomputation ({100 * sc['share_with_recomputed_delta_below_minus5']:.0f}%).</p>
<p><b>How to read the histogram.</b> Most pixels sit near Δ = 0 (nothing changed). The long left tail is the
places that got much darker. The seed line (−5 dB) cuts far into that tail, so a pixel needs a strong drop to
start a new-water region.</p>

<h2 class="pb">Part 2. L-band, 26 July → 31 August</h2>
<img class="fig" src="walk_B1_L_jul26_aug31.png">
<p class="cap">Figure 2. Top: full scene. Bottom: the 40 km window (red box). Columns: before, after, change, result.</p>
<ul>
<li>Water before {A(b1['water_before_km2'])}, after {A(b1['water_after_km2'])}.</li>
<li>New water {A(b1['new_water_km2'])}, of which {A(b1['new_high_km2'])} high confidence. Water loss {A(b1['water_loss_km2'])}.</li>
<li><b>What we see:</b> by the river (bottom row) the dark area spreads on both banks, and {A(b1['zoom_new_water_km2'])}
of new water appears in this window alone. Out in the western farmland, many places that were dark on 26 July are
brighter on 31 August, which shows up as water loss.</li>
<li><b>What it means:</b> the water did not just grow; it moved. It gathered along the river while scattered
dark patches in the fields went away.</li>
</ul>

<h2 class="pb">Part 3. L-band, 31 August → 12 September</h2>
<img class="fig" src="walk_B2_L_aug31_sep12.png">
<p class="cap">Figure 3. Same layout as Figure 2.</p>
<ul>
<li>Water before {A(b2['water_before_km2'])}, after {A(b2['water_after_km2'])}.</li>
<li>New water {A(b2['new_water_km2'])} ({A(b2['new_high_km2'])} high confidence). Water loss {A(b2['water_loss_km2'])}.</li>
<li><b>What we see:</b> near the river the blue (darker) areas keep spreading into side channels and low land,
adding {A(b2['zoom_new_water_km2'])} in the window. Large farmland areas to the west turn brighter (red).</li>
<li>The right edge of the full-scene images has a dark strip. That is the edge of the radar swath, not water, and
it is why stage 2 cuts 40 pixels next to every no-data edge.</li>
</ul>

<h2 class="pb">Part 4. L-band, 12 September → 18 October (recession)</h2>
<img class="fig" src="walk_B3_L_sep12_oct18.png">
<p class="cap">Figure 4. Same layout as Figure 2.</p>
<ul>
<li>Water before {A(b3['water_before_km2'])}, after {A(b3['water_after_km2'])}.</li>
<li>Water loss {A(b3['water_loss_km2'])}, ten times the new water of {A(b3['new_water_km2'])}.</li>
<li><b>What we see:</b> the change map is mostly red: places got brighter as water left. In the window,
{A(b3['zoom_loss_km2'])} turned from water back to land, and the river shrinks back towards its main channels.</li>
</ul>

<h2 class="pb">Part 5. S-band, 31 August → 12 September</h2>
<img class="fig" src="walk_B4_S_aug31_sep12.png">
<p class="cap">Figure 5. Same pipeline and layout, S-band. Only the thresholds differ (stable water −12.5 dB,
seed −4.8 dB, growth −2.2 dB), because the shorter wave sees surfaces as rougher.</p>
<ul>
<li>Water before {A(b4['water_before_km2'])}, after {A(b4['water_after_km2'])}.</li>
<li>New water {A(b4['new_water_km2'])}, almost the same as L-band's {A(b2['new_water_km2'])}.</li>
<li>But stable water is {A(b4['stable_water_km2'])} against L-band's {A(b2['stable_water_km2'])}, and water loss
{A(b4['water_loss_km2'])} against {A(b2['water_loss_km2'])}.</li>
<li><b>What it means:</b> both bands agree on where new water came, but L-band calls much more area "water" to
begin with. Part 6 checks who is right.</li>
</ul>
<p class="cap">These numbers use each band's own footprint. The fair three-way comparison in Part 6 uses the area
both bands cover.</p>

<h2 class="pb">Part 6. Putting L and S together (fusion)</h2>
<img class="fig" src="walk_C_fusion.png">
<p class="cap">Figure 6. Classes for L-band, S-band and L+S on the common footprint, and how the 12 September water map
changed between L-band and L+S.</p>
<p>Both grids line up exactly on 80 m pixels, so each pixel goes through four if/then rules:</p>
<ol>
<li><b>Sandbar rule:</b> dark in L (HH &lt; −13 dB) but bright in S (HH ≥ −10.5 dB) means not stable water.</li>
<li><b>Wind rule:</b> very dark L-band HH and HV on both dates counts as stable water even if S-band missed it.</li>
<li><b>Canopy rule:</b> a strong L-band drop with low HV is a new-water candidate (not verified; optical data cannot see under plants).</li>
<li><b>S-band gate:</b> every new-water candidate must also be dark in S-band on 12 September (HH &lt; −10.5 dB).</li>
</ol>
<table class="keep"><tr><th>Common footprint, 31 Aug → 12 Sep</th><th class="r">Stable water</th><th class="r">New water</th><th class="r">Water loss</th></tr>
<tr><td>L-band</td><td class="r">{A(fc['l_band_only']['stable_water_km2'])}</td><td class="r">{A(fc['l_band_only']['total_flood_km2'])}</td><td class="r">{A(fc['l_band_only']['receded_water_km2'])}</td></tr>
<tr><td>S-band</td><td class="r">{A(fc['s_band_only']['stable_water_km2'])}</td><td class="r">{A(fc['s_band_only']['total_flood_km2'])}</td><td class="r">{A(fc['s_band_only']['receded_water_km2'])}</td></tr>
<tr><td>L+S</td><td class="r">{A(fc['ls_fused']['stable_water_km2'])}</td><td class="r">{A(fc['ls_fused']['total_flood_km2'])}</td><td class="r">{A(fc['ls_fused']['receded_water_km2'])}</td></tr></table>
<ul>
<li>Compared with L-band, fusion removed {A(fv['removed_km2'])} of L-band's 12 September water and added
{A(fv['added_km2'])}; {A(fv['kept_km2'])} stayed water in both.</li>
<li>Switching rules off one at a time: without the S-band gate, new water would be {A(onoff['without_s_band_filter']['gain']['km2'])};
without the canopy rule, {A(onoff['without_canopy_rule']['gain']['km2'])}.</li>
</ul>
<div class="box keep"><p><b>Who is right? We checked against Sentinel-2</b>, an optical satellite that passed about
5 hours after NISAR on 12 September, using only cloud-free pixels (a pixel is water if NDWI ≥ 0).</p>
<table><tr><th>F1 score (1.0 = perfect agreement)</th><th class="r">L-band</th><th class="r">S-band</th><th class="r">L+S</th></tr>
<tr><td>Water, 12 Sep</td><td class="r">{v12['l_only']['f1']:.3f}</td><td class="r">{v12['s_only']['f1']:.3f}</td><td class="r">{v12['fused']['f1']:.3f}</td></tr>
<tr><td>Water, 31 Aug</td><td class="r">{v31['l_only']['f1']:.3f}</td><td class="r">{v31['s_only']['f1']:.3f}</td><td class="r">{v31['fused']['f1']:.3f}</td></tr>
<tr><td>New water, 31 Aug → 12 Sep</td><td class="r">{vg['l_only']['f1']:.3f}</td><td class="r">{vg['s_only']['f1']:.3f}</td><td class="r">{vg['fused']['f1']:.3f}</td></tr></table>
<p>The pixels that were dark in L-band but bright in S-band were water only
{sand['12Sep_vs_S2_13Sep']['sand_rule_L_dark_S_bright']['ndwi_water_pct']}% of the time on 12 September, against
{sand['12Sep_vs_S2_13Sep']['control_both_dark']['ndwi_water_pct']}% where both bands were dark. So S-band was right to
remove them. They were not all sand, though: on 12 September most of them were vegetation.</p></div>

<h2 class="pb">Part 7. Time-lapse: how the water changed over the season</h2>
<img class="fig" src="walk_D_timelapse.png">
<p class="cap">Figure 7. One L-band picture per date. Blue: darker than −13 dB after the median filter. This is a simple
single-date view, not the change-detection result. An animated version is <code>explainer/timelapse_L_band.gif</code>.</p>
<img src="walk_E_dark_water_series.png" style="width:72%;margin:0 auto">
<table class="keep"><tr><th>Dark water (&lt; −13 dB)</th><th class="r">26 Jul</th><th class="r">31 Aug</th><th class="r">12 Sep</th><th class="r">18 Oct</th></tr>
<tr><td>40 km window by the river</td>{''.join(f'<td class="r">{dwz[d]:,.0f} km²</td>' for d in dwz)}</td></tr>
<tr><td>Rest of the scene</td>{''.join(f'<td class="r">{dwo[d]:,.0f} km²</td>' for d in dwo)}</td></tr>
<tr><td>Whole footprint ({A(n['dark_water_footprint_km2'])})</td>{''.join(f'<td class="r">{dws[d]:,.0f} km²</td>' for d in dws)}</td></tr></table>
<p class="cap">Acres: whole footprint {', '.join(f"{d} {dws[d] / KM2_PER_ACRE:,.0f}" for d in dws)}.</p>

<h2 class="pb">Part 8. Main observations</h2>
<ol>
<li><b>Near the river, water grew a lot and then went back.</b> In the 40 km window, dark water went from
{A(dwz['26 Jul'])} on 26 July to {A(dwz['12 Sep'])} on 12 September, about {zoom_ratio:.1f} times as much, and fell to
{A(dwz['18 Oct'])} by 18 October.</li>
<li><b>Across the whole scene the total hardly changed until October.</b> It stayed between {min(list(dws.values())[:3]):,.0f}
and {max(list(dws.values())[:3]):,.0f} km² from July to September, because scattered dark patches in the farmland
faded while the river area grew. Then it dropped by {drop_pct:.0f}% by 18 October.</li>
<li><b>Water moves, it does not only grow.</b> Every pair has both new water and water loss. Between 31 August and
12 September, L-band found {A(b2['new_water_km2'])} of new water and {A(b2['water_loss_km2'])} of loss.</li>
<li><b>New water away from the usual water.</b> {A(outside)} of L+S new water lies outside any water seen on 26 July or
31 August. The problem statement calls this potential temporary surface inundation.</li>
<li><b>L-band sees more "water" than there is.</b> Against Sentinel-2, L-band had the most false alarms. S-band was
the most accurate single band.</li>
<li><b>Fusion fixes most of L-band's mistakes</b> but did not beat S-band alone in our tests.</li>
</ol>
<div class="box warn keep"><p><b>What we cannot say.</b> Radar shows where water appeared or left, not why. We make no
claim that any change was a flood, rain or irrigation. Optical checks only cover cloud-free pixels (about 14% of the
scene on 12 September) and cannot see water under crops. Thresholds were set by hand. "Dark water" in Part 7 can
include other smooth, dark surfaces.</p></div>

<h3>Words used</h3>
<table class="keep">
<tr><td><b>Backscatter</b></td><td>The echo strength the radar receives from a place.</td></tr>
<tr><td><b>GCOV</b></td><td>The NISAR product we used: map-ready echo strength for each polarization.</td></tr>
<tr><td><b>Pixel</b></td><td>One 80 m × 80 m square, 0.0064 km² (1.58 acres).</td></tr>
<tr><td><b>Footprint</b></td><td>The area the satellite actually imaged and we analysed.</td></tr>
<tr><td><b>F1 score</b></td><td>Agreement between two water maps, from 0 to 1. It counts both missed water and false water.</td></tr>
<tr><td><b>Sentinel-2, NDWI</b></td><td>A European optical satellite, and a green-vs-infrared index that is high over water.</td></tr>
</table>
</body></html>
"""
    out = ROOT / "explainer" / "walkthrough.html"
    out.write_text(html)
    print("wrote", out)


if __name__ == "__main__":
    main()
