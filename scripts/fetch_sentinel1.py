#!/usr/bin/env python3
"""Find and download Sentinel-1 backscatter (RTC) GeoTIFFs for NISAR Pro. Standard library only.

Source: Microsoft Planetary Computer, collection `sentinel-1-rtc` (radiometrically terrain
corrected gamma0, 10 m, UTM, Cloud-Optimized GeoTIFF). No account needed: the script asks for an
anonymous read token. Files are saved as `<scene id>_<POL>.tif`, which the gateway lists as
C-band scenes and the engine reads directly.

  # list passes over Patna between two dates
  python3 scripts/fetch_sentinel1.py --bbox 84.9 25.4 85.6 25.8 --from 2026-08-20 --to 2026-09-20
  # download two of them (ids from the list) into the data folder
  python3 scripts/fetch_sentinel1.py --get S1D_IW_GRDH_1SDV_20260831T001127_... S1D_IW_GRDH_1SDV_20260912T001128_... \\
      --out ~/Desktop/nisar_data/sentinel1

Pair two passes of the same relative orbit (same direction and footprint) and polarization.
One full VV file is about 1.5-2 GB.
"""
import argparse
import json
import os
import sys
import urllib.request

STAC = "https://planetarycomputer.microsoft.com/api/stac/v1"
TOKEN = "https://planetarycomputer.microsoft.com/api/sas/v1/token/sentinel-1-rtc"
UA = {"User-Agent": "NISAR-Pro"}


def get_json(url, body=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = dict(UA, **({"Content-Type": "application/json"} if data else {}))
    with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=headers), timeout=60) as r:
        return json.load(r)


def search(bbox, start, end):
    body = {"collections": ["sentinel-1-rtc"], "bbox": bbox, "datetime": f"{start}T00:00:00Z/{end}T23:59:59Z", "limit": 100}
    items = get_json(f"{STAC}/search", body).get("features", [])
    items.sort(key=lambda f: f["properties"]["datetime"])
    print(f"{'scene id':<70} {'date (UTC)':<20} orbit dir   EPSG")
    for f in items:
        p = f["properties"]
        epsg = p.get("proj:epsg") or p.get("proj:code")
        print(f"{f['id']:<70} {p['datetime'][:19]:<20} {p.get('sat:relative_orbit', '?'):>5} {p.get('sat:orbit_state', '?')[:4]:<5} {epsg}")
    if not items:
        print("No passes found.")


def download(ids, pol, out):
    os.makedirs(out, exist_ok=True)
    token = get_json(TOKEN)["token"]
    for i in ids:
        item = get_json(f"{STAC}/collections/sentinel-1-rtc/items/{i}")
        asset = item["assets"].get(pol.lower())
        if not asset:
            sys.exit(f"{i} has no {pol} band (has: {', '.join(k for k in item['assets'] if len(k) == 2)})")
        dest = os.path.join(out, f"{i}_{pol.upper()}.tif")
        if os.path.exists(dest):
            print(f"have {dest}")
            continue
        part = dest + ".part"
        print(f"downloading {i} {pol.upper()} ...", flush=True)
        req = urllib.request.Request(f"{asset['href']}?{token}", headers=UA)
        with urllib.request.urlopen(req, timeout=120) as r, open(part, "wb") as f:
            total = int(r.headers.get("Content-Length", 0))
            done = 0
            while chunk := r.read(4 << 20):
                f.write(chunk)
                done += len(chunk)
                if total:
                    print(f"\r  {done / 1e9:.2f} / {total / 1e9:.2f} GB", end="", flush=True)
        os.replace(part, dest)
        print(f"\n  saved {dest}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--bbox", nargs=4, type=float, metavar=("WEST", "SOUTH", "EAST", "NORTH"))
    ap.add_argument("--from", dest="start", help="YYYY-MM-DD")
    ap.add_argument("--to", dest="end", help="YYYY-MM-DD")
    ap.add_argument("--get", nargs="+", metavar="SCENE_ID", help="download these scenes")
    ap.add_argument("--pol", default="VV", choices=["VV", "VH", "vv", "vh"])
    ap.add_argument("--out", default="data/sentinel1", help="folder (default data/sentinel1)")
    a = ap.parse_args()
    if a.get:
        download(a.get, a.pol, os.path.expanduser(a.out))
    elif a.bbox and a.start and a.end:
        search(a.bbox, a.start, a.end)
    else:
        ap.error("give --bbox, --from and --to to search, or --get SCENE_ID ... to download")


if __name__ == "__main__":
    main()
