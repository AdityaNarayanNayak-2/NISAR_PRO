#!/bin/bash
# NISAR Beta Data Download Script (v2)
# Fixed: uses curl with explicit output filename to avoid truncation issues

set -e

DOWNLOAD_DIR="/home/aditya/Desktop/nisar_data"

# We download 2 files:
# 1. A GCOV (1.1 GB, L2 Polarimetric Covariance) — smaller, faster to download
# 2. The RSLC (7.8 GB, L1 Raw SLC) — optional, for the full RDA pipeline

GCOV_NAME="NISAR_L2_PR_GCOV_010_165_D_100_2005_DHDH_M_20260120T155930_20260120T155950_X05010_N_P_J_001.h5"
GCOV_URL="https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_BETA_V1/NISAR_L2_PR_GCOV_010_165_D_100_2005_DHDH_M_20260120T155930_20260120T155950_X05010_N_P_J_001/${GCOV_NAME}"

RSLC_NAME="NISAR_L1_PR_RSLC_010_165_D_100_2005_DHDH_M_20260120T155930_20260120T155950_X05010_N_P_J_001.h5"
RSLC_URL="https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L1_RSLC_BETA_V1/NISAR_L1_PR_RSLC_010_165_D_100_2005_DHDH_M_20260120T155930_20260120T155950_X05010_N_P_J_001/${RSLC_NAME}"

echo "╔══════════════════════════════════════════════╗"
echo "║     NISAR Beta Data Downloader  v2           ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── Earthdata credentials ─────────────────────────────────────────────────
if [ ! -f "$HOME/.netrc" ] || ! grep -q "urs.earthdata.nasa.gov" "$HOME/.netrc" 2>/dev/null; then
    echo "Enter your NASA Earthdata credentials (https://urs.earthdata.nasa.gov)"
    echo ""
    read -p "Username: " EARTHDATA_USER
    read -sp "Password: " EARTHDATA_PASS
    echo ""

    cat > "$HOME/.netrc" << EOF
machine urs.earthdata.nasa.gov
    login ${EARTHDATA_USER}
    password ${EARTHDATA_PASS}
EOF
    chmod 600 "$HOME/.netrc"
    echo "[✓] Credentials saved to ~/.netrc"
else
    echo "[✓] Using existing credentials from ~/.netrc"
fi
echo ""

# ── Create download dir ──────────────────────────────────────────────────
mkdir -p "$DOWNLOAD_DIR"

# ── Download function using curl (handles redirects + long URLs properly) ─
download_file() {
    local url="$1"
    local output="$2"
    local desc="$3"

    if [ -f "$output" ]; then
        echo "[✓] Already downloaded: $desc"
        ls -lh "$output"
        return 0
    fi

    echo "[↓] Downloading: $desc"
    echo "    Size will be shown by curl..."
    echo ""

    curl -L -n -b "$HOME/.urs_cookies" -c "$HOME/.urs_cookies" \
         --progress-bar \
         -o "$output" \
         "$url"

    echo ""
    echo "[✓] Downloaded: $desc"
    ls -lh "$output"
}

# ── Create cookie jar if missing ────────────────────────────────────────
touch "$HOME/.urs_cookies"

echo "════════════════════════════════════════════════"
echo "  Downloading NISAR L2 GCOV (≈1.1 GB)"
echo "  Geocoded Polarimetric Covariance Matrix"
echo "  Date: Jan 20, 2026 | Pols: HH+HV | Frame: 100"
echo "════════════════════════════════════════════════"
echo ""

download_file "$GCOV_URL" "$DOWNLOAD_DIR/$GCOV_NAME" "NISAR L2 GCOV (1.1 GB)"

echo ""
echo "════════════════════════════════════════════════"
echo "  Done! File saved to:"
echo "  $DOWNLOAD_DIR/$GCOV_NAME"
echo ""
echo "  To process it:"
echo "  cd /home/aditya/Desktop/sar_analyzer/sar_processor"
echo "  RUST_LOG=info cargo run --release --bin sar_processor -- \\"
echo "    --input $DOWNLOAD_DIR/$GCOV_NAME \\"
echo "    --pol HH --output focused_nisar.png"
echo "════════════════════════════════════════════════"
echo ""

# ── Optional: Download RSLC (7.8 GB) ───────────────────────────────────
read -p "Also download RSLC (7.8 GB, for full RDA pipeline)? [y/N]: " DOWNLOAD_RSLC
if [[ "$DOWNLOAD_RSLC" =~ ^[Yy]$ ]]; then
    echo ""
    download_file "$RSLC_URL" "$DOWNLOAD_DIR/$RSLC_NAME" "NISAR L1 RSLC (7.8 GB)"
fi

echo ""
echo "[✓] All downloads complete!"
ls -lh "$DOWNLOAD_DIR/"
