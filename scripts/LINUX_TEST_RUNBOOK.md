# Linux Verification Runbook — NISAR Pro windowed reader

Target: ThinkCentre mini PC, RHEL 10, 16 GB RAM (LAN, always on).
Purpose: re-run the full verification suite on Linux so every published number
(32.3 MB, 0.124 s, 116 checks) is backed by **two operating systems**, not
just the Windows laptop this repo was developed on.

Hand this file to whatever agent/shell runs on that machine. Every command is
copy-paste. Nothing here commits, pushes, or modifies the repo.

Reference results this run must reproduce (Windows laptop, release build):

| Check | Windows result |
|---|---|
| `cargo test` | 56/56 pass |
| `gcov_verify` | 21/21 goldens pass |
| `gcov_fixture_verify` | 8/8 pass |
| `gcov_diff` | 32/32 windows pass |
| `gcov_measure` bars | peak < 300 MB PASS, cold < 2 s PASS |
| peak memory metric | 32.3 MB (Windows commit) |

---

## 0. One-time setup

```bash
# toolchain (skip if already present)
sudo dnf install -y git gcc make curl
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"

# code
git clone -b dev https://gitlab.com/Aditya-Narayan-Nayak/nisar_pro.git ~/nisar_pro
cd ~/nisar_pro
cargo --version    # expect 1.70+
```

## 1. Get the data (7 GB, one time)

The goldens in `Download/gcov/goldens/` are tied to this exact granule:

```
NISAR_L2_PR_GCOV_028_062_D_075_4005_DHDH_A_20260817T121708_20260817T121743_P05023_N_F_J_001.h5
```

**Option A — copy from the Windows laptop over LAN (preferred, no auth needed).**
Run on the Windows laptop (OpenSSH `scp` ships with Windows 11):

```powershell
# adjust user@<thinkcentre-ip>
scp "D:\nisar\nisar_pro\Download\gcov\NISAR_L2_PR_GCOV_028_062_D_075_4005_DHDH_A_20260817T121708_20260817T121743_P05023_N_F_J_001.h5" user@host:nisar_pro/Download/gcov/
scp "D:\nisar\nisar_pro\Download\gcov\goldens\*" user@host:nisar_pro/Download/gcov/goldens/
```

**Option B — re-download from ASF** with an Earthdata Application Token
(`scripts/fetch_nisar_gcov.ps1` documents the auth flow; on Linux use `curl`
with `Authorization: Bearer $EARTHDATA_TOKEN`). Only needed if Option A is
unavailable.

Verify layout:

```bash
cd ~/nisar_pro
ls -lh Download/gcov/*.h5
ls Download/gcov/goldens/   # expect goldens.tsv, fixture_missing_chunks.h5, fixture_missing_chunks.tsv
```

## 2. Unit tests (expect 56/56)

```bash
cd ~/nisar_pro/sar_science_processor
cargo test --release 2>&1 | tail -20
```

Two tests are Linux-relevant and must pass:
- `read_system_memory_returns_sane_values` — proves `/proc/meminfo` is parsed
  (this is what `guard_allocation` uses on Linux).
- `guard_allocation_blocks_absurd_request` — proves a 10 TiB request is
  **blocked**, i.e. the guard fails closed on this OS.

Targeted run with output:

```bash
cargo test --release guard_allocation -- --nocapture
cargo test --release read_system_memory -- --nocapture
```

## 3. Independent-oracle suite (expect 21 + 8 + 32 = 61 checks)

```bash
cd ~/nisar_pro/sar_science_processor
GRANULE="../Download/gcov/NISAR_L2_PR_GCOV_028_062_D_075_4005_DHDH_A_20260817T121708_20260817T121743_P05023_N_F_J_001.h5"
GOLDENS="../Download/gcov/goldens"
A="/science/LSAR/GCOV/grids/frequencyA/HHHH"
B="/science/LSAR/GCOV/grids/frequencyB/HHHH"

# 21 real-file goldens vs precomputed libhdf5 hashes
cargo run --release --bin gcov_verify -- "$GRANULE" "$GOLDENS"
# expect: passed 21, failed 0        (exit 0)

# 8 synthetic fixture windows incl. missing/masked chunks
cargo run --release --bin gcov_fixture_verify -- "$GOLDENS/fixture_missing_chunks.h5" "$GOLDENS/fixture_missing_chunks.tsv"
# expect: passed 8, failed 0         (exit 0)

# 32 full-read-vs-crop differentials on the small frequencyB band
cargo run --release --bin gcov_diff -- "$GRANULE" "$B"
# expect: windows compared: 32  failed: 0   (exit 0)
```

Any non-zero exit = FAIL. Capture the whole output.

## 4. Memory + timing bars (the actual benchmark)

```bash
cd ~/nisar_pro/sar_science_processor
GRANULE="../Download/gcov/NISAR_L2_PR_GCOV_028_062_D_075_4005_DHDH_A_20260817T121708_20260817T121743_P05023_N_F_J_001.h5"

cargo run --release --bin gcov_measure -- "$GRANULE" "/science/LSAR/GCOV/grids/frequencyA/HHHH" 10850 12850 4119 6119
```

Expected:

```
metric   : peak RSS (Linux VmHWM, includes mmap'd file pages)
...
pass bars:
  peak memory  XX.X MB < 300.0 MB   PASS
  cold read    0.XXX s < 2.0 s      PASS
```

**How to read the Linux number honestly:**
- Windows reported **commit (PrivateUsage)** = 32.3 MB. That excludes pages
  memory-mapped from the granule file.
- Linux reports **peak RSS (VmHWM)** = same process, but *includes* the mmap'd
  file pages it touched (~12–20 MB of chunk data) plus the binary's own RSS.
  Expect roughly **45–70 MB**, not 32.3 — higher is normal, not a regression.
- Both are judged against the same **300 MB** bar. Do not compare the two
  numbers directly to each other; compare each to its bar.
- Timing expectation: cold < 2 s (Windows: 0.124 s). The ThinkCentre may be
  slower; the bar is the contract, not the exact millisecond.

## 5. Optional extras

```bash
# chunk grid sanity: expect 66 x 67 = 4422 chunks on frequencyA
cargo run --release --bin gcov_fingerprint -- "$GRANULE"

# probe one decoded chunk (writes nothing)
cargo run --release --bin gcov_probe_chunk -- "$GRANULE" "/science/LSAR/GCOV/grids/frequencyA/HHHH" 11000 4200
```

## 6. Collect results

```bash
cd ~/nisar_pro/sar_science_processor
mkdir -p ~/linux_verify_results
{
  echo "=== system ==="; uname -a; lscpu | head -15; free -h
  echo "=== unit tests ==="; cargo test --release 2>&1 | tail -5
  echo "=== gcov_verify ==="; cargo run --release --bin gcov_verify -- "../Download/gcov/NISAR_L2_PR_GCOV_028_062_D_075_4005_DHDH_A_20260817T121708_20260817T121743_P05023_N_F_J_001.h5" "../Download/gcov/goldens"
  echo "=== gcov_fixture_verify ==="; cargo run --release --bin gcov_fixture_verify -- "../Download/gcov/goldens/fixture_missing_chunks.h5" "../Download/gcov/goldens/fixture_missing_chunks.tsv"
  echo "=== gcov_diff ==="; cargo run --release --bin gcov_diff -- "../Download/gcov/NISAR_L2_PR_GCOV_028_062_D_075_4005_DHDH_A_20260817T121708_20260817T121743_P05023_N_F_J_001.h5" "/science/LSAR/GCOV/grids/frequencyB/HHHH"
  echo "=== gcov_measure ==="; cargo run --release --bin gcov_measure -- "../Download/gcov/NISAR_L2_PR_GCOV_028_062_D_075_4005_DHDH_A_20260817T121708_20260817T121743_P05023_N_F_J_001.h5" "/science/LSAR/GCOV/grids/frequencyA/HHHH" 10850 12850 4119 6119
} 2>&1 | tee ~/linux_verify_results/run_$(date +%Y%m%d_%H%M).txt
```

Paste that file back. Success = every `failed: 0`, `56/56`, and both bars
`PASS`.

## Notes

- `Download/`, `*.h5` are gitignored — the 7 GB granule never enters git.
- Do **not** commit anything from this run; it is verification only.
- Full-band read (4,386.7 MB) is deliberately **never** executed — the point
  of the reader is that the code path does not exist.
