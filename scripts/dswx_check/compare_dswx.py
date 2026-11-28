#!/usr/bin/env python3
"""Board #4: score NISAR Pro water maps for 12 Sep 2026 against NASA OPERA DSWx-S1 (same day).

Maps scored (water on the later date = classes 1, 2, 3, 4 of a class GeoTIFF):
  - Sentinel-1 VV, 31 Aug -> 12 Sep (our engine on the S1D RTC pair, $DSWX_DIR/s1run, see README)
  - NISAR L-band HH, 31 Aug -> 12 Sep (gateway run-8fc6be56, the package reference run)
  - NISAR S-band HH, 31 Aug -> 12 Sep (gateway run-cbdd2efd)
Reference: DSWx-S1 B01_WTR tiles from the 12 Sep 00:11 UTC Sentinel-1D pass, 30 m, put on each
map's 80 m grid by majority (water fraction >= 0.5 of valid 30 m cells; cell valid if >= 0.5 valid).
All three maps are scored on the same pixels: valid in DSWx, inside the S1 footprint (eroded 40 px
like the runs) and inside the common NISAR L/S support (ingarss_2026 valid_support.tif, read only).

DSWx-S1 is a model product made from the same Sentinel-1 pass, not ground truth. For the Sentinel-1
map this is agreement between two methods on the same data; for NISAR it is a second sensor about
23.5 h later (NISAR 23:38 UTC vs S1D 00:11 UTC). Report as agreement, never accuracy.
Writes dswx_s1_agreement.json next to this script.
"""
import glob, json, os, re, sys
import numpy as np, rasterio
from rasterio.enums import Resampling
from rasterio.warp import reproject

HERE = os.environ.get('DSWX_DIR', os.path.expanduser('~/Desktop/nisar_data/dswx_s1')); os.makedirs(HERE, exist_ok=True)
REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
S1_DIR = os.path.expanduser('~/Desktop/nisar_data/sentinel1')
MAPS = {
    'sentinel1_vv': f'{HERE}/s1run/s1_flood_class.tif',
    'nisar_l_hh': f'{REPO}/sar-gateway/results/jobs/run-8fc6be56/run-8fc6be56_flood_class.tif',
    'nisar_s_hh': f'{REPO}/sar-gateway/results/jobs/run-cbdd2efd/run-cbdd2efd_flood_class.tif',
}
SUPPORT = f'{REPO}/ingarss_2026/results/LS_fused_aug31_sep12/valid_support.tif'
WATER_NOW = (1, 2, 3, 4)
ACRE_KM2 = 0.004046856

tiles = sorted(f for f in glob.glob(f'{HERE}/*_B01_WTR.tif') if re.search(r'_20260912T0011\d\dZ_', f))
if not tiles: sys.exit('No 12 Sep 00:11 DSWx-S1 WTR tiles here. Run get_dswx.sh first.')

# --- what the WTR codes are: print them, refuse unknown ones
codes = {}
for t in tiles:
    with rasterio.open(t) as s:
        v, c = np.unique(s.read(1), return_counts=True)
        for a, b in zip(v, c): codes[int(a)] = codes.get(int(a), 0) + int(b)
        if t == tiles[0]:
            try: cmap = s.colormap(1)
            except Exception: cmap = None
            print('tags:', {k: v for k, v in s.tags().items() if 'WTR' in k.upper() or 'CLASS' in k.upper() or 'VALUE' in k.upper()})
print('DSWx-S1 WTR codes (pixel counts):', codes)
WATER = {1: 'open water', 3: 'inundated vegetation'}   # DSWx-S1 product spec
NOTWATER = {0: 'not water'}
known = set(WATER) | set(NOTWATER) | set(range(250, 256))
if set(codes) - known: sys.exit(f'Unknown WTR codes {sorted(set(codes) - known)}: check the DSWx-S1 product spec first.')


def on_grid(grid, fn):
    """Average of fn(DSWx tile) on the 80 m grid, NaN where no tile covers."""
    acc = np.zeros(grid['shape'], np.float32); cov = np.zeros(grid['shape'], np.float32)
    for t in tiles:
        with rasterio.open(t) as s:
            src = fn(s.read(1)).astype(np.float32)
            dst = np.full(grid['shape'], np.nan, np.float32)
            reproject(src, dst, src_transform=s.transform, src_crs=s.crs, dst_transform=grid['transform'], dst_crs=grid['crs'],
                      resampling=Resampling.average, src_nodata=np.nan, dst_nodata=np.nan)
            m = ~np.isnan(dst) & (cov == 0); acc[m] = dst[m]; cov[m] = 1
    acc[cov == 0] = np.nan
    return acc


def read_to(path, grid, resampling=Resampling.nearest, fill=0):
    with rasterio.open(path) as s:
        dst = np.full(grid['shape'], fill, np.float32)
        reproject(rasterio.band(s, 1), dst, dst_transform=grid['transform'], dst_crs=grid['crs'], resampling=resampling, dst_nodata=fill)
    return dst


def erode(valid, r):
    bad = (~valid).astype(np.int32)
    for axis in (0, 1):
        pad = [(0, 0), (0, 0)]; pad[axis] = (r + 1, r)
        c = np.cumsum(np.pad(bad, pad), axis=axis)
        bad = np.take(c, range(2 * r + 1, c.shape[axis]), axis=axis) - np.take(c, range(0, c.shape[axis] - 2 * r - 1), axis=axis)
    return bad == 0


def metrics(pred, ref):
    tp = int((pred & ref).sum()); fp = int((pred & ~ref).sum()); fn = int((~pred & ref).sum()); tn = int((~pred & ~ref).sum())
    sd = lambda a, b: round(a / b, 4) if b else None
    return dict(tp=tp, fp=fp, fn=fn, tn=tn, precision=sd(tp, tp + fp), recall=sd(tp, tp + fn), f1=sd(2 * tp, 2 * tp + fp + fn), iou=sd(tp, tp + fp + fn))


s1_active = sorted(glob.glob(f'{S1_DIR}/S1D_*20260912T*_rtc_VV.tif'))[0]
out = {'reference': 'NASA OPERA DSWx-S1 v1.0, B01_WTR, Sentinel-1D pass 2026-09-12 00:11 UTC', 'tiles': [os.path.basename(t) for t in tiles],
       'wtr_codes': codes, 'note': 'Agreement with another model product, not accuracy. DSWx-S1 uses the same Sentinel-1D pass as our Sentinel-1 map.',
       'grid_note': 'each map scored on its own 80 m grid, restricted to pixels valid in DSWx, the S1 footprint (eroded 40 px) and the common NISAR L/S support',
       'results': {}}
for name, path in MAPS.items():
    with rasterio.open(path) as s:
        grid = dict(shape=s.shape, transform=s.transform, crs=s.crs); cls = s.read(1)
    valid_frac = on_grid(grid, lambda a: (a < 250).astype(np.float32))
    ok = np.nan_to_num(valid_frac) >= 0.5
    s1v = read_to(s1_active, grid, Resampling.nearest, fill=np.nan)
    ok &= erode(np.isfinite(s1v) & (s1v > 0), 40)
    ok &= read_to(SUPPORT, grid) > 0
    px_km2 = abs(grid['transform'].a * grid['transform'].e) / 1e6
    pred = np.isin(cls, WATER_NOW)
    res = {'scored_pixels': int(ok.sum()), 'scored_km2': round(ok.sum() * px_km2, 2), 'scored_acres': round(ok.sum() * px_km2 / ACRE_KM2)}
    for label, wset in (('open_water', (1,)), ('open_water_plus_inundated_vegetation', (1, 3))):
        frac = on_grid(grid, lambda a, w=wset: np.where(a < 250, np.isin(a, w), np.nan).astype(np.float32))
        ref = np.nan_to_num(frac) >= 0.5
        m = metrics(pred[ok], ref[ok])
        m['ours_water_km2'] = round(pred[ok].sum() * px_km2, 2); m['ours_water_acres'] = round(pred[ok].sum() * px_km2 / ACRE_KM2)
        m['dswx_water_km2'] = round(ref[ok].sum() * px_km2, 2); m['dswx_water_acres'] = round(ref[ok].sum() * px_km2 / ACRE_KM2)
        res[label] = m
        if label == 'open_water':  # masks for context_split.py
            np.savez_compressed(f'{HERE}/masks_{name}.npz', pred=pred, ref=ref, ok=ok, cls=cls,
                                transform=np.array(grid['transform'])[:6], crs=str(grid['crs']))
    out['results'][name] = res
    print(name, json.dumps(res))
json.dump(out, open(f'{HERE}/dswx_s1_agreement.json', 'w'), indent=2)
print('wrote', f'{HERE}/dswx_s1_agreement.json')
