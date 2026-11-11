"""Pictures for the intro video, drawn from the real package results.

Writes into video/public/:
  hero.png            L+S class map, 31 Aug -> 12 Sep 2026, 16:9 crop of the Ganga band
  L.png, S.png, LS.png   same 40 km window in each map (L-band, S-band, L+S)
  season0..3.png      L-band dark water (< -13 dB), 26 Jul / 31 Aug / 12 Sep / 18 Oct 2026
                      (frames of ingarss_2026/explainer/timelapse_L_band.gif, title strip cut off)

Colours: stable water cyan, new water orange/amber, water loss teal, land navy.
"""
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.warp import transform

ROOT = Path(__file__).resolve().parents[2]
PKG = ROOT / "ingarss_2026"
OUT = ROOT / "video" / "public"
OUT.mkdir(parents=True, exist_ok=True)

PAL = {0: (19, 35, 59), 1: (56, 189, 248), 2: (249, 115, 22), 3: (251, 191, 36), 5: (45, 212, 191)}
BG = (9, 15, 28)


def read(path):
    with rasterio.open(path) as f:
        return f.read(1), f.transform


fused, ftr = read(PKG / "results/LS_fused_aug31_sep12/sar-bihar-ls-fused-aug31-sep12_class.tif")
valid, _ = read(PKG / "results/LS_fused_aug31_sep12/valid_support.tif")
valid = valid > 0
s_cls, s_tr = read(PKG / "results/S_aug31_sep12/sar-bihar-sband-aug31-sep12-full_flood_class.tif")
l_full, l_tr = read(PKG / "results/L_aug31_sep12/sar-bihar-aug31-sep12-full_flood_class.tif")

# The S/fused grid sits inside the L grid on the same 80 m lattice.
assert s_tr == ftr
dc = round((ftr.c - l_tr.c) / 80.0)
dr = round((l_tr.f - ftr.f) / 80.0)
l_cls = l_full[dr:dr + fused.shape[0], dc:dc + fused.shape[1]]
assert l_cls.shape == fused.shape


def rgb(cls):
    out = np.zeros(cls.shape + (3,), np.uint8)
    out[:] = BG
    for k, c in PAL.items():
        out[(cls == k) & valid] = c
    return out


Image.fromarray(rgb(fused)[640:2418, 420:3580]).resize((1920, 1080), Image.LANCZOS).save(OUT / "hero.png")

# 40 km window centred 25.35 N 86.78 E (the same window as the time-lapse).
xs, ys = transform("EPSG:4326", "EPSG:32645", [86.78], [25.35])
col = int((xs[0] - ftr.c) / 80.0)
row = int((ftr.f - ys[0]) / 80.0)
h = 250  # 250 px * 80 m = 20 km each side
for name, cls in (("L", l_cls), ("S", s_cls), ("LS", fused)):
    win = rgb(cls)[row - h:row + h, col - h:col + h]
    Image.fromarray(win).resize((800, 800), Image.NEAREST).save(OUT / f"{name}.png")

gif = Image.open(PKG / "explainer/timelapse_L_band.gif")
for i in range(gif.n_frames):
    gif.seek(i)
    gif.convert("RGB").crop((0, 60, 700, 760)).save(OUT / f"season{i}.png")

print("assets written to", OUT)
