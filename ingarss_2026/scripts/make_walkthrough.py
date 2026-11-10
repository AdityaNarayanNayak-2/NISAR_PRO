#!/usr/bin/env python3
"""Figures and numbers for the visual walkthrough (explainer/).

Reads the six granules at 80 m (8x8 average of linear power, the same reader as the
fusion script) and the packaged class rasters. Writes PNG figures, a time-lapse GIF
and walkthrough_numbers.json. Class maps always come from the packaged engine and
fusion outputs; the intermediate stage images (dB, median, change, thresholds) are
recomputed pixel by pixel here for display.

Example: python3 scripts/make_walkthrough.py --data-dir <granules> --results results \\
         --work-dir /tmp/walk --out explainer
"""
import argparse
import importlib.util
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import rasterio
from matplotlib.colors import ListedColormap, TwoSlopeNorm
from matplotlib.patches import Patch, Rectangle
from PIL import Image

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("fusion", HERE / "run_ls_fusion_and_pol_assessment.py")
fusion = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fusion)

GRANULES = {
    "l0726": ("LSAR", "NISAR_L2_PR_GCOV_026_098_A_014_4005_DHDH_A_20260726T233812_20260726T233846_P05023_N_F_J_001.h5"),
    "l0831": ("LSAR", "NISAR_L2_PR_GCOV_029_098_A_014_4005_DHDH_A_20260831T233810_20260831T233845_P05023_N_F_J_001.h5"),
    "l0912": ("LSAR", "NISAR_L2_PR_GCOV_030_098_A_014_4005_DHDH_A_20260912T233810_20260912T233845_P05023_N_F_J_001.h5"),
    "l1018": ("LSAR", "NISAR_L2_PR_GCOV_033_098_A_014_4005_DHDH_A_20261018T233811_20261018T233845_P05023_N_F_J_001.h5"),
    "s0831": ("SSAR", "NISAR_S2_UR_GCOV_029_098_A_014_3700_DHNA_A_20260831T233810_20260831T233846_P00500_M_F_I_001.h5"),
    "s0912": ("SSAR", "NISAR_S2_UR_GCOV_030_098_A_014_3700_DHNA_A_20260912T233809_20260912T233846_P00500_N_F_I_001.h5"),
}
SHAPE = {"LSAR": (33696, 34344), "SSAR": (33120, 34200)}
LABEL = {"l0726": "26 Jul", "l0831": "31 Aug", "l0912": "12 Sep", "l1018": "18 Oct", "s0831": "31 Aug", "s0912": "12 Sep"}
ROW_OFF, COL_OFF = 36, 9          # S grid inside the L grid, in 80 m pixels
PX_KM2, KM2_PER_ACRE = 0.0064, 0.004046856

OUTSIDE, LAND = "#ffffff", "#e7e5e4"
WATER, HIGH, MEDIUM, LOSS = "#2563eb", "#dc2626", "#f59e0b", "#0d9488"
INK, MUTED = "#1c1917", "#57534e"
CLASS_CMAP = ListedColormap([OUTSIDE, LAND, WATER, HIGH, MEDIUM, LOSS])
CLASS_LEGEND = [Patch(color=WATER, label="Stable water"), Patch(color=HIGH, label="New water, high confidence"),
                Patch(color=MEDIUM, label="New water, medium confidence"), Patch(color=LOSS, label="Water loss"),
                Patch(color=LAND, label="Stable non-water")]
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 8.5, "text.color": INK,
                     "axes.edgecolor": "#a8a29e", "axes.linewidth": 0.6})


def acres(km2):
    return round(km2 / KM2_PER_ACRE)


def db(p):
    out = np.full(p.shape, np.nan, np.float32)
    ok = p >= 1e-4
    out[ok] = 10 * np.log10(p[ok])
    return out


def median3(x):
    """3x3 median over valid neighbours, upper middle for even counts (as the engine)."""
    pad = np.pad(x, 1, constant_values=np.nan)
    stack = np.stack([pad[1 + dr:pad.shape[0] - 1 + dr, 1 + dc:pad.shape[1] - 1 + dc]
                      for dr in (-1, 0, 1) for dc in (-1, 0, 1)])
    n = np.isfinite(stack).sum(0)
    stack.sort(axis=0)
    med = np.take_along_axis(stack, (n // 2)[None], 0)[0]
    return np.where(np.isfinite(x) & (n > 0), med, np.nan)


def erode(mask, it):
    m = mask.copy()
    for _ in range(it):
        p = np.pad(m, 1, constant_values=False)
        out = m.copy()
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                out &= p[1 + dr:p.shape[0] - 1 + dr, 1 + dc:p.shape[1] - 1 + dc]
        m = out
    return m


def class_codes(c, outside):
    """Class raster -> display codes: 0 outside, 1 land, 2 water, 3 high, 4 medium, 5 loss."""
    out = np.ones(c.shape, np.uint8)
    for cls, code in ((1, 2), (2, 3), (3, 4), (5, 5)):
        out[c == cls] = code
    out[outside] = 0
    return out


def show_db(ax, x, title):
    ax.imshow(np.where(np.isfinite(x), x, np.nan), cmap="gray", vmin=-25, vmax=0, interpolation="nearest")
    ax.set_title(title, loc="left", fontsize=8.5)
    ax.set_xticks([]), ax.set_yticks([])
    ax.set_facecolor("white")


def show_delta(ax, d, title):
    ax.imshow(d, cmap="RdBu_r", norm=TwoSlopeNorm(0, -10, 10), interpolation="nearest")
    ax.set_title(title, loc="left", fontsize=8.5)
    ax.set_xticks([]), ax.set_yticks([])


def show_classes(ax, codes, title):
    ax.imshow(codes, cmap=CLASS_CMAP, vmin=0, vmax=5, interpolation="nearest")
    ax.set_title(title, loc="left", fontsize=8.5)
    ax.set_xticks([]), ax.set_yticks([])


def footer(fig, text, y=0.012):
    fig.text(0.5, y, text, ha="center", fontsize=7, color=MUTED)


SOURCE = "NISAR L2 GCOV HHHH, 80 m, EPSG:32645 (UTM 45N). LSAR via ASF DAAC, SSAR via Bhoonidhi (NRSC/ISRO)."


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--data-dir", required=True, type=Path)
    p.add_argument("--results", required=True, type=Path)
    p.add_argument("--work-dir", required=True, type=Path)
    p.add_argument("--out", required=True, type=Path)
    a = p.parse_args()
    a.out.mkdir(parents=True, exist_ok=True)
    a.work_dir.mkdir(parents=True, exist_ok=True)
    R = a.results

    cache = a.work_dir / "rad.npz"
    if cache.exists():
        z = np.load(cache)
        P = {k: z[k] for k in z.files}
    else:
        P = {}
        for k, (instr, name) in GRANULES.items():
            rows, cols = SHAPE[instr]
            P[k] = fusion.stream_multilook_terms(str(a.data_dir / name), instr, ["HHHH"], 0, rows, 0, cols)["HHHH"]
        np.savez(cache, **P)
    D = {k: db(v) for k, v in P.items()}
    M = {k: median3(v) for k, v in D.items()}

    def cls(rel):
        with rasterio.open(R / rel) as s:
            return s.read(1)
    C = {"jul": cls("L_jul26_aug31/sar-bihar-jul26-aug31-progression_flood_class.tif"),
         "aug": cls("L_aug31_sep12/sar-bihar-aug31-sep12-full_flood_class.tif"),
         "oct": cls("L_sep12_oct18/sar-bihar-sep12-oct18-recession-erosion40_flood_class.tif"),
         "s": cls("S_aug31_sep12/sar-bihar-sband-aug31-sep12-full_flood_class.tif"),
         "f": cls("LS_fused_aug31_sep12/sar-bihar-ls-fused-aug31-sep12_class.tif")}
    rep = lambda rel: json.loads((R / rel).read_text())
    J = {"jul": rep("L_jul26_aug31/sar-bihar-jul26-aug31-progression_flood.json")["areas"],
         "aug": rep("L_aug31_sep12/sar-bihar-aug31-sep12-full_flood.json")["areas"],
         "oct": rep("L_sep12_oct18/sar-bihar-sep12-oct18-recession-erosion40_flood.json")["areas"],
         "s": rep("S_aug31_sep12/sar-bihar-sband-aug31-sep12-full_flood.json")["areas"]}
    fused = rep("LS_fused_aug31_sep12/sar-bihar-ls-fused-aug31-sep12_flood.json")["full_scene_comparison"]

    # Common L footprint for all four L dates, with the engine's 40-pixel cut
    l_valid = erode(np.all([np.isfinite(D[k]) for k in ("l0726", "l0831", "l0912", "l1018")], 0), 40)
    s_valid = erode(np.isfinite(D["s0831"]) & np.isfinite(D["s0912"]), 40)

    # Zoom window: the 40 km x 40 km block (500 px) with the most change across the L pairs,
    # kept inside the S grid so every zoom can be shown for all bands.
    change = np.isin(C["aug"], (2, 3)) | np.isin(C["jul"], (2, 3)) | (C["oct"] == 5)
    best, win = -1, None
    for r in range(ROW_OFF, ROW_OFF + 4140 - 500, 50):
        for c in range(COL_OFF, COL_OFF + 4275 - 500, 50):
            n = int(change[r:r + 500, c:c + 500].sum())
            if n > best:
                best, win = n, (r, c)
    r0, c0 = win
    Z = (slice(r0, r0 + 500), slice(c0, c0 + 500))
    ZS = (slice(r0 - ROW_OFF, r0 - ROW_OFF + 500), slice(c0 - COL_OFF, c0 - COL_OFF + 500))
    with rasterio.open(R / "L_aug31_sep12/sar-bihar-aug31-sep12-full_flood_class.tif") as s:
        tr = s.transform
    x0, y0 = tr * (c0, r0)
    from rasterio.warp import transform as wtransform
    lon, lat = wtransform("EPSG:32645", "EPSG:4326", [x0 + 20000], [y0 - 20000])
    numbers = {"zoom_window": {"row": r0, "col": c0, "size_km": 40,
                               "centre_lat": round(lat[0], 3), "centre_lon": round(lon[0], 3)}}

    def locator(ax):
        ax.add_patch(Rectangle((c0, r0), 500, 500, fill=False, ec="#dc2626", lw=1.0))

    # ---------- Figure A: the 7 stages on one 40 km window (L-band, 31 Aug -> 12 Sep)
    d_full = M["l0912"] - M["l0831"]
    stable = (M["l0831"] < -13) & (M["l0912"] < -13)
    fig, ax = plt.subplots(2, 4, figsize=(13, 7.0))
    ax = ax.ravel()
    show_db(ax[0], D["l0831"][Z], "Stage 2: 31 Aug in dB")
    show_db(ax[1], D["l0912"][Z], "Stage 2: 12 Sep in dB")
    show_db(ax[2], M["l0912"][Z], "Stage 3: 12 Sep after 3×3 median")
    show_delta(ax[3], d_full[Z], "Stage 4: change Δ = 12 Sep − 31 Aug")
    sw = np.where(np.isfinite(d_full[Z]), 1, 0).astype(np.uint8)
    sw[stable[Z]] = 2
    show_classes(ax[4], sw, "Stage 5: stable water (< −13 dB both dates)")
    st = np.where(np.isfinite(d_full[Z]), 1, 0).astype(np.uint8)
    st[(d_full[Z] < -2.5) & ~stable[Z]] = 4
    st[(d_full[Z] < -5.0) & ~stable[Z]] = 3
    show_classes(ax[5], st, "Stage 6: seeds (Δ < −5) and growth (−5 to −2.5)")
    show_classes(ax[6], class_codes(C["aug"][Z], ~np.isfinite(d_full[Z])), "Stage 7: engine classes")
    h = d_full[np.isfinite(d_full) & ~stable & l_valid]
    ax[7].hist(np.clip(h, -15, 15), bins=120, color="#a8a29e")
    ax[7].set_yscale("log")
    for v, col, lab in ((-5.0, HIGH, "seed −5.0"), (-3.26, INK, "Otsu −3.26"), (-2.5, MEDIUM, "growth −2.5")):
        ax[7].axvline(v, color=col, lw=1.2, ls="--" if lab.startswith("Otsu") else "-", label=lab)
    ax[7].legend(fontsize=7, frameon=False)
    ax[7].set_title("Change histogram, whole scene (log scale)", loc="left", fontsize=8.5)
    ax[7].set_xlabel("Δ (dB)")
    fig.suptitle(f"The 7 stages on one 40 km × 40 km window (centre {lat[0]:.2f}°N, {lon[0]:.2f}°E), L-band", x=0.02,
                 ha="left", fontsize=11)
    fig.legend(handles=[Patch(color=WATER, label="Stable water"), Patch(color=HIGH, label="Seed / high confidence"),
                        Patch(color=MEDIUM, label="Growth / medium confidence"), Patch(color=LOSS, label="Water loss"),
                        Patch(color=LAND, label="Non-water")], loc="lower center", ncol=5, frameon=False,
               bbox_to_anchor=(0.5, 0.035))
    footer(fig, "dB images: black −25 dB, white 0 dB. Change: blue = got darker (water came), red = got brighter. " + SOURCE)
    fig.subplots_adjust(left=0.02, right=0.99, top=0.9, bottom=0.11, wspace=0.06, hspace=0.18)
    fig.savefig(a.out / "walk_A_stages.png", dpi=170, facecolor="white")
    plt.close(fig)
    # Example pixels: for each class, the pixel of that class nearest the window centre
    rr, cc = np.mgrid[0:500, 0:500]
    dist = (rr - 250) ** 2 + (cc - 250) ** 2
    examples = {}
    for cls_code, name in ((2, "new_high"), (3, "new_medium"), (1, "stable_water"), (5, "water_loss"), (0, "land")):
        m = (C["aug"][Z] == cls_code) & np.isfinite(d_full[Z])
        if not m.any():
            continue
        i = np.argmin(np.where(m, dist, 10 ** 9))
        r, c = r0 + i // 500, c0 + i % 500
        x, y = tr * (c + 0.5, r + 0.5)
        lo, la = wtransform("EPSG:32645", "EPSG:4326", [x], [y])
        examples[name] = {"lat": round(la[0], 4), "lon": round(lo[0], 4), "class": cls_code,
                          "power_31aug": round(float(P["l0831"][r, c]), 4), "power_12sep": round(float(P["l0912"][r, c]), 4),
                          "db_31aug": round(float(D["l0831"][r, c]), 2), "db_12sep": round(float(D["l0912"][r, c]), 2),
                          "median_31aug": round(float(M["l0831"][r, c]), 2), "median_12sep": round(float(M["l0912"][r, c]), 2),
                          "delta": round(float(d_full[r, c]), 2)}
    numbers["example_pixels"] = examples
    numbers["otsu_db"] = {k: round(rep(rel)["method"]["raw_otsu_db"], 2) for k, rel in
                          (("l", "L_aug31_sep12/sar-bihar-aug31-sep12-full_flood.json"),
                           ("s", "S_aug31_sep12/sar-bihar-sband-aug31-sep12-full_flood.json"))}
    # Check: engine high-confidence pixels in the window should have Δ < -5 here too
    hi = C["aug"][Z] == 2
    numbers["stage_check"] = {"engine_high_conf_px_in_window": int(hi.sum()),
                              "share_with_recomputed_delta_below_minus5": round(float((d_full[Z][hi] < -5).mean()), 4)}

    # ---------- Figures B: one per pair
    pairs = [("B1_L_jul26_aug31", "l0726", "l0831", "jul", "L-band, 26 Jul → 31 Aug 2026", False),
             ("B2_L_aug31_sep12", "l0831", "l0912", "aug", "L-band, 31 Aug → 12 Sep 2026", False),
             ("B3_L_sep12_oct18", "l0912", "l1018", "oct", "L-band, 12 Sep → 18 Oct 2026", False),
             ("B4_S_aug31_sep12", "s0831", "s0912", "s", "S-band, 31 Aug → 12 Sep 2026", True)]
    numbers["pairs"] = {}
    for name, b, act, ck, title, is_s in pairs:
        dd = M[act] - M[b]
        z = ZS if is_s else Z
        outside = ~np.isfinite(dd)
        fig, ax = plt.subplots(2, 4, figsize=(13, 7.2))
        for row, sl in ((0, (slice(None), slice(None))), (1, z)):
            show_db(ax[row, 0], D[b][sl], f"Before: {LABEL[b]} (dB)")
            show_db(ax[row, 1], D[act][sl], f"After: {LABEL[act]} (dB)")
            show_delta(ax[row, 2], dd[sl], "Change Δ (dB)")
            show_classes(ax[row, 3], class_codes(C[ck][sl], outside[sl]), "Result classes")
        for c in range(4):
            if is_s:
                ax[0, c].add_patch(Rectangle((c0 - COL_OFF, r0 - ROW_OFF), 500, 500, fill=False, ec="#dc2626", lw=1.0))
            else:
                locator(ax[0, c])
        ax[0, 0].set_ylabel("Full scene")
        ax[1, 0].set_ylabel("40 km zoom (red box)")
        fig.suptitle(title, x=0.02, ha="left", fontsize=11.5)
        fig.legend(handles=CLASS_LEGEND, loc="lower center", ncol=5, frameon=False, bbox_to_anchor=(0.5, 0.035))
        footer(fig, "Change: blue = got darker (water came), red = got brighter (water left). " + SOURCE)
        fig.subplots_adjust(left=0.03, right=0.99, top=0.92, bottom=0.1, wspace=0.05, hspace=0.12)
        fig.savefig(a.out / f"walk_{name}.png", dpi=150, facecolor="white")
        plt.close(fig)
        ar = J[ck]
        numbers["pairs"][name] = {
            "stable_water_km2": round(ar["permanent_water_km2"], 2), "new_water_km2": round(ar["total_flood_km2"], 2),
            "new_high_km2": round(ar["new_inundation_high_km2"], 2), "new_medium_km2": round(ar["new_inundation_medium_km2"], 2),
            "water_loss_km2": round(ar["receded_water_km2"], 2),
            "water_before_km2": round(ar["permanent_water_km2"] + ar["receded_water_km2"], 2),
            "water_after_km2": round(ar["permanent_water_km2"] + ar["total_flood_km2"], 2),
            "zoom_new_water_km2": round(float(np.isin(C[ck][z], (2, 3)).sum()) * PX_KM2, 2),
            "zoom_loss_km2": round(float((C[ck][z] == 5).sum()) * PX_KM2, 2)}

    # ---------- Figure C: fusion, common grid
    lc = C["aug"][ROW_OFF:ROW_OFF + 4140, COL_OFF:COL_OFF + 4275]
    sc, fc = C["s"], C["f"]
    l_w, f_w = np.isin(lc, (1, 2, 3)), np.isin(fc, (1, 2, 3))
    with rasterio.open(R / "LS_fused_aug31_sep12/valid_support.tif") as s:
        sup = s.read(1).astype(bool)
    diff = np.where(sup, 1, 0).astype(np.uint8)
    diff[sup & l_w & f_w] = 2
    diff[sup & l_w & ~f_w] = 3
    diff[sup & ~l_w & f_w] = 4
    diff_cmap = ListedColormap([OUTSIDE, LAND, "#93c5fd", "#b45309", "#7c3aed"])
    zc = (slice(r0 - ROW_OFF, r0 - ROW_OFF + 500), slice(c0 - COL_OFF, c0 - COL_OFF + 500))
    fig, ax = plt.subplots(2, 4, figsize=(13, 7.2))
    for row, sl in ((0, (slice(None), slice(None))), (1, zc)):
        out = ~sup[sl]
        show_classes(ax[row, 0], class_codes(lc[sl], out), "L-band only")
        show_classes(ax[row, 1], class_codes(sc[sl], out), "S-band only")
        show_classes(ax[row, 2], class_codes(fc[sl], out), "L+S fused")
        ax[row, 3].imshow(diff[sl], cmap=diff_cmap, vmin=0, vmax=4, interpolation="nearest")
        ax[row, 3].set_title("Water on 12 Sep: L-band vs L+S", loc="left", fontsize=8.5)
        ax[row, 3].set_xticks([]), ax[row, 3].set_yticks([])
    for c in range(4):
        ax[0, c].add_patch(Rectangle((c0 - COL_OFF, r0 - ROW_OFF), 500, 500, fill=False, ec="#dc2626", lw=1.0))
    ax[0, 0].set_ylabel("Full common footprint")
    ax[1, 0].set_ylabel("40 km zoom (red box)")
    fig.suptitle("L+S fusion, 31 Aug → 12 Sep 2026, on the common L/S footprint", x=0.02, ha="left", fontsize=11.5)
    fig.legend(handles=CLASS_LEGEND + [Patch(color="#93c5fd", label="Water in L and in L+S"),
                                       Patch(color="#b45309", label="L water removed by fusion"),
                                       Patch(color="#7c3aed", label="Water added by fusion")],
               loc="lower center", ncol=4, frameon=False, bbox_to_anchor=(0.5, 0.025), fontsize=8)
    footer(fig, SOURCE, y=0.006)
    fig.subplots_adjust(left=0.03, right=0.99, top=0.92, bottom=0.13, wspace=0.05, hspace=0.12)
    fig.savefig(a.out / "walk_C_fusion.png", dpi=150, facecolor="white")
    plt.close(fig)
    numbers["fusion_vs_L_water_12sep"] = {
        "kept_km2": round(float((sup & l_w & f_w).sum()) * PX_KM2, 2),
        "removed_km2": round(float((sup & l_w & ~f_w).sum()) * PX_KM2, 2),
        "added_km2": round(float((sup & ~l_w & f_w).sum()) * PX_KM2, 2)}

    # ---------- Figure D and GIF: time-lapse of single-date dark water (median dB < -13 dB)
    dates = ["l0726", "l0831", "l0912", "l1018"]
    series, zoom_series = {}, {}
    frames = []
    fig, ax = plt.subplots(2, 4, figsize=(13, 7.0))
    for i, k in enumerate(dates):
        dark = (M[k] < -13) & l_valid
        series[LABEL[k]] = round(float(dark.sum()) * PX_KM2, 2)
        zoom_series[LABEL[k]] = round(float(dark[Z].sum()) * PX_KM2, 2)
        for row, sl in ((0, (slice(None), slice(None))), (1, Z)):
            show_db(ax[row, i], D[k][sl], f"{LABEL[k]} 2026: dark water {series[LABEL[k]]:,.0f} km²" if row == 0 else f"{LABEL[k]} 2026, zoom")
            ov = np.ma.masked_where(~dark[sl], np.ones(dark[sl].shape))
            ax[row, i].imshow(ov, cmap=ListedColormap([WATER]), vmin=0, vmax=1, alpha=0.85, interpolation="nearest")
        locator(ax[0, i])
        # GIF frame: zoom, upscaled, with label
        g = np.clip((D[k][Z] + 25) / 25, 0, 1)
        rgb = np.dstack([g, g, g])
        rgb[np.nan_to_num(g, nan=0) == 0] = 1
        rgb[dark[Z]] = (0.145, 0.388, 0.922)
        im = Image.fromarray((np.nan_to_num(rgb, nan=1) * 255).astype(np.uint8)).resize((700, 700), Image.NEAREST)
        canvas = Image.new("RGB", (700, 760), "white")
        canvas.paste(im, (0, 60))
        from PIL import ImageDraw
        dr = ImageDraw.Draw(canvas)
        dr.text((12, 10), f"L-band HH, {LABEL[k]} 2026  |  blue: dark water (< -13 dB)", fill=(28, 25, 23))
        dr.text((12, 32), f"40 km window centred {lat[0]:.2f}N {lon[0]:.2f}E  |  whole scene dark water: {series[LABEL[k]]:,.0f} km2",
                fill=(87, 83, 78))
        frames.append(canvas)
    fig.suptitle("Time-lapse, L-band: one picture per date, blue = darker than −13 dB after the median filter",
                 x=0.02, ha="left", fontsize=11)
    footer(fig, "Single-date dark-water areas over the footprint valid on all four dates. " + SOURCE)
    fig.subplots_adjust(left=0.02, right=0.99, top=0.9, bottom=0.06, wspace=0.05, hspace=0.12)
    fig.savefig(a.out / "walk_D_timelapse.png", dpi=150, facecolor="white")
    plt.close(fig)
    frames[0].save(a.out / "timelapse_L_band.gif", save_all=True, append_images=frames[1:], duration=1300, loop=0)

    fig, ax = plt.subplots(figsize=(6.4, 3.0))
    xs = list(series)
    ax.plot(xs, list(series.values()), color=WATER, lw=2, marker="o", ms=8)
    for x, y in series.items():
        ax.annotate(f"{y:,.0f} km²\n({acres(y):,} ac)", (x, y), textcoords="offset points", xytext=(0, 9),
                    ha="center", fontsize=7.5)
    ax.set_ylim(0, max(series.values()) * 1.3)
    ax.set_ylabel("km²")
    ax.spines[["top", "right"]].set_visible(False)
    ax.yaxis.grid(True, color="#e7e5e4")
    ax.set_title("L-band dark water (< −13 dB) on each date, same footprint", loc="left", fontsize=9.5)
    fig.tight_layout()
    fig.savefig(a.out / "walk_E_dark_water_series.png", dpi=170, facecolor="white")
    plt.close(fig)
    numbers["dark_water_series_km2"] = series
    numbers["dark_water_zoom_window_km2"] = zoom_series
    numbers["dark_water_outside_zoom_km2"] = {d: round(series[d] - zoom_series[d], 2) for d in series}
    numbers["dark_water_footprint_km2"] = round(float(l_valid.sum()) * PX_KM2, 2)
    numbers["fused_common_footprint"] = {k: fused[k] for k in ("l_band_only", "s_band_only", "ls_fused")}
    (a.out / "walkthrough_numbers.json").write_text(json.dumps(numbers, indent=1) + "\n")
    print(json.dumps({k: v for k, v in numbers.items() if k != "fused_common_footprint"}, indent=1))


if __name__ == "__main__":
    main()
