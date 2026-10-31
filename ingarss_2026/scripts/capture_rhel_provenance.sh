#!/usr/bin/env bash
set -euo pipefail

# Capture evidence that the HTTP gateway cannot expose: exact source granules,
# processor binary, Git revision, and generated-result hashes.
REPO="${1:-$PWD}"
ACTIVE="${2:-}"
BASELINE="${3:-}"
BINARY="${4:-$REPO/sar_science_processor/target/release/sar_science_processor}"
RESULTS_DIR="${5:-$REPO/ingarss_2026/results}"
OUTPUT="${6:-$REPO/ingarss_2026/results/rhel_provenance_$(date -u +%Y%m%dT%H%M%SZ).txt}"

if [[ -z "$ACTIVE" || -z "$BASELINE" ]]; then
  echo "Usage: $0 REPO ACTIVE_GCOV BASELINE_GCOV [PROCESSOR_BINARY] [RESULTS_DIR] [OUTPUT]" >&2
  exit 2
fi

mkdir -p "$(dirname "$OUTPUT")"
{
  echo "NISAR Pro InGARSS provenance capture"
  echo "captured_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo
  echo "[git]"
  git -C "$REPO" rev-parse --show-toplevel
  git -C "$REPO" rev-parse HEAD
  git -C "$REPO" branch --show-current
  git -C "$REPO" status --short
  echo
  echo "[runtime]"
  uname -a
  rustc --version 2>/dev/null || true
  cargo --version 2>/dev/null || true
  python3 --version 2>/dev/null || true
  echo
  echo "[processor]"
  realpath "$BINARY"
  stat -c 'bytes=%s modified=%y' "$BINARY"
  sha256sum "$BINARY"
  "$BINARY" --version 2>/dev/null || true
  echo
  echo "[inputs]"
  for path in "$ACTIVE" "$BASELINE"; do
    realpath "$path"
    stat -c 'bytes=%s modified=%y' "$path"
    sha256sum "$path"
  done
  echo
  echo "[results]"
  if [[ -d "$RESULTS_DIR" ]]; then
    find "$RESULTS_DIR" -type f -printf '%p\n' | sort | while IFS= read -r path; do
      stat -c '%n bytes=%s modified=%y' "$path"
      sha256sum "$path"
    done
  else
    echo "results_dir_missing=$RESULTS_DIR"
  fi
} > "$OUTPUT"

echo "Wrote $OUTPUT"
