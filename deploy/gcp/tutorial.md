# Deploy NISAR Pro on Google Cloud

One VM runs the engine, gateway and dashboard. Scenes and results sit on a separate disk that is
kept if you delete the VM.

## Pick the project

<walkthrough-project-setup billing="true"></walkthrough-project-setup>

```bash
gcloud config set project <walkthrough-project-id/>
```

## Choose settings (all optional)

```bash
export ZONE=asia-south1-a          # Mumbai: data stays in India
export MACHINE=n2-standard-4       # 4 vCPU, 16 GB
export SPOT=false                  # true costs less; Google may stop the VM
export IDLE_STOP_MINUTES=60        # stop the VM when nobody uses it (0 = never)
# export EARTHDATA_TOKEN=...       # to download NASA scenes inside the app
# export PUBLIC_CIDR=203.0.113.0/24 LOGIN_PASSWORD=...   # public port 80 with a login
# export CLOUDFLARE_TUNNEL_TOKEN=...                     # or HTTPS on your domain, no open port
```

## Deploy

```bash
./deploy/gcp/deploy.sh
```

When it finishes, open the app through a secure tunnel:

```bash
gcloud compute ssh nisar-pro --zone $ZONE --tunnel-through-iap -- -N -L 3000:127.0.0.1:3000
```

Then click <walkthrough-web-preview-icon></walkthrough-web-preview-icon> **Web Preview → Preview on
port 3000** and add `/app` to the address.

## Remove it

```bash
./deploy/gcp/deploy.sh delete
```

The data disk `nisar-pro-data` is kept so your scenes and runs survive. Delete it when you no
longer need it.
