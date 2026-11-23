#!/usr/bin/env bash
# NISAR Pro on any Linux VM: one command, same result on AWS, Azure, GCP, Oracle or a server
# in a state data centre.
#
#   curl -fsSL https://raw.githubusercontent.com/AdityaNarayanNayak-2/NISAR_PRO/main/deploy/vm/install.sh | sudo bash
#
# Settings come from the environment (or from /etc/nisar-pro/install.env, which the cloud
# templates write). All are optional.
#
#   NISAR_IMAGE              container image (default ghcr.io/adityanarayannayak-2/nisar-pro:main)
#   NISAR_DATA_DEVICE        block device for scenes and results (or "auto": the one blank extra disk);
#                            formatted only if empty, mounted at /srv/nisar
#   NISAR_PUBLIC_PORT        publish the app on this port on all interfaces (e.g. 80).
#                            Empty: only 127.0.0.1:3000 (reach it through a tunnel or port forward)
#   NISAR_BASIC_AUTH         user:password login for the whole app (strongly advised with a public port)
#   EARTHDATA_TOKEN          NASA Earthdata token, for downloading scenes in the app
#   CLOUDFLARE_TUNNEL_TOKEN  run cloudflared: public HTTPS URL, no open port. Route the tunnel's
#                            public hostname to http://localhost:3000 in the Cloudflare dashboard
#   NISAR_BACKUP_TARGET      rclone target for results, e.g. "backup:my-bucket/nisar". Configure the
#                            remote "backup" with RCLONE_CONFIG_BACKUP_* variables (S3, R2, GCS, Azure Blob)
#   NISAR_IDLE_STOP_MINUTES  power the VM off after this many minutes with no user and no run
#                            (AWS and GCP stop billing for compute when the VM is off)
#   NISAR_STOP_MODE          "azure-deallocate": stop by deallocating through the VM's managed
#                            identity (a powered-off Azure VM is still billed). Default: power off
set -euo pipefail

[ "$(id -u)" = 0 ] || { echo "run as root (sudo)" >&2; exit 1; }
[ -f /etc/nisar-pro/install.env ] && set -a && . /etc/nisar-pro/install.env && set +a

IMAGE="${NISAR_IMAGE:-ghcr.io/adityanarayannayak-2/nisar-pro:main}"
DATA=/srv/nisar
log() { echo "[nisar-pro] $*"; }

# ── 1. Podman ────────────────────────────────────────────────────────────────
if ! command -v podman >/dev/null; then
  log "installing podman"
  if command -v apt-get >/dev/null; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -q && apt-get install -y -q podman curl
  elif command -v dnf >/dev/null; then
    dnf install -y -q podman curl
  else
    echo "no apt-get or dnf: install podman 4.4+ yourself, then run this again" >&2; exit 1
  fi
fi
PV=$(podman version --format '{{.Client.Version}}' 2>/dev/null || podman --version | awk '{print $3}')
if [ "$(printf '%s\n4.4\n' "${PV%%-*}" | sort -V | head -1)" != "4.4" ]; then
  echo "podman $PV is too old (Quadlet needs 4.4+). Use Ubuntu 24.04, Debian 13, RHEL/Rocky 9 or Fedora." >&2
  exit 1
fi

# ── 2. Data disk ─────────────────────────────────────────────────────────────
mkdir -p "$DATA"
# "auto": the one whole disk with no partitions, no filesystem in use and not holding /.
# A disk that already has a filesystem is mounted as it is, never formatted again.
find_blank_disk() {
  local root_disk
  root_disk=$(lsblk -no PKNAME "$(findmnt -no SOURCE /)" 2>/dev/null | head -1)
  lsblk -dpno NAME,TYPE | awk '$2=="disk"{print $1}' | while read -r d; do
    [ "$(basename "$d")" = "$root_disk" ] && continue
    [ "$(lsblk -no NAME "$d" | wc -l)" -eq 1 ] || continue      # has partitions
    [ -z "$(lsblk -no MOUNTPOINT "$d" | tr -d '[:space:]')" ] || continue
    case "$(blkid -s TYPE -o value "$d" 2>/dev/null)" in ""|ext4) echo "$d"; break ;; esac
  done
}
if [ "${NISAR_DATA_DEVICE:-}" = auto ] && mountpoint -q "$DATA"; then
  NISAR_DATA_DEVICE=""                                          # mounted on an earlier boot
elif [ "${NISAR_DATA_DEVICE:-}" = auto ]; then
  for _ in $(seq 1 60); do NISAR_DATA_DEVICE=$(find_blank_disk); [ -n "$NISAR_DATA_DEVICE" ] && break; sleep 5; done
  if [ -z "$NISAR_DATA_DEVICE" ]; then
    log "no spare disk found, using the boot disk"
  else
    log "data disk: $NISAR_DATA_DEVICE"
  fi
fi
if [ -n "${NISAR_DATA_DEVICE:-}" ]; then
  for _ in $(seq 1 60); do [ -b "$NISAR_DATA_DEVICE" ] && break; sleep 5; done
  [ -b "$NISAR_DATA_DEVICE" ] || { echo "data disk $NISAR_DATA_DEVICE not found" >&2; exit 1; }
  DEV=$(readlink -f "$NISAR_DATA_DEVICE")
  blkid "$DEV" >/dev/null || { log "formatting $DEV"; mkfs.ext4 -q -L nisar-data "$DEV"; }
  UUID=$(blkid -s UUID -o value "$DEV")
  grep -q "$UUID" /etc/fstab || echo "UUID=$UUID $DATA ext4 defaults,nofail 0 2" >> /etc/fstab
  mountpoint -q "$DATA" || mount "$DATA"
fi
mkdir -p "$DATA/results" "$DATA/data"
chown -R 10001:10001 "$DATA"

# ── 3. Secrets (root only, never in the unit files) ──────────────────────────
install -d -m 700 /etc/nisar-pro
umask 077
: > /etc/nisar-pro/app.env
[ -n "${EARTHDATA_TOKEN:-}" ] && echo "EARTHDATA_TOKEN=$EARTHDATA_TOKEN" >> /etc/nisar-pro/app.env
[ -n "${NISAR_BASIC_AUTH:-}" ] && echo "NISAR_BASIC_AUTH=$NISAR_BASIC_AUTH" >> /etc/nisar-pro/app.env
umask 022

if [ -n "${NISAR_PUBLIC_PORT:-}" ]; then
  PUBLISH="${NISAR_PUBLIC_PORT}:3000"
  LOCAL="http://127.0.0.1:${NISAR_PUBLIC_PORT}"
  [ -z "${NISAR_BASIC_AUTH:-}" ] && log "WARNING: public port without NISAR_BASIC_AUTH: anyone can start runs"
else
  PUBLISH="127.0.0.1:3000:3000"
  LOCAL="http://127.0.0.1:3000"
fi
echo "NISAR_LOCAL_URL=$LOCAL" > /etc/nisar-pro/local.env

# ── 4. App (Podman Quadlet: a systemd service that keeps the container running) ──
mkdir -p /etc/containers/systemd
cat > /etc/containers/systemd/nisar-pro.container <<UNIT
[Unit]
Description=NISAR Pro (engine, gateway, dashboard)
Wants=network-online.target
After=network-online.target

[Container]
ContainerName=nisar-pro
Image=$IMAGE
PublishPort=$PUBLISH
Volume=$DATA:/var/lib/nisar-pro:Z
EnvironmentFile=/etc/nisar-pro/app.env
ReadOnly=true
Tmpfs=/tmp
NoNewPrivileges=true
DropCapability=ALL
AutoUpdate=registry

[Service]
Restart=always
TimeoutStartSec=900

[Install]
WantedBy=multi-user.target
UNIT

# ── 5. Cloudflare Tunnel (optional) ──────────────────────────────────────────
if [ -n "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]; then
  umask 077; echo "TUNNEL_TOKEN=$CLOUDFLARE_TUNNEL_TOKEN" > /etc/nisar-pro/tunnel.env; umask 022
  cat > /etc/containers/systemd/nisar-tunnel.container <<UNIT
[Unit]
Description=Cloudflare Tunnel for NISAR Pro
After=nisar-pro.service

[Container]
ContainerName=nisar-tunnel
Image=docker.io/cloudflare/cloudflared:latest
Exec=tunnel --no-autoupdate run
EnvironmentFile=/etc/nisar-pro/tunnel.env
Network=host
ReadOnly=true
NoNewPrivileges=true
DropCapability=ALL
AutoUpdate=registry

[Service]
Restart=always

[Install]
WantedBy=multi-user.target
UNIT
else
  rm -f /etc/containers/systemd/nisar-tunnel.container
fi

# ── 6. Results backup to object storage (optional, hourly) ───────────────────
if [ -n "${NISAR_BACKUP_TARGET:-}" ]; then
  umask 077; env | grep '^RCLONE_CONFIG_' > /etc/nisar-pro/backup.env || true; umask 022
  cat > /etc/systemd/system/nisar-backup.service <<UNIT
[Unit]
Description=Copy NISAR Pro results to object storage
After=network-online.target

[Service]
Type=oneshot
EnvironmentFile=/etc/nisar-pro/backup.env
ExecStart=/usr/bin/podman run --rm --network host --env-file /etc/nisar-pro/backup.env \\
  -v $DATA/results:/results:ro,Z docker.io/rclone/rclone:latest \\
  copy /results $NISAR_BACKUP_TARGET --exclude ".ready-probe" --transfers 4
UNIT
  cat > /etc/systemd/system/nisar-backup.timer <<UNIT
[Unit]
Description=Hourly NISAR Pro results backup

[Timer]
OnCalendar=hourly
RandomizedDelaySec=300
Persistent=true

[Install]
WantedBy=timers.target
UNIT
  systemctl daemon-reload
  systemctl enable --now nisar-backup.timer
fi

# ── 7. Stop when idle (optional) ─────────────────────────────────────────────
if [ -n "${NISAR_IDLE_STOP_MINUTES:-}" ]; then
  cat > /usr/local/bin/nisar-idle-check <<'SCRIPT'
#!/usr/bin/env bash
# Power off when nobody has used the app for NISAR_IDLE_STOP_MINUTES and no run is going.
set -u
LIMIT=$(( ${1:-60} * 60 ))
[ "$(awk '{print int($1)}' /proc/uptime)" -gt "$LIMIT" ] || exit 0
AUTH=$(sed -n 's/^NISAR_BASIC_AUTH=//p' /etc/nisar-pro/app.env)
URL=$(sed -n 's/^NISAR_LOCAL_URL=//p' /etc/nisar-pro/local.env)
M=$(curl -fsS --max-time 10 ${AUTH:+-u "$AUTH"} "$URL/metrics") || exit 0
last=$(awk '$1=="nisar_last_activity_time_seconds"{print int($2)}' <<<"$M")
busy=$(awk '/^nisar_jobs\{status="(queued|running)"\}/{s+=$2} END{print s+0}' <<<"$M")
[ -n "$last" ] || exit 0
if [ "$busy" -eq 0 ] && [ $(( $(date +%s) - last )) -gt "$LIMIT" ]; then
  logger -t nisar-pro "idle for more than $(( LIMIT / 60 )) min, stopping"
  if [ "$(cat /etc/nisar-pro/stop-mode 2>/dev/null)" = azure-deallocate ]; then
    I=http://169.254.169.254/metadata
    T=$(curl -fsS -H Metadata:true "$I/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/" \
        | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])') &&
    ID=$(curl -fsS -H Metadata:true "$I/instance/compute/resourceId?api-version=2021-02-01&format=text") &&
    curl -fsS -X POST -H "Authorization: Bearer $T" -H "Content-Length: 0" \
      "https://management.azure.com$ID/deallocate?api-version=2024-07-01" && exit 0
    logger -t nisar-pro "deallocate failed, powering off instead"
  fi
  systemctl poweroff
fi
SCRIPT
  chmod 755 /usr/local/bin/nisar-idle-check
  echo "${NISAR_STOP_MODE:-poweroff}" > /etc/nisar-pro/stop-mode
  cat > /etc/systemd/system/nisar-idle.service <<UNIT
[Unit]
Description=Power off NISAR Pro VM when idle

[Service]
Type=oneshot
ExecStart=/usr/local/bin/nisar-idle-check $NISAR_IDLE_STOP_MINUTES
UNIT
  cat > /etc/systemd/system/nisar-idle.timer <<UNIT
[Unit]
Description=Check every 5 minutes whether NISAR Pro is idle

[Timer]
OnBootSec=10min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
UNIT
  systemctl daemon-reload
  systemctl enable --now nisar-idle.timer
fi

# ── 8. Start ─────────────────────────────────────────────────────────────────
log "pulling $IMAGE"
podman pull -q "$IMAGE" >/dev/null || podman image exists "$IMAGE" || { echo "cannot pull $IMAGE" >&2; exit 1; }
systemctl daemon-reload
systemctl restart nisar-pro.service
[ -n "${CLOUDFLARE_TUNNEL_TOKEN:-}" ] && systemctl restart nisar-tunnel.service
systemctl enable --now podman-auto-update.timer >/dev/null 2>&1 || true

for _ in $(seq 1 60); do curl -fsS "$LOCAL/readyz" >/dev/null 2>&1 && break; sleep 2; done
if curl -fsS "$LOCAL/readyz" >/dev/null 2>&1; then
  log "ready. Open: ${NISAR_PUBLIC_PORT:+http://<this-vm>:$NISAR_PUBLIC_PORT/app }${CLOUDFLARE_TUNNEL_TOKEN:+<your tunnel hostname>/app }(on the VM: $LOCAL/app)"
else
  log "not ready yet: journalctl -u nisar-pro -e" ; exit 1
fi
