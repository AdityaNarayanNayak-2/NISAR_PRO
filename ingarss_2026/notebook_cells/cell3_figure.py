import matplotlib.pyplot as plt
import matplotlib.image as mpimg
from matplotlib.patches import Rectangle, Patch
from pathlib import Path

def resolve_img_path(json_rel_path, fallback_names):
    """Resolves image path whether stored in current folder, ./results/, or repo root."""
    raw_name = Path(json_rel_path).name
    candidates = [
        Path(json_rel_path),
        Path(raw_name),
        Path("results") / raw_name,
        Path("results/flood_expansion_aug31_sep12") / raw_name,
        Path("../results") / raw_name,
        Path("../results/flood_expansion_aug31_sep12") / raw_name,
        Path("../../results") / raw_name,
        Path("../../results/flood_expansion_aug31_sep12") / raw_name,
        Path("../../ingarss_2026/results/flood_expansion_aug31_sep12") / raw_name,
    ]
    for n in fallback_names:
        candidates.extend([
            Path(n),
            Path("results") / n,
            Path("results/flood_expansion_aug31_sep12") / n,
            Path("../results") / n,
            Path("../results/flood_expansion_aug31_sep12") / n,
            Path("../../results") / n,
            Path("../../results/flood_expansion_aug31_sep12") / n,
            Path("../../ingarss_2026/results/flood_expansion_aug31_sep12") / n,
        ])
    for c in candidates:
        if c.exists():
            return c

    # Robust fallback: recursively find any matching file by name
    search_names = [raw_name] + [n for n in fallback_names if n != raw_name]
    for n in search_names:
        for base in [Path("."), Path(".."), Path("../..")]:
            if base.exists():
                found = list(base.glob(f"**/{n}"))
                if found:
                    return found[0]

    raise FileNotFoundError(f"Could not find image among: {[str(c) for c in candidates]}")

baseline_img_path = resolve_img_path(
    replay["baseline_preview"],
    ["sar-bihar-aug31-sep12-full_flood_baseline.png", "sar-bihar-aug31-sep12-full_flood_flood_baseline.png"]
)
active_img_path = resolve_img_path(
    replay["active_preview"],
    ["sar-bihar-aug31-sep12-full_flood_active.png", "sar-bihar-aug31-sep12-full_flood_flood_active.png"]
)
mask_img_path = resolve_img_path(
    replay["mask_preview"],
    ["sar-bihar-aug31-sep12-full_flood.png", "sar-bihar-aug31-sep12-full_flood_flood.png", "sar-bihar-aug31-sep12-full_flood.jpg"]
)

img_base = mpimg.imread(baseline_img_path)
img_act = mpimg.imread(active_img_path)
img_mask = mpimg.imread(mask_img_path)

# Geographic extent [west, east, south, north] for EPSG:4326 axis ticks
extent = [bbox["west"], bbox["east"], bbox["south"], bbox["north"]]

# Official InGARSS 20x20 km Reference Discovery Box (86.3946E, 25.4098N to 86.6054E, 25.5902N)
ref_box = (86.3946, 25.4098, 86.6054 - 86.3946, 25.5902 - 25.4098)

plt.rcParams["figure.facecolor"] = "#0b0f17"
plt.rcParams["axes.facecolor"] = "#0b0f17"
plt.rcParams["text.color"] = "#e2e8f0"
plt.rcParams["axes.labelcolor"] = "#94a3b8"
plt.rcParams["xtick.color"] = "#94a3b8"
plt.rcParams["ytick.color"] = "#94a3b8"

fig, axes = plt.subplots(1, 3, figsize=(21, 7.5), dpi=180, sharex=True, sharey=True)

panels = [
    (axes[0], img_base, "gray", "Panel 1: Baseline L-Band HH (31 Aug 2026)\nTrack 098, Frame 014 (Asc) · 80 m Grid"),
    (axes[1], img_act, "gray", "Panel 2: Peak Monsoon Active L-Band HH (12 Sep 2026)\nSpecular Darkening Along Ganga–Kosi Floodplain"),
    (axes[2], img_mask, None, f"Panel 3: 5-Class Surface-Water Change Map\nWater Gain: {areas['total_flood_km2']:,.1f} km² | Loss: {areas['receded_water_km2']:,.1f} km²"),
]

for ax, img, cmap, title in panels:
    if cmap and img.ndim == 2:
        ax.imshow(img, cmap=cmap, extent=extent, origin="upper", interpolation="nearest")
    else:
        ax.imshow(img, extent=extent, origin="upper", interpolation="nearest")

    # Overlay the 20x20 km InGARSS Reference Box for visual orientation
    rect = Rectangle(
        (ref_box[0], ref_box[1]), ref_box[2], ref_box[3],
        linewidth=1.3, edgecolor="#00ffff", facecolor="none",
        linestyle="--", label="20×20 km Ref AOI"
    )
    ax.add_patch(rect)

    ax.set_title(title, fontsize=11, fontweight="bold", pad=10, color="#f8fafc")
    ax.set_xlabel("Longitude (°E) [WGS84 / EPSG:32645]", fontsize=9.5)
    ax.grid(color="#1e293b", linestyle=":", linewidth=0.6, alpha=0.6)
    for spine in ax.spines.values():
        spine.set_edgecolor("#334155")

axes[0].set_ylabel("Latitude (°N)", fontsize=9.5)

# Custom Legend for the 5-Class Map + Reference AOI
legend_elements = [
    Patch(facecolor="#2166c1", edgecolor="none", label=f"Class 1: Stable Water ({areas['permanent_water_km2']:,.0f} km²)"),
    Patch(facecolor="#e11d48", edgecolor="none", label=f"Class 2: High-Conf Water Gain ({areas['new_inundation_high_km2']:,.0f} km²)"),
    Patch(facecolor="#00a6c7", edgecolor="none", label=f"Class 3: Med-Conf Water Gain ({areas['new_inundation_medium_km2']:,.0f} km²)"),
    Patch(facecolor="#f59e0b", edgecolor="none", label=f"Class 5: Water Loss / Receded ({areas['receded_water_km2']:,.0f} km²)"),
    Patch(facecolor="#0b0f17", edgecolor="#475569", label=f"Class 0: Stable Non-Water ({areas['stable_non_water_km2']:,.0f} km²)"),
    Patch(facecolor="none", edgecolor="#00ffff", linestyle="--", label="InGARSS 20×20 km Reference Box (25.5°N, 86.5°E)"),
]

fig.legend(
    handles=legend_elements,
    loc="lower center",
    ncol=3,
    frameon=True,
    facecolor="#111827",
    edgecolor="#334155",
    fontsize=9.5,
    bbox_to_anchor=(0.5, -0.04)
)

plt.suptitle(
    "NISAR L2 GCOV Full-Scene Surface-Water Dynamics — Ganga Alluvial Plain, Bihar (1.157B Pixels)",
    fontsize=14, fontweight="bold", color="#38bdf8", y=0.98
)
plt.tight_layout(rect=[0, 0.06, 1, 0.94])
plt.savefig("bihar_full_scene_3panel.png", dpi=200, bbox_inches="tight", facecolor="#0b0f17")
plt.show()
