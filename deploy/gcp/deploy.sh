#!/usr/bin/env bash
# NISAR Pro on one Google Compute Engine VM. Run in Cloud Shell (or anywhere gcloud is logged in).
#
#   ./deploy/gcp/deploy.sh            create or update
#   ./deploy/gcp/deploy.sh delete     delete the VM, firewall rules, secret and service account
#                                     (the data disk is kept; delete it yourself when done)
#
# Settings (environment variables, all optional):
#   PROJECT       default: the current gcloud project
#   ZONE          asia-south1-a (Mumbai, keeps data in India)
#   NAME          nisar-pro
#   MACHINE       n2-standard-4 (4 vCPU, 16 GB; one full L-band scene pair in about a minute)
#   DISK_GB       200 (scenes: L about 7 GB, S about 12.6 GB each, plus results)
#   SPOT          true = Spot VM (costs less; Google may stop it, and a run must be started again)
#   PUBLIC_CIDR   open port 80 to this range, e.g. 203.0.113.0/24 (empty = no public port)
#   LOGIN_PASSWORD           login for user admin (needed with PUBLIC_CIDR)
#   CLOUDFLARE_TUNNEL_TOKEN  HTTPS on your own domain with no open port (route to http://localhost:3000)
#   EARTHDATA_TOKEN          NASA Earthdata token for downloads in the app
#   IDLE_STOP_MINUTES        stop the VM after this many idle minutes (0 = never)
set -euo pipefail

PROJECT=${PROJECT:-$(gcloud config get-value project 2>/dev/null)}
ZONE=${ZONE:-asia-south1-a}
NAME=${NAME:-nisar-pro}
MACHINE=${MACHINE:-n2-standard-4}
DISK_GB=${DISK_GB:-200}
SPOT=${SPOT:-false}
PUBLIC_CIDR=${PUBLIC_CIDR:-}
IDLE_STOP_MINUTES=${IDLE_STOP_MINUTES:-0}
IMAGE=${IMAGE:-ghcr.io/adityanarayannayak-2/nisar-pro:main}
INSTALL_URL=${INSTALL_URL:-https://raw.githubusercontent.com/AdityaNarayanNayak-2/NISAR_PRO/main/deploy/vm/install.sh}
HERE=$(cd "$(dirname "$0")" && pwd)

[ -n "$PROJECT" ] || { echo "set PROJECT or run: gcloud config set project <id>" >&2; exit 1; }
SA="$NAME-vm@$PROJECT.iam.gserviceaccount.com"
SECRET="$NAME-settings"
g() { gcloud --project "$PROJECT" --quiet "$@"; }

if [ "${1:-}" = delete ]; then
  g compute instances delete "$NAME" --zone "$ZONE" || true
  g compute firewall-rules delete "$NAME-web" "$NAME-iap" 2>/dev/null || true
  g secrets delete "$SECRET" || true
  g iam service-accounts delete "$SA" || true
  echo "Deleted. The data disk $NAME-data is kept: gcloud compute disks delete $NAME-data --zone $ZONE"
  exit 0
fi

echo "Project $PROJECT, zone $ZONE, machine $MACHINE"
g services enable compute.googleapis.com secretmanager.googleapis.com iap.googleapis.com

# Service account that can read only its own settings secret.
g iam service-accounts describe "$SA" >/dev/null 2>&1 ||
  g iam service-accounts create "$NAME-vm" --display-name "NISAR Pro VM"

LOGIN=""; [ -n "${LOGIN_PASSWORD:-}" ] && LOGIN="admin:$LOGIN_PASSWORD"
SETTINGS=$(LOGIN="$LOGIN" python3 -c 'import json,os; print(json.dumps({"login":os.environ["LOGIN"],
  "tunnel":os.environ.get("CLOUDFLARE_TUNNEL_TOKEN",""),"earthdata":os.environ.get("EARTHDATA_TOKEN","")}))')
if g secrets describe "$SECRET" >/dev/null 2>&1; then
  printf %s "$SETTINGS" | g secrets versions add "$SECRET" --data-file=-
else
  printf %s "$SETTINGS" | g secrets create "$SECRET" --replication-policy automatic --data-file=-
fi
g secrets add-iam-policy-binding "$SECRET" --member "serviceAccount:$SA" --role roles/secretmanager.secretAccessor >/dev/null

# Firewall: IAP range for "gcloud compute ssh --tunnel-through-iap"; port 80 only if asked.
g compute firewall-rules describe "$NAME-iap" >/dev/null 2>&1 ||
  g compute firewall-rules create "$NAME-iap" --network default --allow tcp:22 \
    --source-ranges 35.235.240.0/20 --target-tags "$NAME" --description "SSH through Identity-Aware Proxy"
g compute firewall-rules delete "$NAME-web" 2>/dev/null || true
PORT=""
if [ -n "$PUBLIC_CIDR" ]; then
  PORT=80
  g compute firewall-rules create "$NAME-web" --network default --allow tcp:80 \
    --source-ranges "$PUBLIC_CIDR" --target-tags "$NAME" --description "NISAR Pro app"
  [ -z "$LOGIN" ] && echo "WARNING: public port without LOGIN_PASSWORD: anyone in $PUBLIC_CIDR can start runs"
fi

META="nisar-secret=projects/$PROJECT/secrets/$SECRET,nisar-image=$IMAGE,nisar-public-port=$PORT"
META="$META,nisar-idle-stop-minutes=$IDLE_STOP_MINUTES,nisar-install-url=$INSTALL_URL,enable-oslogin=TRUE"

if g compute instances describe "$NAME" --zone "$ZONE" >/dev/null 2>&1; then
  echo "VM exists: updating settings and restarting the app"
  g compute instances add-metadata "$NAME" --zone "$ZONE" --metadata "$META" \
    --metadata-from-file startup-script="$HERE/startup.sh"
  g compute ssh "$NAME" --zone "$ZONE" --tunnel-through-iap --command "sudo google_metadata_script_runner startup"
else
  SPOT_ARGS=()
  [ "$SPOT" = true ] && SPOT_ARGS=(--provisioning-model SPOT --instance-termination-action STOP)
  DISK_ARGS=(--create-disk "name=$NAME-data,size=${DISK_GB}GB,type=pd-balanced,auto-delete=no,device-name=nisar-data")
  g compute disks describe "$NAME-data" --zone "$ZONE" >/dev/null 2>&1 &&
    DISK_ARGS=(--disk "name=$NAME-data,auto-delete=no,device-name=nisar-data")   # reuse kept data
  g compute instances create "$NAME" --zone "$ZONE" --machine-type "$MACHINE" \
    --image-family ubuntu-2404-lts-amd64 --image-project ubuntu-os-cloud \
    --boot-disk-size 30GB --boot-disk-type pd-balanced "${DISK_ARGS[@]}" \
    --service-account "$SA" --scopes cloud-platform \
    --shielded-secure-boot --shielded-vtpm --shielded-integrity-monitoring \
    --tags "$NAME" "${SPOT_ARGS[@]}" \
    --metadata "$META" --metadata-from-file startup-script="$HERE/startup.sh"
fi

IP=$(g compute instances describe "$NAME" --zone "$ZONE" --format 'value(networkInterfaces[0].accessConfigs[0].natIP)')
cat <<EOF

NISAR Pro is starting (first boot takes 3-5 minutes: packages and a 140 MB image).
  Progress:   gcloud compute ssh $NAME --zone $ZONE --tunnel-through-iap -- sudo journalctl -u google-startup-scripts -f
  Open it:    gcloud compute ssh $NAME --zone $ZONE --tunnel-through-iap -- -N -L 3000:127.0.0.1:${PORT:-3000}
              then http://localhost:3000/app   (in Cloud Shell: Web Preview on port 3000)
${PORT:+  Public:     http://$IP/app
}  Delete:     $0 delete
EOF
