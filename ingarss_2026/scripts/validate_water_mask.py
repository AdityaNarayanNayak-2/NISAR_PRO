#!/usr/bin/env python3
"""Score a binary water reference against a NISAR Pro class GeoTIFF.

The reference must be a georeferenced raster where 1 means water, 0 means
non-water, and nodata is ignored. Prediction classes 1-4 are treated as water
by default; class 5 (receded water) is not current water unless explicitly
included with --positive-classes.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import rasterio
from rasterio.warp import Resampling, reproject


def parse_classes(value: str) -> set[int]:
    return {int(item.strip()) for item in value.split(",") if item.strip()}


def confusion_metrics(prediction: np.ndarray, reference: np.ndarray) -> dict:
    tp = int(np.count_nonzero(prediction & reference))
    tn = int(np.count_nonzero(~prediction & ~reference))
    fp = int(np.count_nonzero(prediction & ~reference))
    fn = int(np.count_nonzero(~prediction & reference))
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    iou = tp / (tp + fp + fn) if tp + fp + fn else 0.0
    accuracy = (tp + tn) / (tp + tn + fp + fn) if tp + tn + fp + fn else 0.0
    return {
        "true_positive": tp,
        "true_negative": tn,
        "false_positive": fp,
        "false_negative": fn,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "iou": iou,
        "overall_accuracy": accuracy,
        "evaluated_pixels": tp + tn + fp + fn,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prediction", required=True, type=Path)
    parser.add_argument("--reference", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument(
        "--positive-classes",
        default="1,2,3,4",
        help="Prediction class codes counted as current water (default: 1,2,3,4)",
    )
    parser.add_argument(
        "--reference-water-value",
        type=float,
        default=1.0,
        help="Reference raster value representing water (default: 1)",
    )
    args = parser.parse_args()
    positive_classes = parse_classes(args.positive_classes)

    with rasterio.open(args.prediction) as prediction_src:
        prediction = prediction_src.read(1)
        prediction_nodata = prediction_src.nodata
        profile = prediction_src.profile
        reference_on_prediction_grid = np.full(prediction.shape, np.nan, dtype=np.float32)

        with rasterio.open(args.reference) as reference_src:
            reproject(
                source=rasterio.band(reference_src, 1),
                destination=reference_on_prediction_grid,
                src_transform=reference_src.transform,
                src_crs=reference_src.crs,
                src_nodata=reference_src.nodata,
                dst_transform=prediction_src.transform,
                dst_crs=prediction_src.crs,
                dst_nodata=np.nan,
                resampling=Resampling.nearest,
            )
            reference_nodata = reference_src.nodata
            reference_metadata = {
                "path": str(args.reference),
                "crs": str(reference_src.crs),
                "width": reference_src.width,
                "height": reference_src.height,
                "resolution": [reference_src.res[0], reference_src.res[1]],
                "nodata": reference_nodata,
            }

        valid = np.isfinite(reference_on_prediction_grid)
        if prediction_nodata is not None:
            valid &= prediction != prediction_nodata

        reference_water = reference_on_prediction_grid == args.reference_water_value
        prediction_water = np.isin(prediction, list(positive_classes))
        metrics = confusion_metrics(prediction_water[valid], reference_water[valid])

        result = {
            "method": "binary water-mask validation on prediction grid",
            "prediction": {
                "path": str(args.prediction),
                "crs": str(profile.get("crs")),
                "width": prediction.shape[1],
                "height": prediction.shape[0],
                "nodata": prediction_nodata,
                "positive_classes": sorted(positive_classes),
            },
            "reference": reference_metadata,
            "reference_water_value": args.reference_water_value,
            "metrics": metrics,
            "limitations": [
                "Reference was reprojected to the prediction grid using nearest-neighbour resampling.",
                "Metrics describe agreement with the supplied reference and are not a claim about causal flood attribution.",
                "Reference date, label quality, and sampling design must be documented separately.",
            ],
        }
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(result["metrics"], indent=2))


if __name__ == "__main__":
    main()
