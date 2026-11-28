#!/usr/bin/env python3
"""Board #64: where do our 12 Sep water maps agree / disagree with NASA OPERA DSWx-S1?
Splits the scores of compare_dswx.py (masks_*.npz) by context, after ICEYE's validation lessons:
  - HAND (height above nearest drainage, ASF GLO-30 HAND, public on AWS)
  - slope (from Copernicus GLO-30 DEM, public on AWS)
  - land cover (ESA WorldCover 2021, public on AWS)
  - distance to permanent water (WorldCover class 80)
Context layers are read at reduced resolution (COG overviews) and cached in ./context/.
Agreement with a model product, not accuracy. DSWx-S1 already excludes its own HAND-masked pixels.
Writes context_split.json and context_split.md.
"""
import json, math, os
import numpy as np, rasterio
from rasterio.enums import Resampling
from rasterio.merge import merge
from rasterio.transform import Affine
from rasterio.warp import reproject, transform_bounds
from scipy import ndimage

HERE = os.environ.get('DSWX_DIR', os.path.expanduser('~/Desktop/nisar_data/dswx_s1')); os.makedirs(HERE, exist_ok=True); CTX = f'{HERE}/context'; os.makedirs(CTX, exist_ok=True)
os.environ.setdefault('GDAL_DISABLE_READDIR_ON_OPEN', 'EMPTY_DIR'); os.environ.setdefault('GDAL_HTTP_USERAGENT', 'NISAR-Pro')
ACRE_KM2 = 0.004046856
MAPS = {'sentinel1_vv': 'Sentinel-1 VV', 'nisar_s_hh': 'NISAR S-band HH', 'nisar_l_hh': 'NISAR L-band HH'}
WC = {10: 'Tree cover', 20: 'Shrubland', 30: 'Grassland', 40: 'Cropland', 50: 'Built-up', 60: 'Bare / sparse', 80: 'Permanent water', 90: 'Herbaceous wetland'}


def fetch(url, out, ovr):
    """Read one overview level of a public COG into a local GeoTIFF (cached)."""
    if os.path.exists(out): return out
    with rasterio.open('/vsicurl/' + url, overview_level=ovr) as s:
        a = s.read(1); prof = s.profile.copy()
        prof.update(width=a.shape[1], height=a.shape[0], transform=s.transform, driver='GTiff', compress='deflate', tiled=True)
        for k in ('blockxsize', 'blockysize'): prof.pop(k, None)
        prof.update(blockxsize=256, blockysize=256)
    with rasterio.open(out + '.part', 'w', **prof) as d: d.write(a, 1)
    os.replace(out + '.part', out); print('cached', os.path.basename(out), a.shape); return out


def mosaic(paths):
    srcs = [rasterio.open(p) for p in paths]
    arr, tr = merge(srcs); crs = srcs[0].crs; nd = srcs[0].nodata
    for s in srcs: s.close()
    return arr[0], tr, crs, nd


def to_grid(src, grid, resampling, nodata=None):
    a, tr, crs, nd = src
    dst = np.full(grid['shape'], np.nan, np.float32)
    reproject(a.astype(np.float32), dst, src_transform=tr, src_crs=crs, dst_transform=grid['transform'], dst_crs=grid['crs'],
              src_nodata=nd if nd is not None else nodata, dst_nodata=np.nan, resampling=resampling)
    return dst


def stats(pred, ref, px_km2, fp_total):
    tp = int((pred & ref).sum()); fp = int((pred & ~ref).sum()); fn = int((~pred & ref).sum()); n = int(pred.size)
    sd = lambda a, b: round(a / b, 3) if b else None
    km = lambda v: round(v * px_km2, 2)
    return dict(area_km2=km(n), area_acres=round(n * px_km2 / ACRE_KM2), ours_water_km2=km(int(pred.sum())), dswx_water_km2=km(int(ref.sum())),
                extra_water_km2=km(fp), extra_water_acres=round(fp * px_km2 / ACRE_KM2), share_of_all_extra_water=sd(fp, fp_total),
                precision=sd(tp, tp + fp), recall=sd(tp, tp + fn), f1=sd(2 * tp, 2 * tp + fp + fn))


# ---- context sources (tiles over the scored area)
m0 = np.load(f'{HERE}/masks_nisar_l_hh.npz'); T0 = Affine(*m0['transform']); ok0 = m0['ok']
r = np.where(ok0.any(1))[0]; c = np.where(ok0.any(0))[0]
x0, y0 = T0 * (c[0], r[-1] + 1); x1, y1 = T0 * (c[-1] + 1, r[0])
lo0, la0, lo1, la1 = transform_bounds('EPSG:32645', 'EPSG:4326', x0, y0, x1, y1)
tiles = [(la, lo) for la in range(math.floor(la0), math.floor(la1) + 1) for lo in range(math.floor(lo0), math.floor(lo1) + 1)]
dem = mosaic([fetch(f'https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N{la}_00_E{lo:03d}_00_DEM/Copernicus_DSM_COG_10_N{la}_00_E{lo:03d}_00_DEM.tif',
                    f'{CTX}/dem_N{la}E{lo:03d}.tif', 0) for la, lo in tiles])
hand = mosaic([fetch(f'https://glo-30-hand.s3.us-west-2.amazonaws.com/v1/2021/Copernicus_DSM_COG_10_N{la}_00_E{lo:03d}_00_HAND.tif',
                     f'{CTX}/hand_N{la}E{lo:03d}.tif', 0) for la, lo in tiles])
wct = sorted({(3 * math.floor(la / 3), 3 * math.floor(lo / 3)) for la, lo in tiles})
wc = mosaic([fetch(f'https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_N{la:02d}E{lo:03d}_Map.tif',
                   f'{CTX}/wc_N{la:02d}E{lo:03d}.tif', 2) for la, lo in wct])

out = {'reference': 'NASA OPERA DSWx-S1 open water, 2026-09-12 00:11 UTC pass (see dswx_s1_agreement.json)',
       'context_sources': {'hand': 'ASF GLO-30 HAND v1 (2021)', 'slope': 'Copernicus GLO-30 DEM', 'land_cover': 'ESA WorldCover 2021 v200',
                           'distance_to_permanent_water': 'from WorldCover class 80'},
       'note': 'Agreement with a model product, not accuracy. "extra water" = our water where DSWx says not water.', 'maps': {}}
for name, label in MAPS.items():
    m = np.load(f'{HERE}/masks_{name}.npz'); T = Affine(*m['transform']); ok = m['ok']; pred = m['pred']; ref = m['ref']
    grid = dict(shape=ok.shape, transform=T, crs='EPSG:32645'); px = abs(T.a)
    px_km2 = abs(T.a * T.e) / 1e6
    h = to_grid(hand, grid, Resampling.average)
    z = to_grid(dem, grid, Resampling.average)
    gy, gx = np.gradient(np.nan_to_num(z, nan=np.nanmean(z)), px); slope = np.degrees(np.arctan(np.hypot(gx, gy)))
    lc = to_grid(wc, grid, Resampling.mode)
    dist = ndimage.distance_transform_edt(lc != 80) * px / 1000  # km
    fp_total = int((pred & ~ref & ok).sum())
    bins = {
        'hand_m': [('0-2 m', (h >= 0) & (h < 2)), ('2-5 m', (h >= 2) & (h < 5)), ('5-10 m', (h >= 5) & (h < 10)), ('10-20 m', (h >= 10) & (h < 20)), ('>= 20 m', h >= 20)],
        'slope_deg': [('< 0.5°', slope < 0.5), ('0.5-1°', (slope >= 0.5) & (slope < 1)), ('1-2°', (slope >= 1) & (slope < 2)), ('2-5°', (slope >= 2) & (slope < 5)), ('>= 5°', slope >= 5)],
        'land_cover': [(v, lc == k) for k, v in WC.items()],
        'distance_to_permanent_water': [('0 (water pixel)', dist == 0), ('< 0.5 km', (dist > 0) & (dist < 0.5)), ('0.5-2 km', (dist >= 0.5) & (dist < 2)),
                                        ('2-5 km', (dist >= 2) & (dist < 5)), ('>= 5 km', dist >= 5)],
    }
    res = {'all': stats(pred[ok], ref[ok], px_km2, fp_total)}
    for k, lst in bins.items():
        res[k] = {}
        for bl, sel in lst:
            s = ok & sel
            if s.sum() * px_km2 < 5: continue  # skip bins under 5 km²
            res[k][bl] = stats(pred[s], ref[s], px_km2, fp_total)
    # what-if: drop our water where HAND >= t (a Method v2 idea, board #10)
    res['what_if_hand_mask'] = {}
    for t in (5, 10, 15, 20):
        p2 = pred & ~(np.nan_to_num(h, nan=0) >= t)
        res['what_if_hand_mask'][f'HAND >= {t} m removed'] = {k: v for k, v in stats(p2[ok], ref[ok], px_km2, fp_total).items()
                                                               if k in ('f1', 'precision', 'recall', 'ours_water_km2', 'extra_water_km2')}
    out['maps'][name] = res; print(name, 'done', json.dumps(res['what_if_hand_mask']))
json.dump(out, open(f'{HERE}/context_split.json', 'w'), indent=2, ensure_ascii=False)

# ---- markdown summary
L = ['# Where our 12 Sep water maps agree with NASA OPERA DSWx-S1', '',
     'Agreement with a model product on the same pixels, not accuracy. "Extra water" = we say water, DSWx says not water. '
     'Areas in km² (acres). Bins under 5 km² are left out. Context: ASF GLO-30 HAND, Copernicus GLO-30 DEM slope, ESA WorldCover 2021.', '']
for name, label in MAPS.items():
    res = out['maps'][name]; a = res['all']
    L += [f'## {label}', '', f'All scored pixels: {a["area_km2"]:,} km² ({a["area_acres"]:,} ac). F1 {a["f1"]}, precision {a["precision"]}, recall {a["recall"]}. '
          f'Extra water {a["extra_water_km2"]:,} km² ({a["extra_water_acres"]:,} ac).', '']
    for k, title in (('hand_m', 'Height above nearest drainage (HAND)'), ('slope_deg', 'Slope'), ('land_cover', 'Land cover (WorldCover)'),
                     ('distance_to_permanent_water', 'Distance to permanent water')):
        L += [f'**{title}**', '', '| Bin | Area km² | F1 | Precision | Recall | Extra water km² (ac) | Share of all extra water |', '|---|---|---|---|---|---|---|']
        for bl, s in res[k].items():
            L.append(f'| {bl} | {s["area_km2"]:,} | {s["f1"]} | {s["precision"]} | {s["recall"]} | {s["extra_water_km2"]:,} ({s["extra_water_acres"]:,}) | {s["share_of_all_extra_water"]} |')
        L.append('')
    L += ['**What if we drop our water where HAND is high?** (idea for Method v2)', '', '| Mask | F1 | Precision | Recall | Our water km² | Extra water km² |', '|---|---|---|---|---|---|',
          f'| none | {a["f1"]} | {a["precision"]} | {a["recall"]} | {a["ours_water_km2"]:,} | {a["extra_water_km2"]:,} |']
    for bl, s in res['what_if_hand_mask'].items():
        L.append(f'| {bl} | {s["f1"]} | {s["precision"]} | {s["recall"]} | {s["ours_water_km2"]:,} | {s["extra_water_km2"]:,} |')
    L.append('')
open(f'{HERE}/context_split.md', 'w').write('\n'.join(L))
print('wrote context_split.json and context_split.md')
