#!/usr/bin/env python3
"""Draw the submission maps and the validation chart from packaged results."""

import argparse
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import rasterio
from matplotlib.colors import ListedColormap
from matplotlib.patches import Patch, Polygon
from rasterio.warp import transform
from rasterio.windows import from_bounds

OUTSIDE, LAND = "#ffffff", "#e7e5e4"
WATER, HIGH, MEDIUM, LOSS = "#2563eb", "#dc2626", "#f59e0b", "#0d9488"
INK, MUTED = "#1c1917", "#57534e"
SOURCE = ("CRS EPSG:32645 (UTM 45N)  |  80 m grid  |  Source: NISAR L2 GCOV, "
          "LSAR via ASF DAAC, SSAR via Bhoonidhi (NRSC/ISRO)  |  Dashed box: 20 km reference box")
BOX = [(86.3946, 25.4098), (86.6054, 25.4098), (86.6054, 25.5902), (86.3946, 25.5902)]
ACRES = 1 / 0.004046856

plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9, "text.color": INK,
                     "axes.labelcolor": MUTED, "xtick.color": MUTED, "ytick.color": MUTED,
                     "axes.edgecolor": "#a8a29e", "axes.linewidth": 0.6})


class Scene:
    def __init__(self, results):
        self.r = results
        with rasterio.open(results / "LS_fused_aug31_sep12/valid_support.tif") as s:
            self.support = s.read(1).astype(bool)
            self.bounds = s.bounds
        x, y = transform("EPSG:4326", "EPSG:32645", *zip(*BOX))
        self.box = list(zip(np.array(x) / 1000, np.array(y) / 1000))
        b = self.bounds
        self.extent = (b.left / 1000, b.right / 1000, b.bottom / 1000, b.top / 1000)

    def classes(self, rel):
        with rasterio.open(self.r / rel) as src:
            w = from_bounds(*self.bounds, transform=src.transform).round_offsets().round_lengths()
            return src.read(1, window=w)

    def draw(self, ax, codes, title, colors):
        """codes: 0 outside footprint, 1 land, 2.. the given colors."""
        cmap = ListedColormap([OUTSIDE, LAND] + colors)
        ax.imshow(codes, cmap=cmap, vmin=0, vmax=1 + len(colors), extent=self.extent,
                  interpolation="nearest")
        ax.add_patch(Polygon(self.box, closed=True, fill=False, ec=INK, ls="--", lw=0.9))
        ax.set_title(title, fontsize=9.5, loc="left", pad=6)
        ax.set_xlabel("Easting (km)")
        ax.tick_params(length=2, labelsize=7.5)


def change_codes(scene, c):
    out = np.where(scene.support, 1, 0).astype(np.uint8)
    for cls, code in ((1, 2), (2, 3), (3, 4), (5, 5)):
        out[scene.support & (c == cls)] = code
    return out


def finish(fig, handles, ncol, path):
    fig.legend(handles=handles, loc="lower center", ncol=ncol, frameon=False,
               bbox_to_anchor=(0.5, 0.045), fontsize=8.5, handlelength=1.1)
    fig.text(0.5, 0.012, SOURCE, ha="center", fontsize=7.2, color=MUTED)
    fig.savefig(path, dpi=220, facecolor="white")
    plt.close(fig)
    print("wrote", path)


def area(km2):
    return f"{km2:,.2f} km² ({km2 * ACRES:,.0f} ac)"


CHANGE_LEGEND = [Patch(color=WATER, label="Stable water"), Patch(color=HIGH, label="New water, high confidence"),
                 Patch(color=MEDIUM, label="New water, medium confidence"), Patch(color=LOSS, label="Water loss"),
                 Patch(color=LAND, label="Stable non-water")]


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--results", required=True, type=Path)
    p.add_argument("--out", required=True, type=Path)
    a = p.parse_args()
    a.out.mkdir(parents=True, exist_ok=True)
    s = Scene(a.results)
    maps = {"L-band only": s.classes("L_aug31_sep12/sar-bihar-aug31-sep12-full_flood_class.tif"),
            "S-band only": s.classes("S_aug31_sep12/sar-bihar-sband-aug31-sep12-full_flood_class.tif"),
            "L+S fused": s.classes("LS_fused_aug31_sep12/sar-bihar-ls-fused-aug31-sep12_class.tif")}
    fused = json.loads((a.results / "LS_fused_aug31_sep12/sar-bihar-ls-fused-aug31-sep12_flood.json").read_text())
    comp = fused["full_scene_comparison"]
    keys = {"L-band only": "l_band_only", "S-band only": "s_band_only", "L+S fused": "ls_fused"}
    diag = json.loads((a.results / "LS_fused_aug31_sep12/fusion_diagnostics.json").read_text())
    dkeys = {"L-band only": "l_only", "S-band only": "s_only", "L+S fused": "fused"}

    # Figure 0: study area, analysed footprint and reference box
    fig, ax = plt.subplots(figsize=(8.2, 7.6))
    codes = np.where(s.support, 1, 0).astype(np.uint8)
    codes[s.support & (maps["L+S fused"] == 1)] = 2
    s.draw(ax, codes, "Study area: NISAR track 98, frame 14, ascending, Bihar (India)\n"
           f"Analysed footprint {area(comp['ls_fused']['total_valid_km2'])}, not clipped to the reference box",
           [WATER])
    x0, x1, y0, y1 = s.extent
    for lat in np.arange(24.0, 27.51, 0.5):
        lons = np.linspace(84.0, 89.0, 200)
        xs, ys = transform("EPSG:4326", "EPSG:32645", lons, [lat] * len(lons))
        ax.plot(np.array(xs) / 1000, np.array(ys) / 1000, color="#a8a29e", lw=0.4, zorder=1)
        ly = np.interp(x0 * 1000 + 2000, xs, ys) / 1000 + 1.5
        if y0 + 5 < ly < y1 - 5:
            ax.text(x0 + 2, ly, f"{lat:.1f}°N", fontsize=6.8, color=MUTED)
    for lon in np.arange(84.5, 89.01, 0.5):
        lats = np.linspace(23.0, 28.0, 200)
        xs, ys = transform("EPSG:4326", "EPSG:32645", [lon] * len(lats), lats)
        ax.plot(np.array(xs) / 1000, np.array(ys) / 1000, color="#a8a29e", lw=0.4, zorder=1)
        lx = np.interp(y0 * 1000 + 2000, ys, xs) / 1000 + 1.5
        if x0 + 5 < lx < x1 - 20:
            ax.text(lx, y0 + 2, f"{lon:.1f}°E", fontsize=6.8, color=MUTED)
    cx, cy = transform("EPSG:4326", "EPSG:32645", [86.5], [25.5])
    ax.plot(cx[0] / 1000, cy[0] / 1000, marker="+", color=INK, ms=9, mew=1.4)
    ax.annotate("Reference centre\n25.5°N, 86.5°E", (cx[0] / 1000, cy[0] / 1000), xytext=(30, 40),
                textcoords="offset points", fontsize=8,
                bbox=dict(boxstyle="round,pad=0.25", fc="white", ec="#a8a29e", lw=0.5),
                arrowprops=dict(arrowstyle="-", color=INK, lw=0.6))
    ax.set_xlim(x0, x1)
    ax.set_ylim(y0, y1)
    ax.set_ylabel("Northing (km)")
    fig.text(0.09, 0.098, "Dates: L-band 26 Jul, 31 Aug, 12 Sep, 18 Oct 2026; S-band 31 Aug, 12 Sep 2026. "
             "Blue: stable water 31 Aug and 12 Sep (L+S).\n"
             "White squares inside the footprint: 6.5 km cut around small no-data spots (same 40-pixel rule as the swath edge).",
             fontsize=7.6, color=MUTED)
    fig.subplots_adjust(left=0.1, right=0.97, top=0.9, bottom=0.19)
    finish(fig, [Patch(color=LAND, label="Analysed footprint"), Patch(color=WATER, label="Stable water (L+S)"),
                 Patch(fill=False, ec=INK, ls="--", label="20 km reference box")], 3,
           a.out / "fig0_aoi_and_footprint.png")

    # Figure 1: change maps
    fig, axes = plt.subplots(1, 3, figsize=(13, 5.5), sharey=True)
    for ax, (name, c) in zip(axes, maps.items()):
        s.draw(ax, change_codes(s, c), f"{name}\nNew water {area(comp[keys[name]]['total_flood_km2'])}",
               [WATER, HIGH, MEDIUM, LOSS])
    axes[0].set_ylabel("Northing (km)")
    fig.suptitle("Surface-water change, 31 Aug to 12 Sep 2026 (Track 98, Frame 14, ascending)", x=0.05, ha="left", fontsize=11.5)
    fig.subplots_adjust(left=0.05, right=0.99, top=0.84, bottom=0.17, wspace=0.05)
    finish(fig, CHANGE_LEGEND, 5, a.out / "fig1_change_maps_aug31_sep12.png")

    # Figure 2: water masks on the later date
    fig, axes = plt.subplots(1, 3, figsize=(13, 5.5), sharey=True)
    for ax, (name, c) in zip(axes, maps.items()):
        codes = np.where(s.support, 1, 0).astype(np.uint8)
        codes[s.support & np.isin(c, (1, 2, 3))] = 2
        s.draw(ax, codes, f"{name}\nWater {area(diag['water_area_per_date'][dkeys[name]]['water_date2']['km2'])}", [WATER])
    axes[0].set_ylabel("Northing (km)")
    fig.suptitle("Water masks, 12 Sep 2026", x=0.05, ha="left", fontsize=11.5)
    fig.subplots_adjust(left=0.05, right=0.99, top=0.84, bottom=0.17, wspace=0.05)
    finish(fig, [Patch(color=WATER, label="Water"), Patch(color=LAND, label="Non-water")], 2,
           a.out / "fig2_water_masks_sep12.png")

    # Figure 3: newly detected water, fused
    fig, ax = plt.subplots(figsize=(8.2, 8.2))
    c = maps["L+S fused"]
    codes = np.where(s.support, 1, 0).astype(np.uint8)
    codes[s.support & (c == 1)] = 2
    codes[s.support & (c == 2)] = 3
    codes[s.support & (c == 3)] = 4
    s.draw(ax, codes, f"Fused L+S newly detected water, 31 Aug to 12 Sep 2026\n{area(comp['ls_fused']['total_flood_km2'])}. "
           "Cause not established by SAR alone.", ["#93c5fd", HIGH, MEDIUM])
    ax.set_ylabel("Northing (km)")
    fig.subplots_adjust(left=0.09, right=0.98, top=0.93, bottom=0.13)
    finish(fig, [Patch(color="#93c5fd", label="Stable water"), Patch(color=HIGH, label="New water, high confidence"),
                 Patch(color=MEDIUM, label="New water, medium confidence"), Patch(color=LAND, label="Stable non-water")], 4,
           a.out / "fig3_newly_detected_water_fused.png")

    # Figure 4: L-band lifecycle at one edge-erosion setting
    stages = [("26 Jul to 31 Aug", "L_jul26_aug31/sar-bihar-jul26-aug31-progression"),
              ("31 Aug to 12 Sep", "L_aug31_sep12/sar-bihar-aug31-sep12-full"),
              ("12 Sep to 18 Oct", "L_sep12_oct18/sar-bihar-sep12-oct18-recession-erosion40")]
    fig, axes = plt.subplots(1, 3, figsize=(13, 5.5), sharey=True)
    for ax, (name, stem) in zip(axes, stages):
        ar = json.loads((a.results / f"{stem}_flood.json").read_text())["areas"]
        s.draw(ax, change_codes(s, s.classes(f"{stem}_flood_class.tif")),
               f"{name}\nGain {ar['total_flood_km2']:,.0f} km² ({ar['total_flood_acres']:,.0f} ac), "
               f"loss {ar['receded_water_km2']:,.0f} km² ({ar['receded_water_acres']:,.0f} ac)", [WATER, HIGH, MEDIUM, LOSS])
    axes[0].set_ylabel("Northing (km)")
    fig.suptitle("L-band water lifecycle, 2026 (full-scene areas, 40-pixel edge erosion)", x=0.05, ha="left", fontsize=11.5)
    fig.subplots_adjust(left=0.05, right=0.99, top=0.84, bottom=0.17, wspace=0.05)
    finish(fig, CHANGE_LEGEND, 5, a.out / "fig4_l_band_lifecycle.png")

    # Figure 5: agreement with Sentinel-2
    v = json.loads((a.results / "validation/sentinel2_validation.json").read_text())["tests"]
    tests = [("water_31aug", "Water, 31 Aug"), ("water_12sep", "Water, 12 Sep"), ("gain_31aug_to_12sep", "New water, 31 Aug to 12 Sep")]
    fig, ax = plt.subplots(figsize=(7.2, 3.8))
    series = [("l_only", "L-band only", WATER), ("s_only", "S-band only", HIGH), ("fused", "L+S fused", MEDIUM)]
    width = 0.26
    for i, (k, label, color) in enumerate(series):
        vals = [v[t]["results"]["ndwi_0.0"][k]["f1"] for t, _ in tests]
        xs = np.arange(len(tests)) + (i - 1) * (width + 0.015)
        ax.bar(xs, vals, width, color=color, label=label)
        for x, val in zip(xs, vals):
            ax.text(x, val + 0.012, f"{val:.3f}", ha="center", fontsize=7.8)
    ax.set_xticks(range(len(tests)), [t[1] for t in tests])
    ax.set_ylim(0, 1)
    ax.set_ylabel("F1 against Sentinel-2 NDWI ≥ 0")
    ax.spines[["top", "right"]].set_visible(False)
    ax.yaxis.grid(True, color="#e7e5e4", lw=0.6)
    ax.set_axisbelow(True)
    fig.text(0.09, 0.94, "Agreement with cloud-free Sentinel-2 pixels", fontsize=10.5)
    fig.legend(*ax.get_legend_handles_labels(), frameon=False, ncol=3, loc="upper left", bbox_to_anchor=(0.08, 0.93), fontsize=8)
    fig.text(0.01, 0.01, "Optical labels cannot see water under vegetation. Agreement, not ground truth.", fontsize=7.2, color=MUTED)
    fig.subplots_adjust(left=0.09, right=0.99, top=0.84, bottom=0.14)
    fig.savefig(a.out / "fig5_sentinel2_agreement.png", dpi=220, facecolor="white")
    print("wrote fig5")


if __name__ == "__main__":
    main()
