#!/usr/bin/env python3
"""Build a reproducibility manifest for the InGARSS submission package."""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


def sha256(path: Path, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(chunk_size):
            digest.update(chunk)
    return digest.hexdigest()


def git_value(root: Path, *args: str) -> str | None:
    try:
        return subprocess.check_output(
            ["git", "-C", str(root), *args], text=True, stderr=subprocess.DEVNULL
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repository", type=Path, default=Path("."))
    parser.add_argument("--package", type=Path, default=Path("ingarss_2026"))
    parser.add_argument("--output", type=Path, default=Path("ingarss_2026/provenance_manifest.json"))
    args = parser.parse_args()

    repository = args.repository.resolve()
    package = args.package if args.package.is_absolute() else repository / args.package
    output = args.output if args.output.is_absolute() else repository / args.output
    output = output.resolve()

    files = []
    for path in sorted(package.rglob("*")):
        if not path.is_file() or path.resolve() == output:
            continue
        relative = path.relative_to(repository).as_posix()
        files.append({
            "path": relative,
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
        })

    manifest = {
        "manifest_version": 1,
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "git": {
            "commit": git_value(repository, "rev-parse", "HEAD"),
            "branch": git_value(repository, "branch", "--show-current"),
        },
        "runtime": {
            "python": sys.version,
            "platform": platform.platform(),
            "machine": platform.machine(),
        },
        "package_root": package.relative_to(repository).as_posix(),
        "files": files,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {output} with {len(files)} hashed files")


if __name__ == "__main__":
    main()
