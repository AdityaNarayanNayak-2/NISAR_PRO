import matplotlib.pyplot as plt
import numpy as np

# Comparative Bar Chart: Phase 1 (Monsoon Expansion) vs Phase 2 (Post-Monsoon Recession)
phases = [
    "Phase 1: Peak Monsoon Expansion\n(31 Aug 2026 → 12 Sep 2026)",
    "Phase 2: Post-Monsoon Recession\n(12 Sep 2026 → 18 Oct 2026)"
]

# Phase 1 from loaded JSON (1,173.56 km² gain, 943.25 km² loss)
# Phase 2 from Oct 18 recession analysis (243.40 km² gain, 2,650.27 km² loss)
water_gain_km2 = [areas["total_flood_km2"], 243.40]
water_loss_km2 = [areas["receded_water_km2"], 2650.27]
net_change_km2 = [g - l for g, l in zip(water_gain_km2, water_loss_km2)]

x = np.arange(len(phases))
width = 0.32

fig, ax = plt.subplots(figsize=(10.5, 5.5), dpi=160)

rects_gain = ax.bar(
    x - width/2, water_gain_km2, width,
    label="Newly Detected Water / Water Gain (Classes 2–4)",
    color="#00b4d8", edgecolor="#90e0ef", linewidth=1.0
)
rects_loss = ax.bar(
    x + width/2, water_loss_km2, width,
    label="Receded Water / Water Loss (Class 5)",
    color="#f59e0b", edgecolor="#fde68a", linewidth=1.0
)

# Annotate exact km² and Acreage values on top of bars
for rect in rects_gain:
    h = rect.get_height()
    ac = h / 0.004046856
    ax.annotate(
        f"+{h:,.1f} km²\n({ac:,.0f} ac)",
        xy=(rect.get_x() + rect.get_width() / 2, h),
        xytext=(0, 6), textcoords="offset points",
        ha="center", va="bottom", fontsize=9.5, fontweight="bold", color="#38bdf8"
    )

for rect in rects_loss:
    h = rect.get_height()
    ac = h / 0.004046856
    ax.annotate(
        f"−{h:,.1f} km²\n({ac:,.0f} ac)",
        xy=(rect.get_x() + rect.get_width() / 2, h),
        xytext=(0, 6), textcoords="offset points",
        ha="center", va="bottom", fontsize=9.5, fontweight="bold", color="#fbbf24"
    )

ax.set_ylabel("Surface-Water Transition Area (km²)", fontsize=10.5, fontweight="bold")
ax.set_title("Two-Phase Monsoon Surface-Water Lifecycle Across the Bihar Ganga Swath (Track 098, Frame 014)", fontsize=12, fontweight="bold", color="#f8fafc", pad=15)
ax.set_xticks(x)
ax.set_xticklabels(phases, fontsize=10.5, fontweight="bold", color="#e2e8f0")
ax.set_ylim(0, max(water_loss_km2) * 1.25)
ax.grid(axis="y", color="#1e293b", linestyle="--", linewidth=0.8)
ax.legend(frameon=True, facecolor="#111827", edgecolor="#334155", fontsize=10, loc="upper left")

for spine in ["top", "right"]:
    ax.spines[spine].set_visible(False)
for spine in ["bottom", "left"]:
    ax.spines[spine].set_edgecolor("#475569")

plt.tight_layout()
plt.savefig("bihar_2phase_flood_lifecycle.png", dpi=200, bbox_inches="tight", facecolor="#0b0f17")
plt.show()
