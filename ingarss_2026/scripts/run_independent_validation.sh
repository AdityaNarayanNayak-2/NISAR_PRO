#!/usr/bin/env bash
set -euo pipefail

# Validate one or more georeferenced classification rasters against the same
# dated optical reference. Arguments are METHOD=PATH pairs.
ROOT="${1:-$PWD}"
REFERENCE="${2:-$ROOT/ingarss_2026/results/validation/sentinel2_20261018_reference.tif}"
shift 2 || true

if [[ "$#" -eq 0 ]]; then
  echo "Usage: $0 REPOSITORY [REFERENCE_TIF] METHOD=CLASSIFICATION_TIF [...]" >&2
  exit 2
fi

mkdir -p "$(dirname "$REFERENCE")"
python3 -m pip install --user requests rasterio numpy
python3 "$ROOT/ingarss_2026/scripts/build_sentinel2_reference.py" --output "$REFERENCE"

for pair in "$@"; do
  method="${pair%%=*}"
  prediction="${pair#*=}"
  if [[ "$method" == "$pair" || ! -f "$prediction" ]]; then
    echo "Invalid METHOD=PATH pair or missing raster: $pair" >&2
    exit 2
  fi
  python3 "$ROOT/ingarss_2026/scripts/validate_water_mask.py" \
    --prediction "$prediction" \
    --reference "$REFERENCE" \
    --output "$ROOT/ingarss_2026/results/validation/${method}_metrics.json"
done

echo "Independent validation outputs written under $ROOT/ingarss_2026/results/validation"
