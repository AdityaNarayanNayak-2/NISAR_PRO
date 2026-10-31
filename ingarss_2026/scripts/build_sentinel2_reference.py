#!/usr/bin/env python3
"""Build an independent Sentinel-2 NDWI water reference for the Bihar box.

This is a reference-label aid, not a replacement for expert labelling. It uses
Sentinel-2 L2A B03/B08 NDWI and masks Sentinel scene-classification cloud and
shadow classes. The output is a 0/1/255 GeoTIFF: non-water, water, nodata.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import rasterio
import requests
from rasterio.enums import Resampling
from rasterio.transform import array_bounds
from rasterio.warp import reproject, transform_bounds
from rasterio.windows import from_bounds


STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"
DEFAULT_ITEM = "S2C_MSIL2A_20261018T044811_R076_T45RVJ_20261018T074216"
DEFAULT_BBOX = (86.3946, 25.4098, 86.6054, 25.5902)
CLOUD_CLASSES = {3, 8, 9, 10, 11}


def get_item(item_id: str) -> dict:
    response = requests.get(
        f"{STAC_URL}/collections/sentinel-2-l2a/items/{item_id}", timeout=60
    )
    response.raise_for_status()
    return response.json()


def asset_url(item: dict, name: str) -> str:
    try:
        return item["assets"][name]["href"]
    except KeyError as exc:
        raise KeyError(f"Sentinel item does not contain asset {name!r}") from exc


def read_aoi(url: str, bbox: tuple[float, float, float, float]):
    with rasterio.Env(GDAL_HTTP_MULTIRANGE="YES"):
        with rasterio.open(url) as src:
            source_bbox = transform_bounds("EPSG:4326", src.crs, *bbox, densify_pts=21)
            window = from_bounds(*source_bbox, transform=src.transform).round_offsets().round_lengths()
            data = src.read(1, window=window)
            transform = src.window_transform(window)
            profile = src.profile.copy()
            profile.update(width=data.shape[1], height=data.shape[0], transform=transform)
            return data, profile, src.crs


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--item-id", default=DEFAULT_ITEM)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--metadata-output", type=Path)
    parser.add_argument("--ndwi-threshold", type=float, default=0.30)
    parser.add_argument("--bbox", nargs=4, type=float, default=DEFAULT_BBOX, metavar=("WEST", "SOUTH", "EAST", "NORTH"))
    args = parser.parse_args()

    item = get_item(args.item_id)
    bbox = tuple(args.bbox)
    green, profile, crs = read_aoi(asset_url(item, "B03"), bbox)
    nir, nir_profile, _ = read_aoi(asset_url(item, "B08"), bbox)
    if green.shape != nir.shape or profile["transform"] != nir_profile["transform"]:
        raise RuntimeError("B03 and B08 AOI windows are not aligned")

    green = green.astype(np.float32)
    nir = nir.astype(np.float32)
    denominator = green + nir
    ndwi = np.divide(green - nir, denominator, out=np.full_like(green, np.nan), where=denominator > 0)

    scl, scl_profile, _ = read_aoi(asset_url(item, "SCL"), bbox)
    scl_on_10m = np.full(green.shape, 255, dtype=np.uint8)
    reproject(
        source=scl,
        destination=scl_on_10m,
        src_transform=scl_profile["transform"],
        src_crs=scl_profile["crs"],
        dst_transform=profile["transform"],
        dst_crs=profile["crs"],
        resampling=Resampling.nearest,
        dst_nodata=255,
    )

    valid = np.isfinite(ndwi) & ~np.isin(scl_on_10m, list(CLOUD_CLASSES)) & (scl_on_10m != 0)
    reference = np.full(green.shape, 255, dtype=np.uint8)
    reference[valid] = (ndwi[valid] >= args.ndwi_threshold).astype(np.uint8)
    profile.update(driver="GTiff", dtype="uint8", count=1, nodata=255, compress="deflate")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(args.output, "w", **profile) as dst:
        dst.write(reference, 1)

    metadata = {
        "source": "Microsoft Planetary Computer Sentinel-2 L2A",
        "stac_item": args.item_id,
        "acquisition_datetime": item["properties"].get("datetime"),
        "scene_cloud_cover_percent": item["properties"].get("eo:cloud_cover"),
        "bbox_wgs84": list(bbox),
        "crs": str(crs),
        "method": "NDWI=(B03-B08)/(B03+B08)",
        "ndwi_threshold": args.ndwi_threshold,
        "cloud_shadow_scl_classes_excluded": sorted(CLOUD_CLASSES),
        "output_encoding": {"0": "non-water", "1": "water", "255": "nodata"},
        "limitations": [
            "Optical reference is date-specific and cloud-masked; it is not a perfect label.",
            "NDWI threshold and SCL masking require sensitivity review.",
            "Validation is limited to the supplied reference box unless a larger reference is generated.",
        ],
    }
    metadata_output = args.metadata_output or args.output.with_suffix(".json")
    metadata_output.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
