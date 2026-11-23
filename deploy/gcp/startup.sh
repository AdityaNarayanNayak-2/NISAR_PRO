#!/bin/bash
# Boot script for the NISAR Pro VM on Google Cloud (set by deploy.sh as the startup-script).
# Runs on every boot: reads the settings secret with the VM's service account, then runs the
# installer, which is safe to run again.
set -euo pipefail
MD=http://metadata.google.internal/computeMetadata/v1
md() { curl -fsS -H Metadata-Flavor:Google "$MD/$1"; }
attr() { md "instance/attributes/$1" 2>/dev/null || true; }
json() { python3 -c "import sys,json; print(json.load(sys.stdin)$1)"; }

TOKEN=$(md instance/service-accounts/default/token | json '["access_token"]')
S=$(curl -fsS -H "Authorization: Bearer $TOKEN" \
      "https://secretmanager.googleapis.com/v1/$(attr nisar-secret)/versions/latest:access" \
    | python3 -c 'import sys,json,base64; print(base64.b64decode(json.load(sys.stdin)["payload"]["data"]).decode())')

NISAR_BASIC_AUTH=$(echo "$S" | json '["login"]'); export NISAR_BASIC_AUTH
CLOUDFLARE_TUNNEL_TOKEN=$(echo "$S" | json '["tunnel"]'); export CLOUDFLARE_TUNNEL_TOKEN
EARTHDATA_TOKEN=$(echo "$S" | json '["earthdata"]'); export EARTHDATA_TOKEN
NISAR_IMAGE=$(attr nisar-image); export NISAR_IMAGE
NISAR_PUBLIC_PORT=$(attr nisar-public-port); export NISAR_PUBLIC_PORT
export NISAR_DATA_DEVICE=/dev/disk/by-id/google-nisar-data
IDLE=$(attr nisar-idle-stop-minutes)
if [ -n "$IDLE" ] && [ "$IDLE" != 0 ]; then export NISAR_IDLE_STOP_MINUTES=$IDLE; fi

curl -fsSL "$(attr nisar-install-url)" -o /root/nisar-install.sh
bash /root/nisar-install.sh
