from pathlib import Path
import json
import matplotlib.pyplot as plt

comparison_candidates = [
    Path("sar-bihar-ls-fused-aug31-sep12_flood.json"),
    Path("ingarss_2026/sar-bihar-ls-fused-aug31-sep12_flood.json"),
    Path("../sar-bihar-ls-fused-aug31-sep12_flood.json"),
]
comparison_path = next((path for path in comparison_candidates if path.exists()), None)
if comparison_path is None:
    raise FileNotFoundError(
        "Place sar-bihar-ls-fused-aug31-sep12_flood.json beside the notebook "
        "or under ingarss_2026/."
    )

with comparison_path.open("r", encoding="utf-8") as handle:
    comparison = json.load(handle)

full_scene = comparison["full_scene_comparison"]
labels = ["L-only", "S-only", "L+S"]
keys = ["l_band_only", "s_band_only", "ls_fused"]
gain = [full_scene[key]["total_flood_km2"] for key in keys]
loss = [full_scene[key]["receded_water_km2"] for key in keys]

print("Mapped water gain (km²):", dict(zip(labels, gain)))
print("Mapped water loss (km²):", dict(zip(labels, loss)))

fig, ax = plt.subplots(figsize=(8, 4.5), dpi=140)
x = range(len(labels))
ax.bar([i - 0.18 for i in x], gain, width=0.36, label="Gain", color="#e11d48")
ax.bar([i + 0.18 for i in x], loss, width=0.36, label="Receded", color="#f59e0b")
ax.set_xticks(list(x), labels)
ax.set_ylabel("Mapped transition area (km²)")
ax.set_title("Full-scene comparison: Aug 31 → Sep 12")
ax.legend()
ax.grid(axis="y", alpha=0.2)
plt.tight_layout()
plt.show()
