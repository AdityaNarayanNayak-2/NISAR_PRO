"""Build ingarss_2026/presentation.pdf (8 slides, 16:9) from HTML with headless Chrome.

Run from anywhere:  python3 scripts/build_presentation.py
Then the manifest is rebuilt. Every number on the slides is the same as in TECHNICAL_NOTE.md
and the result JSONs; this script only lays them out. Images come from ingarss_2026/maps/ and
ingarss_2026/note_figures/.
"""
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
PKG = REPO / "ingarss_2026"
TMP = PKG / ".slides_tmp.html"
OUT = PKG / "presentation.pdf"

CSS = """
@page { size: 1280px 720px; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: 'Inter', 'DejaVu Sans', 'Liberation Sans', Arial, sans-serif; color: #0f172a;
       -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.slide { width: 1280px; height: 720px; position: relative; overflow: hidden; break-after: page;
         padding: 40px 56px 58px; display: flex; flex-direction: column; background: #ffffff; }
.slide:last-child { break-after: auto; }
.kicker { font-size: 13px; letter-spacing: 2px; text-transform: uppercase; color: #2563eb;
          font-weight: 700; margin-bottom: 6px; }
h1 { font-size: 31px; line-height: 1.16; margin: 0 0 18px; font-weight: 800; color: #0b2545;
     letter-spacing: -0.3px; }
.foot { position: absolute; left: 56px; right: 56px; bottom: 20px; display: flex;
        justify-content: space-between; font-size: 12px; color: #64748b; }
.bar { position: absolute; left: 0; bottom: 0; height: 5px; background: #2563eb; }
.row { display: flex; gap: 28px; flex: 1 1 auto; min-height: 0; }
.col { display: flex; flex-direction: column; min-width: 0; }
.grow { flex: 1 1 0; }
img { display: block; max-width: 100%; }
.imgbox { display: flex; align-items: center; justify-content: center; min-height: 0; }
.imgbox img { max-height: 100%; object-fit: contain; }
ul { margin: 0; padding-left: 20px; }
li { font-size: 18px; line-height: 1.36; margin: 0 0 8px; }
p { font-size: 18px; line-height: 1.36; margin: 0 0 8px; }
.small { font-size: 14px; color: #475569; line-height: 1.35; }
.note { font-size: 13px; color: #64748b; line-height: 1.35; margin-top: 6px; }
b.l, .l { color: #2563eb; } b.s, .s { color: #dc2626; } b.ls, .ls { color: #d97706; }
code { font-family: 'DejaVu Sans Mono', monospace; font-size: 0.88em; background: #f1f5f9;
       padding: 1px 5px; border-radius: 4px; }
table { border-collapse: collapse; width: 100%; font-size: 16px; }
th { text-align: right; font-size: 13px; text-transform: uppercase; letter-spacing: 0.8px;
     color: #475569; padding: 6px 10px; border-bottom: 2px solid #0b2545; }
td { text-align: right; padding: 7px 10px; border-bottom: 1px solid #e2e8f0;
     font-variant-numeric: tabular-nums; }
th:first-child, td:first-child { text-align: left; font-weight: 700; }
td .ac { display: block; font-size: 12.5px; color: #64748b; }
.tiles { display: flex; gap: 14px; }
.tile { flex: 1 1 0; min-width: 0; background: #f1f5f9; border-radius: 10px; padding: 12px 16px;
        border-top: 5px solid #94a3b8; }
.tile .big { font-size: 34px; font-weight: 800; line-height: 1.1; color: #0b2545;
             font-variant-numeric: tabular-nums; }
.tile .lab { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;
             color: #475569; margin-bottom: 4px; }
.tile .sub { font-size: 13.5px; color: #475569; line-height: 1.3; margin-top: 3px; }
.tile.l { border-top-color: #2563eb; } .tile.s { border-top-color: #dc2626; }
.tile.ls { border-top-color: #d97706; } .tile.navy { border-top-color: #0b2545; }
.tile.l .lab { color: #2563eb; } .tile.s .lab { color: #dc2626; } .tile.ls .lab { color: #b45309; }
.callout { background: #0b2545; color: #ffffff; border-radius: 10px; padding: 14px 20px;
           font-size: 19px; line-height: 1.35; }
.callout b { color: #fbbf24; }
.card { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 6px solid #2563eb;
        border-radius: 10px; padding: 12px 16px; }
.card h3 { margin: 0 0 4px; font-size: 18px; color: #0b2545; }
.card .cond { font-size: 15.5px; line-height: 1.32; }
.card .why { font-size: 13.5px; color: #475569; line-height: 1.3; margin-top: 4px; }
.card.minus { border-left-color: #dc2626; } .card.plus { border-left-color: #16a34a; }
.card.maybe { border-left-color: #d97706; } .card.gate { border-left-color: #0b2545; }
.tag { display: inline-block; font-size: 11.5px; font-weight: 700; letter-spacing: 0.8px;
       text-transform: uppercase; padding: 2px 8px; border-radius: 20px; background: #e2e8f0;
       color: #334155; margin-left: 6px; vertical-align: 2px; }
.steps { counter-reset: st; list-style: none; padding: 0; }
.steps li { counter-increment: st; position: relative; padding-left: 34px; font-size: 15.5px;
            line-height: 1.3; margin-bottom: 7px; }
.steps li::before { content: counter(st); position: absolute; left: 0; top: 0; width: 23px;
                    height: 23px; border-radius: 50%; background: #0b2545; color: #fff;
                    font-size: 13px; font-weight: 700; text-align: center; line-height: 23px; }
.h { font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.2px;
     color: #0b2545; margin: 0 0 8px; }
/* title slide */
.title { background: #0b2545; color: #ffffff; padding: 46px 56px 58px; }
.title .kicker { color: #93c5fd; }
.title h1 { color: #ffffff; font-size: 37px; margin-bottom: 16px; }
.title li, .title p { color: #dbeafe; font-size: 17px; }
.title li { margin-bottom: 5px; }
.title .tile { padding: 9px 16px; }
.title .tile .big { font-size: 30px; }
.title .foot { color: #93c5fd; }
.title .tile { background: #13315c; }
.title .tile .big { color: #ffffff; }
.title .tile .lab { color: #bfdbfe !important; }
.title .tile .sub { color: #bfdbfe; }
.title .answer { font-size: 19px; line-height: 1.35; color: #ffffff; margin: 10px 0 14px; }
.title .answer b { color: #fbbf24; }
.title .who { font-size: 15px; color: #bfdbfe; line-height: 1.4; margin-top: auto; }
.title .who b { color: #ffffff; font-size: 17px; }
.big8 li { font-size: 21px; margin-bottom: 13px; }
.big8 .h { font-size: 16px; margin-bottom: 14px; }
.big8 .callout { font-size: 20px; }
.mapcard { background: #ffffff; border-radius: 12px; padding: 10px; }
"""

SLIDES = []


def slide(name, body, cls=""):
    SLIDES.append((name, body, cls))


# 1 ---------------------------------------------------------------------------------------------
slide("Challenge and answer", """
<div class="row">
  <div class="col" style="flex: 1 1 0;">
    <div class="kicker">IEEE InGARSS 2026 YP Hackathon · NISAR L2 GCOV · Bihar</div>
    <h1>Does combining NISAR L-band and S-band give a better water map than one band alone?</h1>
    <ul>
      <li>Full scene, track 98, frame 14, not just the 20 km box. Common L/S grid: 59,083.56 km² (14,599,867 acres)</li>
      <li>Three maps on the same 80 m grid and the same dates: L-band only, S-band only, L+S</li>
      <li>Checked against Sentinel-2 wherever there was no cloud</li>
    </ul>
    <div class="tiles" style="margin-top: 12px;">
      <div class="tile l"><div class="lab">L-band</div><div class="big">0.859</div></div>
      <div class="tile s"><div class="lab">S-band</div><div class="big">0.891</div></div>
      <div class="tile ls"><div class="lab">L+S</div><div class="big">0.891</div></div>
    </div>
    <p class="small" style="color:#bfdbfe; margin-top: 6px;">F1 against Sentinel-2 water, 12 Sep 2026,
      cloud-free pixels. Agreement with optical labels, not ground truth.</p>
    <p class="answer"><b>Answer:</b> L+S beat L-band in all 3 Sentinel-2 tests. It did <b>not</b> beat
      S-band: equal on 12 Sep, lower on 31 Aug and for new water.</p>
    <div class="who"><b>Aditya Narayan Nayak</b> · Team RunLayer Labs<br>
      NISAR Pro Systems &amp; SAR Analytics, Kundura, Odisha, India</div>
  </div>
  <div class="col imgbox" style="flex: 0 0 500px;">
    <div class="mapcard"><img src="maps/fig3_newly_detected_water_fused.png" style="width: 480px;"></div>
  </div>
</div>
""", "title")

# 2 ---------------------------------------------------------------------------------------------
slide("AOI and data", """
<div class="kicker">Study area and data</div>
<h1>We processed the full NISAR scene; the 20 km box was only for finding it</h1>
<div class="row">
  <div class="col imgbox" style="flex: 0 0 540px;"><img src="maps/fig0_aoi_and_footprint.png"></div>
  <div class="col grow">
    <table>
      <tr><th>2026</th><th><span class="l">L-band</span> 1.239 GHz</th><th><span class="s">S-band</span> 3.2 GHz</th></tr>
      <tr><td>26 Jul</td><td>DHDH</td><td style="color:#94a3b8;">not used</td></tr>
      <tr><td>31 Aug</td><td>DHDH</td><td>DHNA</td></tr>
      <tr><td>12 Sep</td><td>DHDH</td><td>DHNA</td></tr>
      <tr><td>18 Oct</td><td>DHDH</td><td style="color:#94a3b8;">not used</td></tr>
    </table>
    <ul style="margin-top: 16px;">
      <li>L-band from ASF DAAC, S-band from Bhoonidhi (NRSC/ISRO). Ascending track 98, frame 14,
        10 m grid, EPSG:32645</li>
      <li>L and S were taken seconds apart on 31 Aug and 12 Sep, so the three-way test uses that pair</li>
      <li>HHHH for detection, HVHV for fusion and polarization</li>
      <li>Sentinel-2 Level-2A is used only as independent reference</li>
    </ul>
    <p class="note" style="margin-top: auto;">Catalogue search: ASF lists L-band full-pol on descending
      track 120, frame 76 (e.g. 2 and 14 Sep), not processed here. Bhoonidhi showed no S-band
      compact-pol for the dates searched. HHHV (S-band) is not an intensity, so it is not used as one.</p>
  </div>
</div>
""")

# 3 ---------------------------------------------------------------------------------------------
slide("Method", """
<div class="kicker">Method, one band</div>
<h1>One 7-stage pipeline per band; only the thresholds change between L and S</h1>
<div class="row" style="gap: 24px;">
  <div class="col" style="flex: 0 0 690px;">
    <div class="imgbox"><img src="note_figures/fig_stages.jpg"></div>
    <p class="note">The 7 stages on one 40 km window, L-band, 31 Aug → 12 Sep 2026.</p>
    <div class="tiles" style="margin-top: auto;">
      <div class="tile navy"><div class="lab">One layer</div><div class="big" style="font-size:24px;">1.16 billion px</div><div class="sub">4.63 GB if read at once</div></div>
      <div class="tile navy"><div class="lab">We keep</div><div class="big" style="font-size:24px;">72 MB</div><div class="sub">1,024-row strips, 8×8 average to 80 m</div></div>
      <div class="tile navy"><div class="lab">Each pair</div><div class="big" style="font-size:24px;">44–65 s</div><div class="sub">1.87–2.32 GB peak, 4-core machine</div></div>
    </div>
  </div>
  <div class="col grow">
    <ol class="steps">
      <li><b>Check the pair:</b> same term (HHHH) and product (GCOV) on both dates</li>
      <li><b>Decibels:</b> σ⁰ = 10·log₁₀(P̄); below −40 dB is no data; cut 40 pixels (3.2 km) at every no-data edge</li>
      <li><b>Speckle:</b> median of the valid 3×3 neighbours</li>
      <li><b>Change:</b> Δ = dB(after) − dB(before)</li>
      <li><b>Stable water:</b> below the water level on both dates</li>
      <li><b>New water:</b> seeds below the seed level, grown into 8 neighbours below the growth level;
        groups under 8 pixels removed. Otsu is reported only: T_seed = min(−5.0, T_Otsu, −3.0) = −5.0 dB</li>
      <li><b>Classes</b> 0, 1, 2, 3, 5 and areas. Class 4 needs an InSAR coherence layer, not used here</li>
    </ol>
    <table style="font-size: 14.5px; margin-top: auto;">
      <tr><th>Threshold (dB)</th><th class="l">L</th><th class="s">S</th></tr>
      <tr><td>Stable water, both dates</td><td>−13.0</td><td>−12.5</td></tr>
      <tr><td>Seed change</td><td>−5.0</td><td>−4.8</td></tr>
      <tr><td>Growth change</td><td>−2.5</td><td>−2.2</td></tr>
      <tr><td>Otsu (reported only)</td><td>−3.26</td><td>−3.47</td></tr>
    </table>
  </div>
</div>
""")

# 4 ---------------------------------------------------------------------------------------------
slide("Fusion method", """
<div class="kicker">Method, L+S fusion</div>
<h1>Fusion is four if/then rules on one shared 80 m grid</h1>
<div class="row">
  <div class="col" style="flex: 0 0 600px; gap: 10px;">
    <div class="card minus"><h3>1. Sandbar rule <span class="tag">removes false water</span></h3>
      <div class="cond">L HH &lt; −13 dB but S HH ≥ −10.5 dB on either date → not stable water</div>
      <div class="why">A surface can look smooth to the long L wave and rough to the short S wave.</div></div>
    <div class="card plus"><h3>2. Wind rule <span class="tag">adds water</span></h3>
      <div class="cond">L HH &lt; −15.5 dB and HV &lt; −22.0 dB on both dates → stable water, even if S missed it</div></div>
    <div class="card maybe"><h3>3. Canopy rule <span class="tag">adds candidates</span></h3>
      <div class="cond">L HH drops ≥ 3.26 dB, later HV &lt; −20 dB, later HH &lt; −12 dB → new-water candidate</div>
      <div class="why">Not verified: optical data cannot see under plants.</div></div>
    <div class="card gate"><h3>4. S-band gate <span class="tag">main filter</span></h3>
      <div class="cond">Every new-water candidate needs S HH &lt; −10.5 dB on 12 Sep</div></div>
    <p class="note">Rule names describe intent, not proven surface types. Both grids and their
      720 m / 2,880 m offset are exact multiples of 80 m, so L and S pixels line up with no resampling.</p>
  </div>
  <div class="col grow">
    <div class="h">What each rule does: switch it off and run again</div>
    <table style="font-size: 15.5px;">
      <tr><th>Run</th><th>Stable water</th><th>New water</th></tr>
      <tr><td>All rules</td><td>2,652.29 km²<span class="ac">655,395 acres</span></td><td>1,337.15 km²<span class="ac">330,417 acres</span></td></tr>
      <tr><td>No sandbar rule</td><td>2,684.26 km²<span class="ac">663,296 acres</span></td><td>1,322.69 km²<span class="ac">326,845 acres</span></td></tr>
      <tr><td>No wind rule</td><td>2,381.78 km²<span class="ac">588,551 acres</span></td><td>1,386.80 km²<span class="ac">342,685 acres</span></td></tr>
      <tr><td>No canopy rule</td><td>2,652.29 km²<span class="ac">655,395 acres</span></td><td>1,113.61 km²<span class="ac">275,180 acres</span></td></tr>
      <tr><td>No S-band gate</td><td>2,652.29 km²<span class="ac">655,395 acres</span></td><td>1,675.85 km²<span class="ac">414,111 acres</span></td></tr>
    </table>
    <div class="callout" style="margin-top: auto;">The <b>S-band gate</b> is the strongest control: it removed
      338.70 km² (83,695 acres) of candidates. Moving it by ±1 dB moves new water between 1,208.44 and
      1,449.29 km² (298,611 to 358,128 acres).</div>
  </div>
</div>
""")

# 5 ---------------------------------------------------------------------------------------------
slide("L-only, S-only and L+S results", """
<div class="kicker">Results, 31 Aug → 12 Sep 2026</div>
<h1>The bands agree on the main pattern; L-band marks much more area as water</h1>
<div class="row">
  <div class="col imgbox" style="flex: 0 0 790px;"><img src="maps/fig1_change_maps_aug31_sep12.png"></div>
  <div class="col grow" style="gap: 8px; justify-content: center;">
    <div class="h" style="margin: 0;">New water on the common footprint</div>
    <div class="tile l" style="padding: 8px 16px;"><div class="lab">L-band</div><div class="big" style="font-size:26px;">1,137.14 km²</div><div class="sub">280,993 acres</div></div>
    <div class="tile s" style="padding: 8px 16px;"><div class="lab">S-band</div><div class="big" style="font-size:26px;">1,174.89 km²</div><div class="sub">290,322 acres</div></div>
    <div class="tile ls" style="padding: 8px 16px;"><div class="lab">L+S</div><div class="big" style="font-size:26px;">1,337.15 km²</div><div class="sub">330,417 acres</div></div>
    <p class="small" style="margin: 0;">L and S new water overlap by 858.56 km² (212,155 acres), Jaccard 0.59.
      L+S is partly larger by design, because its candidates come from both bands.</p>
  </div>
</div>
<table style="margin-top: 12px; font-size: 15px; flex: 0 0 auto;">
  <tr><th>Same footprint</th><th>Stable water</th><th>Water loss</th><th>Water on 12 Sep</th></tr>
  <tr><td class="l">L-band</td><td>3,314.83 km² (819,112 acres)</td><td>888.84 km² (219,637 acres)</td><td>4,451.97 km² (1,100,105 acres)</td></tr>
  <tr><td class="s">S-band</td><td>2,546.37 km² (629,222 acres)</td><td>214.98 km² (53,123 acres)</td><td>3,721.26 km² (919,544 acres)</td></tr>
  <tr><td class="ls">L+S</td><td>2,652.29 km² (655,395 acres)</td><td>723.37 km² (178,749 acres)</td><td>3,989.43 km² (985,811 acres)</td></tr>
</table>
""")

# 6 ---------------------------------------------------------------------------------------------
slide("Change detection", """
<div class="kicker">Change detection, L-band, four dates in 2026</div>
<h1>Water spread along the river into September; about half the dark water was gone by mid-October</h1>
<div class="row">
  <div class="col imgbox" style="flex: 0 0 690px;"><img src="note_figures/fig_timelapse.jpg"></div>
  <div class="col grow">
    <div class="h">Dark water (below −13 dB), 40 km river window</div>
    <div class="tiles" style="gap: 10px;">
      <div class="tile navy" style="padding: 9px 10px;"><div class="lab">26 Jul</div><div class="big" style="font-size:20px; white-space: nowrap;">213 km²</div><div class="sub" style="white-space: nowrap; font-size: 12px;">52,609 acres</div></div>
      <div class="tile navy" style="padding: 9px 10px;"><div class="lab">31 Aug</div><div class="big" style="font-size:20px; white-space: nowrap;">617 km²</div><div class="sub" style="white-space: nowrap; font-size: 12px;">152,400 acres</div></div>
      <div class="tile l" style="padding: 9px 10px;"><div class="lab">12 Sep</div><div class="big" style="font-size:20px; white-space: nowrap;">812 km²</div><div class="sub" style="white-space: nowrap; font-size: 12px;">200,608 acres</div></div>
      <div class="tile navy" style="padding: 9px 10px;"><div class="lab">18 Oct</div><div class="big" style="font-size:20px; white-space: nowrap;">299 km²</div><div class="sub" style="white-space: nowrap; font-size: 12px;">73,872 acres</div></div>
    </div>
    <table style="font-size: 14.5px; margin-top: 14px;">
      <tr><th>L-band pair</th><th>New water</th><th>Water loss</th></tr>
      <tr><td>26 Jul → 31 Aug</td><td>1,695.81 km²<span class="ac">419,043 acres</span></td><td>1,471.24 km²<span class="ac">363,553 acres</span></td></tr>
      <tr><td>31 Aug → 12 Sep</td><td>1,166.21 km²<span class="ac">288,177 acres</span></td><td>889.96 km²<span class="ac">219,914 acres</span></td></tr>
      <tr><td>12 Sep → 18 Oct</td><td>239.60 km²<span class="ac">59,207 acres</span></td><td>2,551.94 km²<span class="ac">630,597 acres</span></td></tr>
    </table>
    <p class="note">Each pair on its own valid area.</p>
    <div class="callout" style="margin-top: auto; font-size: 16.5px;"><b>1,282.78 km² (316,982 acres)</b> of
      L+S new water lies outside any water seen on 26 Jul or 31 Aug: the problem statement's "potential
      temporary surface inundation". SAR alone does not tell us why it appeared.</div>
  </div>
</div>
""")

# 7 ---------------------------------------------------------------------------------------------
slide("Validation", """
<div class="kicker">Validation against Sentinel-2 (NDWI ≥ 0, fixed before scoring, cloud-free pixels only)</div>
<h1>L+S beats L-band, mainly through fewer false alarms, but not S-band</h1>
<div class="row">
  <div class="col" style="flex: 0 0 600px;">
    <div class="imgbox"><img src="maps/fig5_sentinel2_agreement.png"></div>
    <div class="card" style="margin-top: 22px;"><h3>Checking the sandbar rule</h3>
      <div class="cond">Pixels dark in L but bright in S were water only <b>8.7%</b> (12 Sep) and <b>9.2%</b>
        (31 Aug) of the time, against 80.3% and 70.3% where both were dark.</div>
      <div class="why">Not all sand: bare ground led on 31 Aug, vegetation on 12 Sep.</div></div>
  </div>
  <div class="col grow">
    <table>
      <tr><th>12 Sep (S-2 about 5 h later)</th><th>Precision</th><th>Recall</th><th>F1</th></tr>
      <tr><td class="l">L-band</td><td>0.826</td><td>0.895</td><td><b>0.859</b></td></tr>
      <tr><td class="s">S-band</td><td>0.911</td><td>0.872</td><td><b>0.891</b></td></tr>
      <tr><td class="ls">L+S</td><td>0.900</td><td>0.881</td><td><b>0.891</b></td></tr>
    </table>
    <p class="note">Scored 7,946.03 km² (1,963,507 acres), about 14% of the footprint, because of cloud.</p>
    <table style="margin-top: 14px;">
      <tr><th>F1</th><th class="l">L</th><th class="s">S</th><th class="ls">L+S</th></tr>
      <tr><td>Water, 31 Aug (S-2 29 Aug)</td><td>0.807</td><td>0.874</td><td>0.834</td></tr>
      <tr><td>New water, 31 Aug → 12 Sep</td><td>0.555</td><td>0.652</td><td>0.637</td></tr>
      <tr><td>Water, 18 Oct (L only)</td><td>0.744</td><td>–</td><td>–</td></tr>
    </table>
    <p class="note">Agreement with optical labels, not ground truth. Confusion matrices: <code>VALIDATION.md</code>.</p>
    <div class="card gate" style="margin-top: 22px;"><h3>Polarization, L-band, 12 Sep</h3>
      <div class="cond">F1 0.848 with HH, 0.835 adding HV, 0.854 with HH + 2·HV. HV added little here.</div></div>
  </div>
</div>
""")

# 8 ---------------------------------------------------------------------------------------------
slide("Uncertainty and conclusions", """
<div class="kicker">Uncertainty and conclusions</div>
<h1>S-band was the strongest single band here; fusion fixed most of L-band's over-mapping</h1>
<div class="row big8" style="gap: 44px;">
  <div class="col grow">
    <div class="h">Limits</div>
    <ul>
      <li>Cloud: only about 14% of the footprint could be scored on 12 Sep</li>
      <li>Optical images cannot see water under crops, so L-band's possible advantage there is untested</li>
      <li>Thresholds are hand-set; the S-band gate is the main sensitivity</li>
      <li>New water is a backscatter drop; features narrower than about 240 m are removed</li>
      <li>L-band full-pol (track 120) was found but not processed</li>
      <li>No cause is assigned to any water change</li>
    </ul>
  </div>
  <div class="col grow">
    <div class="h">Conclusions</div>
    <ul>
      <li>L+S improved on L-band in every Sentinel-2 test and gave the best new-water precision (0.734)</li>
      <li>L+S did not beat S-band alone in these tests</li>
      <li>The whole scene runs on a normal workstation in about 2 GB of memory</li>
      <li>Next: labels under vegetation, better thresholds, more L+S dates, full-pol data</li>
    </ul>
    <div class="callout" style="margin-top: auto;"><b>Check it yourself.</b>
      <span style="font-family:'DejaVu Sans Mono',monospace; font-size: 16px;">python3 run_bihar_analysis.py</span>
      checks all file hashes, prints every number in these slides and ends with ALL CHECKS PASSED.</div>
  </div>
</div>
""")


def main():
    n = len(SLIDES)
    parts = []
    for i, (name, body, cls) in enumerate(SLIDES, 1):
        parts.append(
            f'<section class="slide {cls}">{body}'
            f'<div class="foot"><span>{name}</span><span>{i} / {n}</span></div>'
            f'<div class="bar" style="width: {100 * i / n:.1f}%;"></div></section>')
    html = (f'<!doctype html><html lang="en"><meta charset="utf-8"><style>{CSS}</style>'
            f'<body>{"".join(parts)}</body></html>')
    TMP.write_text(html, encoding="utf-8")
    try:
        subprocess.run(
            ["google-chrome", "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
             "--virtual-time-budget=20000", f"--print-to-pdf={OUT}", f"file://{TMP}"],
            check=True, stderr=subprocess.DEVNULL)
    finally:
        TMP.unlink(missing_ok=True)
    print(f"Wrote {OUT} ({n} slides)")
    subprocess.run([sys.executable, str(PKG / "scripts" / "build_provenance_manifest.py")], check=True)


if __name__ == "__main__":
    main()
