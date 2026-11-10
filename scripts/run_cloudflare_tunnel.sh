#!/usr/bin/env bash
# NISAR Pro — Cloudflare Tunnel Supervisor
# Exposes local sar-gateway (port 3000) to the public internet via Cloudflare Tunnel.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="${ROOT_DIR}/gateway_tunnel.log"
URL_FILE="${ROOT_DIR}/tunnel_url.txt"

echo "[$(date)] Starting Cloudflare Tunnel supervisor for http://localhost:3000..." >> "${LOG_FILE}"

# If a permanent Cloudflare Tunnel token is provided in .env, use that instead of quick tunnel
if [[ -n "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]]; then
    echo "[$(date)] Launching authenticated named tunnel with CLOUDFLARE_TUNNEL_TOKEN..." >> "${LOG_FILE}"
    exec cloudflared tunnel run --token "${CLOUDFLARE_TUNNEL_TOKEN}"
fi

# Otherwise, launch Quick Tunnel (trycloudflare.com)
while true; do
    echo "[$(date)] Requesting trycloudflare tunnel..." >> "${LOG_FILE}"
    
    # Run cloudflared in a subshell, pipe stderr to both log and a parser loop
    cloudflared tunnel --url http://localhost:3000 2>&1 | while IFS= read -r line; do
        echo "$line" >> "${LOG_FILE}"
        if [[ "$line" =~ (https://[a-zA-Z0-9-]+\.trycloudflare\.com) ]]; then
            TUNNEL_URL="${BASH_REMATCH[1]}"
            echo "${TUNNEL_URL}" > "${URL_FILE}"
            echo "[$(date)] 🚀 ACTIVE CLOUDFLARE TUNNEL URL: ${TUNNEL_URL}" >> "${LOG_FILE}"
            echo "🚀 Active Cloudflare Tunnel URL: ${TUNNEL_URL}"
        fi
    done

    echo "[$(date)] Tunnel disconnected, reconnecting in 5 seconds..." >> "${LOG_FILE}"
    sleep 5
done

