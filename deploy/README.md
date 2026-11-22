# Deploying and operating NISAR Pro

One container image holds the Rust engine, the Axum gateway and the built dashboard. It runs the
same on a laptop, a single server or Kubernetes.

| Path | What it is |
|---|---|
| [`../Dockerfile`](../Dockerfile) | Multi-stage build: Rust (engine + gateway), Node (dashboard), Debian slim runtime. Non-root (uid 10001), `tini` as PID 1. |
| [`../compose.yaml`](../compose.yaml) | App + Prometheus + Grafana on one machine. |
| [`helm/nisar-pro/`](helm/nisar-pro) | Helm chart: Deployment, Service, PVC, Secret, optional Ingress, ServiceMonitor, PrometheusRule, NetworkPolicy. |
| [`monitoring/`](monitoring) | Prometheus config and alert rules, Grafana datasource and dashboard. |
| [`../.github/workflows/ci.yml`](../.github/workflows/ci.yml) | Tests, lint, Helm lint and schema check, image build, smoke test, Trivy scan, push to GHCR. |

## 1. One machine

```bash
podman build -t localhost/nisar-pro:dev .        # or docker build
podman run -d --name nisar -p 3000:3000 -v nisar:/var/lib/nisar-pro localhost/nisar-pro:dev
podman cp scene.h5 nisar:/var/lib/nisar-pro/data/  # or set EARTHDATA_TOKEN and download in the app
open http://localhost:3000/app
```

With monitoring: `podman compose up -d --build`, then Grafana on <http://localhost:3001>
(dashboard "NISAR Pro") and Prometheus on <http://localhost:9091>. Scenes in `./scenes` are
mounted read-only.

## 2. Kubernetes

```bash
helm install nisar deploy/helm/nisar-pro \
  --namespace nisar --create-namespace \
  --set persistence.size=200Gi \
  --set earthdata.existingSecret=earthdata        # Secret with key EARTHDATA_TOKEN
kubectl -n nisar port-forward svc/nisar-nisar-pro 3000:80
```

Production values: `ingress.enabled=true`, `metrics.serviceMonitor.enabled=true`,
`metrics.prometheusRule.enabled=true`, `networkPolicy.enabled=true`.

**Why one replica.** The gateway keeps the run list in memory and starts the engine as a child
process that writes to a ReadWriteOnce volume. Two replicas would not see each other's runs and
would fight over the volume, so the chart pins `replicas: 1` with `strategy: Recreate`. Scale
up, not out: more CPU and memory, and `maxConcurrentJobs`. A queue-and-worker split (engine
runs as Kubernetes Jobs, results in object storage) is the next step for many districts at once.

**Sizing.** One full L-band scene pair: about 1 minute on 4 cores, under 2.5 GB RAM. One L-band
GCOV scene is about 7 GB on disk, S-band about 12.6 GB.

## 3. Configuration

| Variable | Default (image) | Meaning |
|---|---|---|
| `NISAR_PORT` | `3000` | HTTP port |
| `NISAR_BIND` | `0.0.0.0` | Listen address (`127.0.0.1` keeps it on the machine) |
| `NISAR_PROCESSOR` | `/usr/local/bin/sar_science_processor` | Engine binary |
| `NISAR_DASHBOARD_DIR` | `/opt/nisar-pro/dashboard` | Built dashboard |
| `NISAR_DATA_DIRS` | `/var/lib/nisar-pro/data` | Where scenes are listed from (`:`-separated) |
| `MAX_CONCURRENT_JOBS` | `1` | Engine runs at once |
| `EARTHDATA_TOKEN` | — | NASA Earthdata token for downloads (search works without it) |
| `RUST_LOG` | `info` | Log level |

State lives under `/var/lib/nisar-pro`: `results/jobs/<id>/` per run, `results/geocode_cache.json`,
`data/` for scenes. Back up `results/`; scenes can be downloaded again.

## 4. Health and metrics

| Endpoint | Use |
|---|---|
| `GET /healthz` | Liveness: the process answers. |
| `GET /readyz` | Readiness: engine binary found and `results/` writable (503 otherwise, JSON says which). |
| `GET /metrics` | Prometheus text format. |

Metrics: `nisar_jobs{status}`, `nisar_processor_free_slots`, `nisar_engine_ready`,
`nisar_runs_started_total`, `nisar_runs_completed_total`, `nisar_runs_failed_total`,
`nisar_runs_reused_total`, `nisar_run_duration_seconds` (histogram), `nisar_http_responses_total{class}`,
`nisar_build_info{version}`, `nisar_process_start_time_seconds`.

Alerts (both `monitoring/alerts.yml` and the chart's PrometheusRule): gateway down, engine
missing, more than 2 failed runs per hour, p90 run time over 5 minutes, more than 3 runs queued.

## 5. Runbook

| Symptom | Check | Fix |
|---|---|---|
| Pod not Ready | `curl /readyz` | `engine: false`: wrong `NISAR_PROCESSOR`. `results_writable: false`: volume permissions (`fsGroup: 10001`). |
| Runs fail at once | Run log in the dashboard, `kubectl logs` | Scene files missing or unreadable; band/track/frame mismatch is reported in the log. |
| Runs killed | `kubectl describe pod` shows `OOMKilled` | Raise `resources.limits.memory`, or lower `maxConcurrentJobs`. |
| Runs queue up | `nisar_jobs{status="queued"}` | Raise `maxConcurrentJobs` together with CPU and memory. |
| Download 401 | `/asf/auth-status` | Earthdata token missing or expired; update the Secret and restart. |
| Live log stops behind a proxy | Ingress annotations | Server-Sent Events need `proxy-buffering: off` and a long read timeout (set by the chart). |

On SIGTERM the gateway stops accepting requests and exits; a run that was in progress is marked
"interrupted" on the next start and can be started again.
