# Deploying and operating NISAR Pro

One container image holds the Rust engine, the Axum gateway and the built dashboard. It runs the
same on a laptop, a single server or Kubernetes.

| Path | What it is |
|---|---|
| [`../Dockerfile`](../Dockerfile) | Multi-stage build: Rust (engine + gateway), Node (dashboard), Debian slim runtime. Non-root (uid 10001), `tini` as PID 1. |
| [`../compose.yaml`](../compose.yaml) | App + Prometheus + Grafana on one machine. |
| [`helm/nisar-pro/`](helm/nisar-pro) | Helm chart: gateway, PVC, Secret, optional Ingress, ServiceMonitor, PrometheusRule, NetworkPolicy; queue mode adds Redis and workers (KEDA ScaledJob or Deployment). |
| [`monitoring/`](monitoring) | Prometheus config and alert rules, Grafana datasource and dashboard. |
| [`vm/install.sh`](vm/install.sh) | One installer for any Linux VM (Ubuntu 24.04, Debian 13, RHEL/Rocky 9, Fedora). Every cloud template below runs it. |
| [`aws/`](aws), [`azure/`](azure), [`gcp/`](gcp) | One-click VM: CloudFormation, Bicep/ARM ("Deploy to Azure"), Cloud Shell script. |
| [`../compose.queue.yaml`](../compose.queue.yaml) | Adds Redis and engine workers to `compose.yaml` (queue mode on one machine). |
| [`terraform/k8s-eks`](terraform/k8s-eks), [`k8s-aks`](terraform/k8s-aks), [`k8s-gke`](terraform/k8s-gke) | Production clusters: shared storage, Spot engine nodes from 0, KEDA, the chart in queue mode. |
| [`argocd/`](argocd) | Argo CD Applications for KEDA and NISAR Pro (GitOps). |
| [`../.github/workflows/ci.yml`](../.github/workflows/ci.yml) | Tests, lint, Helm lint and schema check, image build, smoke test, Trivy scan, push to GHCR. |

## 1. One machine

### Any Linux VM

```bash
curl -fsSL https://raw.githubusercontent.com/AdityaNarayanNayak-2/NISAR_PRO/main/deploy/vm/install.sh | sudo bash
```

It installs Podman, runs the app as a systemd service (Podman Quadlet: non-root, read-only,
all capabilities dropped, auto-updated from the registry) and only listens on `127.0.0.1:3000`
unless you ask for a public port. Settings are environment variables (or
`/etc/nisar-pro/install.env`):

| Variable | Effect |
|---|---|
| `NISAR_DATA_DEVICE` | Disk for scenes and results, mounted at `/srv/nisar`. `auto` picks the one blank extra disk. A disk that has a filesystem is never formatted. |
| `NISAR_PUBLIC_PORT` | Publish on this port on all interfaces (e.g. `80`). |
| `NISAR_BASIC_AUTH` | `user:password` login for the whole app (`/healthz`, `/readyz` stay open). Use it with a public port. |
| `EARTHDATA_TOKEN` | NASA Earthdata token for downloads in the app. |
| `CLOUDFLARE_TUNNEL_TOKEN` | Runs `cloudflared`: HTTPS on your domain, no open port. |
| `NISAR_BACKUP_TARGET` + `RCLONE_CONFIG_BACKUP_*` | Hourly copy of `results/` to S3, R2, GCS or Azure Blob with rclone. |
| `NISAR_IDLE_STOP_MINUTES` | Stop the VM after this many minutes with no user and no run (uses `nisar_last_activity_time_seconds` and `nisar_jobs`). |
| `NISAR_STOP_MODE` | `azure-deallocate` on Azure (a powered-off Azure VM is still billed). |

Secrets are written to `/etc/nisar-pro/*.env` (root, mode 600), never into unit files.

Offline (state data centre): `podman save ghcr.io/adityanarayannayak-2/nisar-pro:main -o nisar.tar`
on a connected machine, `podman load -i nisar.tar` on the server, then run the installer with
`NISAR_IMAGE` set to the loaded name.

### AWS

```bash
# AWS CloudShell, or any shell with the AWS CLI
curl -fsSLO https://raw.githubusercontent.com/AdityaNarayanNayak-2/NISAR_PRO/main/deploy/aws/nisar-pro.cfn.yaml
aws cloudformation deploy --region ap-south-1 --stack-name nisar-pro \
  --template-file nisar-pro.cfn.yaml --capabilities CAPABILITY_IAM \
  --parameter-overrides IdleStopMinutes=60 UseSpot=false
aws cloudformation describe-stacks --region ap-south-1 --stack-name nisar-pro --query 'Stacks[0].Outputs'
```

Or in the console: CloudFormation, Create stack, upload `aws/nisar-pro.cfn.yaml`. Secrets go to
Secrets Manager and are read at boot with the instance role. The data volume is encrypted, and a
snapshot is kept when the stack is deleted. No SSH; the `PortForward` output opens the app on
`localhost:3000` through Systems Manager. A "Launch Stack" link needs the template in an S3
bucket; host it there to get a true one-click link.

### Azure

The **Deploy to Azure** button on the website opens
`https://portal.azure.com/#create/Microsoft.Template/uri/<url-encoded raw azuredeploy.json>`.
`azure/azuredeploy.json` is built from `azure/main.bicep` (`az bicep build --file main.bicep
--outfile azuredeploy.json`; CI checks they match). Ubuntu 24.04 with Trusted Launch, a data disk
kept when the VM is deleted, optional Spot, daily auto-shutdown, and with `idleStopMinutes` a
managed identity that may deallocate only this VM.

### Google Cloud

The **Open in Google Cloud** button opens Cloud Shell with `gcp/tutorial.md`. Or directly:

```bash
SPOT=true IDLE_STOP_MINUTES=60 ./deploy/gcp/deploy.sh      # create or update
./deploy/gcp/deploy.sh delete                              # keeps the data disk
```

Settings go to Secret Manager; a dedicated service account can read only that secret. Access
through IAP (`gcloud compute ssh --tunnel-through-iap -- -L 3000:127.0.0.1:3000`), no open port
unless `PUBLIC_CIDR` is set.

### Cheap and reliable: Cloudflare in front

1. Create a tunnel in Cloudflare Zero Trust (Networks, Tunnels) and copy its token. Add a public
   hostname, e.g. `nisar.example.org`, pointing to `http://localhost:3000`.
2. Add a Cloudflare Access application for that hostname (email one-time code). This is the login;
   `NISAR_BASIC_AUTH` is then optional.
3. Deploy with `CLOUDFLARE_TUNNEL_TOKEN` set, no public port, `NISAR_IDLE_STOP_MINUTES=60`, and
   optionally Spot. Add `NISAR_BACKUP_TARGET` with an R2 bucket (R2 charges nothing for downloads).

The VM has no open port, stops itself when idle, and the dashboard is served over HTTPS. Start
it again from the cloud console when needed.

### With monitoring on one machine

`podman compose up -d --build`, then Grafana on <http://localhost:3001>
(dashboard "NISAR Pro") and Prometheus on <http://localhost:9091>. Scenes in `./scenes` are
mounted read-only.

## 2. Watching areas (continuous monitoring)

Add an area in the dashboard (Watch tab) or by API. Every `NISAR_WATCH_INTERVAL_MINUTES` the
gateway searches ASF for L2 GCOV passes over each area, pairs the newest pass of each band, track
and frame with the one before, downloads what is missing (needs `EARTHDATA_TOKEN`), runs the
engine (full scene, swath-edge erosion 40, so an identical earlier run is reused) and sums the
regions whose centre lies inside the area. At or above the area's alert level it posts to the
area's webhook and Telegram chat.

| Endpoint | Use |
|---|---|
| `GET /watch` | Areas (secrets shown only as `has_webhook`, `has_telegram`) and the latest results. |
| `POST /watch/areas` | Create or update: `{"name", "bbox": [w, s, e, n], "band", "track", "frame", "alert_km2", "end_date", "webhook_url", "telegram_bot_token", "telegram_chat_id"}`. At most 5° a side. Empty secret fields keep the stored value. |
| `DELETE /watch/areas/<id>` | Stop watching (results stay). |
| `POST /watch/areas/<id>/check` | Check now. |
| `GET /watch/feed.xml` | Atom feed of alerts; each entry links its CAP 1.2 alert. |
| `GET /watch/cap/<event>.xml` | CAP 1.2 alert (validated against the OASIS schema): headline, plain message, polygon, flood extent km² and acres, dates, band. Certainty `Possible`: radar only, not confirmed on the ground. |
| `GET /stac`, `GET /stac/items/<run>` | STAC 1.0 catalog: one item per finished run with footprint, dates, flood extent and links to the class GeoTIFF, regions GeoJSON, report and overlay. |

| Variable | Default | Meaning |
|---|---|---|
| `NISAR_WATCH` | on | `off` disables the background checks (API still works). |
| `NISAR_WATCH_INTERVAL_MINUTES` | `180` | How often all areas are checked. |
| `NISAR_WATCH_LOOKBACK_DAYS` | `40` | How far back the catalog search goes (NISAR repeats a track every 12 days). |
| `NISAR_PUBLIC_URL` | — | Base URL for links in messages and feeds (e.g. your tunnel hostname). |
| `NISAR_CAP_SENDER` | `nisar-pro` | CAP `sender`. |

Webhooks must be `https://` (plain `http://` only to `localhost`). The message has a `text` field
(Slack, Mattermost, Google Chat), a `content` field (Discord) and the full `event`. `end_date` on
an area limits it to passes up to that date: replay a past season.

State: `results/watch/areas.json`, `results/watch/events.json`.

## 3. Kubernetes

### Simple: one pod

```bash
helm install nisar deploy/helm/nisar-pro \
  --namespace nisar --create-namespace \
  --set persistence.size=200Gi \
  --set earthdata.existingSecret=earthdata        # Secret with key EARTHDATA_TOKEN
kubectl -n nisar port-forward svc/nisar-nisar-pro 3000:80
```

Without the queue the gateway keeps the run list in memory and starts the engine as a child
process, so the chart pins `replicas: 1`, `strategy: Recreate` and a ReadWriteOnce volume. Scale
up (CPU, memory, `maxConcurrentJobs`), not out.

### Production: queue and workers

```
            ┌──────────── gateway ×2 ────────────┐        ┌──── KEDA ────┐
 browser ──▶│ API + dashboard, no engine runs    │──LPUSH─▶ Redis list   │ ScaledJob: one
            │ every copy gets all events (Pub/Sub)│◀─events─┤ nisar:queue  │ Kubernetes Job
            └────────────────┬───────────────────┘        └──────┬───────┘ per waiting run
                             │ ReadWriteMany volume (scenes + runs)│
                             └──────────── worker Job: sar-gateway worker --once (engine)
```

```bash
helm install nisar deploy/helm/nisar-pro -n nisar --create-namespace \
  --set queue.enabled=true --set gateway.replicas=2 \
  --set worker.mode=keda --set worker.maxReplicas=4 \
  --set persistence.accessModes={ReadWriteMany} --set persistence.storageClass=<rwx class>
```

- `POST /jobs` puts the run in Redis (`nisar:queue`) and answers at once. Gateways do not run the
  engine; their pods need 100m CPU and 128 MB.
- KEDA reads the list length and starts one Job per waiting run, up to `worker.maxReplicas`.
  Each Job runs `sar-gateway worker --once`: it takes one run (`BLMOVE` to `nisar:running`, so
  no two workers get the same run), runs the engine, writes the results to the shared volume and
  exits. A ScaledJob is used, not a Deployment, so scaling in never kills a run that is going.
- Each worker holds a 60 s lease on its run, renewed every 20 s. If the pod dies (Spot node
  taken back, OOM), the lease runs out and the gateway puts the run back in the queue; after 3
  losses it marks it failed. On SIGTERM (node drain) the worker stops the engine and puts the
  run back at once.
- Every gateway copy subscribes to the worker events (`nisar:events`), so the run list, queue
  places and live logs are the same on all copies. Watch checks and the reaper run on one copy
  at a time (Redis lock).
- `worker.mode=deployment` gives always-on workers without KEDA. `queue.externalUrl` uses a
  managed Redis (then set `queue.kedaAddress` too).

Tested on this computer with Redis in a container, one gateway and two workers (processes):
two runs at the same time with the rest waiting in order; a worker killed with `kill -9`
mid-run (its run went back to the queue after the lease ran out and the other worker finished
it); a worker stopped with SIGTERM mid-run (the run moved to the other worker at once); cancel
while waiting and while running; a second gateway copy showing the same runs. The chart
renders and passes the Kubernetes and KEDA schemas (`kubeconform`) for all `ci-values`. Not yet
run on a real cluster.

### Clusters with Terraform

| Folder | Cloud | Shared files (ReadWriteMany) | KEDA | Engine nodes |
|---|---|---|---|---|
| [`terraform/k8s-eks`](terraform/k8s-eks) | AWS EKS | EFS (elastic throughput) | Helm chart | Spot node group 0–4, Cluster Autoscaler |
| [`terraform/k8s-aks`](terraform/k8s-aks) | Azure AKS | Azure Files (`azurefile-csi`) | AKS add-on | Spot node pool 0–4, AKS autoscaler |
| [`terraform/k8s-gke`](terraform/k8s-gke) | Google GKE | Filestore (`standard-rwx`, 1 TiB minimum) | Helm chart | Spot node pool 0–4, GKE autoscaler |

```bash
cd deploy/terraform/k8s-eks && terraform init && terraform apply
$(terraform output -raw kubeconfig_command)
kubectl -n nisar-pro port-forward svc/nisar-pro 3000:80
```

Engine nodes carry a taint that only worker pods tolerate, so the gateway, Redis and KEDA stay
on the small system node and engine nodes exist only while runs do. All three pass
`terraform validate` in CI; none has been applied yet.

### GitOps with Argo CD

[`argocd/`](argocd) holds two Applications: KEDA (official chart) and NISAR Pro (this chart on
`main`). Argo CD keeps the cluster equal to Git, so a merged change to `deploy/helm` is rolled
out without anyone running `helm`.

```bash
kubectl apply -n argocd -f deploy/argocd/keda.yaml -f deploy/argocd/nisar-pro.yaml
```

**Sizing.** One full L-band scene pair: about 25 s on 4 cores, about 1 GB peak RAM. One L-band
GCOV scene is about 7 GB on disk, S-band about 12.6 GB.

### Queue on one machine (compose)

```bash
podman compose -f compose.yaml -f compose.queue.yaml up -d --scale worker=2
```

## 4. Public demo: visitors queue runs on your machine

`NISAR_PUBLIC_MODE=on` lets anyone with the link start a run, safely, on the scenes already on
the machine. Put a Cloudflare Tunnel in front (§1) so no port is open.

| Visitors can | Visitors cannot |
|---|---|
| See every run, map and report | Use their own files, GUNW or water masks |
| Start a run: pick two scenes from the list, an area, band and thresholds | Delete, cancel, upload, download from NASA, edit Watch areas |
| See their place in the queue | Have more than `NISAR_PUBLIC_RUNS_PER_VISITOR` runs waiting (default 1) |
| Get an identical finished run back at once (not counted) | Queue more when `NISAR_PUBLIC_QUEUE_MAX` runs wait (default 20) |

Admin actions need the `NISAR_BASIC_AUTH` login; without it nobody can do them. A visitor is
told by address (`CF-Connecting-IP` behind Cloudflare). `GET /config` returns the mode, whether
the caller is admin, the limits and how many runs wait, for the dashboard.

## 5. Configuration

| Variable | Default (image) | Meaning |
|---|---|---|
| `NISAR_PORT` | `3000` | HTTP port |
| `NISAR_BIND` | `0.0.0.0` | Listen address (`127.0.0.1` keeps it on the machine) |
| `NISAR_PROCESSOR` | `/usr/local/bin/sar_science_processor` | Engine binary |
| `NISAR_DASHBOARD_DIR` | `/opt/nisar-pro/dashboard` | Built dashboard |
| `NISAR_DATA_DIRS` | `/var/lib/nisar-pro/data` | Where scenes are listed from (`:`-separated) |
| `MAX_CONCURRENT_JOBS` | `1` | Engine runs at once |
| `EARTHDATA_TOKEN` | — | NASA Earthdata token for downloads (search works without it) |
| `NISAR_BASIC_AUTH` | — | `user:password`: HTTP Basic login for everything except `/healthz` and `/readyz` (in public mode: admin actions only) |
| `NISAR_QUEUE_URL` | — | `redis://host:6379`: runs go to Redis and `sar-gateway worker` processes run them (§3) |
| `NISAR_WORKER_IDLE_EXIT_SECONDS` | `30` | `worker --once`: exit when the queue stays empty this long |
| `NISAR_PUBLIC_MODE` | off | `on`: visitors may queue runs without login (§4) |
| `NISAR_PUBLIC_RUNS_PER_VISITOR` | `1` | Runs one visitor may have waiting or running |
| `NISAR_PUBLIC_QUEUE_MAX` | `20` | Runs waiting or running before visitors are asked to come back |
| `RUST_LOG` | `info` | Log level |

State lives under `/var/lib/nisar-pro`: `results/jobs/<id>/` per run, `results/geocode_cache.json`,
`data/` for scenes. Back up `results/`; scenes can be downloaded again.

## 6. Health and metrics

| Endpoint | Use |
|---|---|
| `GET /healthz` | Liveness: the process answers. |
| `GET /readyz` | Readiness: engine binary found and `results/` writable (503 otherwise, JSON says which). |
| `GET /metrics` | Prometheus text format. |

Metrics: `nisar_jobs{status}`, `nisar_processor_free_slots`, `nisar_engine_ready`,
`nisar_runs_started_total`, `nisar_runs_completed_total`, `nisar_runs_failed_total`,
`nisar_runs_reused_total`, `nisar_last_activity_time_seconds`, `nisar_queue_enabled`,
`nisar_queue_waiting`, `nisar_queue_taken`, `nisar_run_duration_seconds` (histogram), `nisar_http_responses_total{class}`,
`nisar_build_info{version}`, `nisar_process_start_time_seconds`.

Alerts (both `monitoring/alerts.yml` and the chart's PrometheusRule): gateway down, engine
missing, more than 2 failed runs per hour, p90 run time over 5 minutes, more than 3 runs queued.

## 7. Runbook

| Symptom | Check | Fix |
|---|---|---|
| Pod not Ready | `curl /readyz` | `engine: false`: wrong `NISAR_PROCESSOR`. `results_writable: false`: volume permissions (`fsGroup: 10001`). |
| Runs fail at once | Run log in the dashboard, `kubectl logs` | Scene files missing or unreadable; band/track/frame mismatch is reported in the log. |
| Runs killed | `kubectl describe pod` shows `OOMKilled` | Raise `resources.limits.memory`, or lower `maxConcurrentJobs`. |
| Runs queue up | `nisar_jobs{status="queued"}` | Raise `maxConcurrentJobs` together with CPU and memory. |
| Download 401 | `/asf/auth-status` | Earthdata token missing or expired; update the Secret and restart. |
| Watched area stays "Waiting" | Watch tab, `GET /watch` | A pass is not on disk and `EARTHDATA_TOKEN` is not set, or the download failed (message says which). |
| No alert arrives | Result shows "alert (no channel set)" or no "sent to" | Add a webhook or Telegram chat to the area; check the gateway log for the HTTP status. |
| Runs stay "queued" (queue mode) | `nisar_queue_waiting`, `kubectl get scaledjob,jobs` | No worker: KEDA not installed, `worker.maxReplicas` reached, or engine nodes cannot start (Spot capacity). `kubectl describe scaledjob`. |
| Run went back to the queue | Run log: "The worker stopped" | Worker pod was killed (Spot reclaim, OOM, drain). It is retried twice, then failed. |
| Worker Job fails at once | `kubectl logs job/...` | Cannot reach Redis (`NISAR_QUEUE_URL`), or the shared volume is not mounted (`results/` must be the gateway's). |
| Visitors get 429 | Public mode limits | One run per visitor, `NISAR_PUBLIC_QUEUE_MAX` in total. Raise them or add workers. |
| Live log stops behind a proxy | Ingress annotations | Server-Sent Events need `proxy-buffering: off` and a long read timeout (set by the chart). |

On SIGTERM the gateway stops accepting requests and exits; a run that was in progress is marked
"interrupted" on the next start and can be started again.
