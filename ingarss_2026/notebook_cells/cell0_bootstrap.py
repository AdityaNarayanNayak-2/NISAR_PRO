"""Notebook bootstrap: hosted Colab uses packaged artifacts; local runtime may use local data."""
from pathlib import Path
import os
import subprocess

RUN_MODE = os.environ.get("NISAR_RUN_MODE", "showcase")
REPOSITORY_URL = "https://gitlab.com/Aditya-Narayan-Nayak/nisar_pro.git"

def find_package_root(start: Path):
    for candidate in (start, *start.parents):
        if (candidate / "sar-bihar-ls-fused-aug31-sep12_flood.json").exists():
            return candidate
        if candidate.name == "ingarss_2026" or candidate.name.startswith("ingarss_2026"):
            return candidate
        if (candidate / "ingarss_2026").is_dir():
            return candidate / "ingarss_2026"
        for sub in candidate.glob("ingarss_2026*"):
            if sub.is_dir() and (sub / "sar-bihar-ls-fused-aug31-sep12_flood.json").exists():
                return sub
    
    # Check anywhere under /content (Colab default workspace)
    content = Path("/content")
    if content.exists():
        for f in content.glob("**/sar-bihar-ls-fused-aug31-sep12_flood.json"):
            return f.parent
    return None

package_root = find_package_root(Path.cwd())

if package_root is None and Path("/content").exists():
    repo_root = Path("/content/nisar_pro")
    if not (repo_root / "ingarss_2026").is_dir():
        subprocess.run(
            ["git", "clone", "--depth", "1", REPOSITORY_URL, str(repo_root)],
            check=True,
        )
    package_root = repo_root / "ingarss_2026"

if package_root is None:
    raise FileNotFoundError(
        "Could not locate ingarss_2026. Upload the submission package or clone the repository first."
    )

os.chdir(package_root)
print(f"Submission root: {package_root}")
print(f"Run mode: {RUN_MODE} (showcase is the judge-safe default)")
if RUN_MODE == "local_full_scene":
    print("Local full-scene mode selected: HDF5 paths must be configured on the local runtime.")
