#!/usr/bin/env bash
# Rebuild ingarss_2026/TECHNICAL_NOTE.pdf from TECHNICAL_NOTE.md, then refresh the manifest.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 scripts/note_md2html.py ingarss_2026/TECHNICAL_NOTE.md ingarss_2026/.note_tmp.html
google-chrome --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=20000 \
  --print-to-pdf=ingarss_2026/TECHNICAL_NOTE.pdf "file://$PWD/ingarss_2026/.note_tmp.html" 2>/dev/null
rm ingarss_2026/.note_tmp.html
pdfinfo ingarss_2026/TECHNICAL_NOTE.pdf | grep Pages
python3 ingarss_2026/scripts/build_provenance_manifest.py
