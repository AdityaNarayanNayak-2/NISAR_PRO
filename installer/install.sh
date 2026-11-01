#!/usr/bin/env bash
set -euo pipefail

VERSION="1.0.0"
APP_NAME="nisar-pro"
INSTALL_ROOT="${NISAR_PRO_HOME:-$HOME/.local/share/nisar-pro/$VERSION}"
BIN_DIR="${XDG_BIN_HOME:-$HOME/.local/bin}"
ARCHIVE_URL="${NISAR_PRO_ARCHIVE_URL:-__NISAR_PRO_ARCHIVE_URL__}"

if [[ "$ARCHIVE_URL" == __NISAR_PRO_ARCHIVE_URL__ ]]; then
  echo "Set NISAR_PRO_ARCHIVE_URL to the Linux release archive URL." >&2
  exit 1
fi

command -v curl >/dev/null 2>&1 || { echo "curl is required." >&2; exit 1; }
command -v tar >/dev/null 2>&1 || { echo "tar is required." >&2; exit 1; }

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
ARCHIVE="$TMP_DIR/nisar-pro.tar.gz"

echo "Downloading NISAR Pro $VERSION..."
curl -fL --retry 3 "$ARCHIVE_URL" -o "$ARCHIVE"

rm -rf "$INSTALL_ROOT"
mkdir -p "$INSTALL_ROOT" "$BIN_DIR"
tar -xzf "$ARCHIVE" -C "$TMP_DIR"
EXTRACTED="$TMP_DIR/NISAR-Pro-$VERSION-linux-x86_64"

if [[ ! -d "$EXTRACTED" ]]; then
  echo "Unexpected release archive layout." >&2
  exit 1
fi

cp -a "$EXTRACTED/." "$INSTALL_ROOT/"
ln -sfn "$INSTALL_ROOT/nisar-pro" "$BIN_DIR/$APP_NAME"

echo
echo "Installed NISAR Pro $VERSION to $INSTALL_ROOT"
echo "Run: $APP_NAME"
echo "If $BIN_DIR is not on PATH, add: export PATH=\"$BIN_DIR:\$PATH\""
