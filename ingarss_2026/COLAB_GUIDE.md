# Colab execution guide

## Hosted judge mode

Open `notebooks/NISAR_Bihar_Flood_Lifecycle.ipynb` in Colab and run all cells. The first cell clones the repository into `/content/nisar_pro`, changes into `ingarss_2026/`, and loads only packaged JSON/PNG/GeoJSON artifacts. No 7 GB HDF5 granule is required for this mode.

The notebook defaults to:

```python
RUN_MODE = "showcase"
```

This is the mode to demonstrate to judges. It reproduces the published tables and figures from the submission artifacts.

## Local-runtime mode on the RHEL workstation

Use this only for full-scene reprocessing. Start Jupyter on RHEL:

```bash
python3 -m venv ~/colab-runtime
source ~/colab-runtime/bin/activate
pip install --upgrade pip
pip install jupyter numpy matplotlib pandas h5py geopandas ipykernel

jupyter notebook \
  --port=8888 \
  --no-browser \
  --NotebookApp.allow_origin='https://colab.research.google.com' \
  --NotebookApp.allow_credentials=True \
  --NotebookApp.port_retries=0
```

For a safer Tailscale/SSH setup, forward the RHEL Jupyter port to the Windows laptop:

```powershell
ssh -N -L 8888:localhost:8888 aditya@100.124.16.11
```

In Colab choose **Connect → Connect to local runtime** and paste the token URL printed by Jupyter. Set `NISAR_RUN_MODE=local_full_scene` only when the notebook is executing on that local runtime and the granule paths are configured.

Do not share a local-runtime URL with judges. A shared notebook gives other users their own hosted runtime; it does not share your RHEL machine.

