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

## Capture final RHEL provenance before submission

Tailscale makes the RHEL host reachable, but it does not automatically grant
SSH login. After the final Bihar run on RHEL, run this locally on that machine
to record the exact Git commit, processor hash, input-granule hashes, output
hashes, and runtime details:

```bash
cd ~/Desktop/sar_analyzer
chmod +x ingarss_2026/scripts/capture_rhel_provenance.sh
./ingarss_2026/scripts/capture_rhel_provenance.sh \
  "$PWD" \
  /home/aditya/Desktop/nisar_data/NISAR_L2_PR_GCOV_030_098_A_014_4005_DHDH_A_20260912T233810_20260912T233845_P05023_N_F_J_001.h5 \
  /home/aditya/Desktop/nisar_data/NISAR_L2_PR_GCOV_029_098_A_014_4005_DHDH_A_20260831T233810_20260831T233845_P05023_N_F_J_001.h5 \
  "$PWD/sar_science_processor/target/release/sar_science_processor" \
  "$PWD/sar-gateway/results" \
  "$PWD/ingarss_2026/results/rhel_provenance_final.txt"
```

Copy only `rhel_provenance_final.txt` back into the repository/package. Do
not upload the multi-gigabyte `.h5` granules unless the organisers request
them.
