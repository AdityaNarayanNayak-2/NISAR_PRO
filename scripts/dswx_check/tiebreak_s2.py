#!/usr/bin/env python3
"""Board #64, part 2: where our map and DSWx-S1 disagree, which side does Sentinel-2 optical water support?
Sentinel-2 L2A 13 Sep 2026 (orbit R076), NDWI > 0.0 on cloud-free pixels, built with the package's own
function (ingarss_2026/scripts/validate_sentinel2.py, imported read-only; caches go to ./context/).
Times: Sentinel-1 / DSWx 12 Sep 00:11 UTC, NISAR 12 Sep 23:38 UTC, Sentinel-2 13 Sep 04:47 UTC.
Optical labels are not ground truth either (water under crops/trees is invisible to NDWI).
Writes tiebreak_s2.json and appends a section to context_split.md.
"""
import importlib.util, json, os, sys
sys.dont_write_bytecode = True  # do not leave __pycache__ in ingarss_2026/
import numpy as np, requests
from rasterio.transform import Affine, array_bounds
from pathlib import Path

HERE = os.environ.get('DSWX_DIR', os.path.expanduser('~/Desktop/nisar_data/dswx_s1')); os.makedirs(HERE, exist_ok=True); CTX = Path(HERE) / 'context'
spec = importlib.util.spec_from_file_location('v2', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'ingarss_2026', 'scripts', 'validate_sentinel2.py'))
v2 = importlib.util.module_from_spec(spec); spec.loader.exec_module(v2)
token = requests.get(v2.TOKEN, timeout=60, headers={'User-Agent': 'NISAR-Pro'}).json()['token']
ACRE_KM2 = 0.004046856
MAPS = {'sentinel1_vv': 'Sentinel-1 VV', 'nisar_s_hh': 'NISAR S-band HH', 'nisar_l_hh': 'NISAR L-band HH'}
sd = lambda a, b: round(a / b, 3) if b else None


def f1(pred, ref):
    tp = int((pred & ref).sum()); fp = int((pred & ~ref).sum()); fn = int((~pred & ref).sum())
    return dict(f1=sd(2 * tp, 2 * tp + fp + fn), precision=sd(tp, tp + fp), recall=sd(tp, tp + fn))


out = {'reference': 'Sentinel-2 L2A 2026-09-13 04:47 UTC, R076, NDWI > 0.0, cloud-free (package method)', 'maps': {}}
for name, label in MAPS.items():
    m = np.load(f'{HERE}/masks_{name}.npz'); T = Affine(*m['transform']); ok = m['ok']; pred = m['pred']; dswx = m['ref']
    grid = dict(shape=ok.shape, transform=T, crs='EPSG:32645', bounds=array_bounds(*ok.shape, T))
    ndwi, clear, tiles = v2.build_reference('2026-09-13', grid, token, CTX / f's2_20260913_{name}.npz')
    s = ok & clear & np.isfinite(ndwi); s2 = ndwi > v2.PRIMARY
    px_km2 = abs(T.a * T.e) / 1e6
    km = lambda n: round(int(n) * px_km2, 2); ac = lambda n: round(int(n) * px_km2 / ACRE_KM2)
    only_us = s & pred & ~dswx; only_dswx = s & ~pred & dswx
    r = {'scored_km2': km(s.sum()), 'scored_acres': ac(s.sum()),
         'ours_vs_s2': f1(pred[s], s2[s]), 'dswx_vs_s2': f1(dswx[s], s2[s]),
         'only_ours_water': {'km2': km(only_us.sum()), 'acres': ac(only_us.sum()), 's2_says_water_share': sd(int((only_us & s2).sum()), int(only_us.sum()))},
         'only_dswx_water': {'km2': km(only_dswx.sum()), 'acres': ac(only_dswx.sum()), 's2_says_water_share': sd(int((only_dswx & s2).sum()), int(only_dswx.sum()))}}
    out['maps'][name] = r; print(name, json.dumps(r))
json.dump(out, open(f'{HERE}/tiebreak_s2.json', 'w'), indent=2)

L = ['', '## Tie-break with Sentinel-2 (13 Sep 04:47 UTC, NDWI > 0, cloud-free pixels only)', '',
     'Where we and DSWx-S1 disagree, does optical Sentinel-2 see water? Times: S1/DSWx 12 Sep 00:11 UTC, NISAR 12 Sep 23:38 UTC, S2 13 Sep 04:47 UTC. '
     'NDWI cannot see water under crops or trees, so it is a third opinion, not ground truth.', '',
     '| Map | Scored km² (ac) | Our F1 vs S2 | DSWx F1 vs S2 | Only-ours water km² (ac) | S2 sees water there | Only-DSWx water km² (ac) | S2 sees water there |', '|---|---|---|---|---|---|---|---|']
for name, label in MAPS.items():
    r = out['maps'][name]
    L.append(f'| {label} | {r["scored_km2"]:,} ({r["scored_acres"]:,}) | {r["ours_vs_s2"]["f1"]} | {r["dswx_vs_s2"]["f1"]} | '
             f'{r["only_ours_water"]["km2"]:,} ({r["only_ours_water"]["acres"]:,}) | {r["only_ours_water"]["s2_says_water_share"]} | '
             f'{r["only_dswx_water"]["km2"]:,} ({r["only_dswx_water"]["acres"]:,}) | {r["only_dswx_water"]["s2_says_water_share"]} |')
with open(f'{HERE}/context_split.md', 'a') as f: f.write('\n'.join(L) + '\n')
print('wrote tiebreak_s2.json, appended to context_split.md')
