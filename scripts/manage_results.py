#!/usr/bin/env python3
"""
NISAR Pro - Results & Artifact Lifecycle Manager
================================================
Manages runtime output files, GeoTIFFs, flood masks, and job directories across:
  - sar-gateway/results/
  - results/
  - benchmarks/results/

Usage:
  python3 scripts/manage_results.py status
  python3 scripts/manage_results.py clean [--keep N] [--all] [--dry-run]
  python3 scripts/manage_results.py untrack-git
"""

import os
import sys
import shutil
import argparse
import subprocess
from pathlib import Path
from collections import defaultdict

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent

RESULT_DIRS = [
    WORKSPACE_ROOT / "sar-gateway" / "results",
    WORKSPACE_ROOT / "results",
    WORKSPACE_ROOT / "benchmarks" / "results",
]

PROTECTED_FILES = {
    ".gitkeep",
    "README.md",
    ".gitignore",
}

def format_bytes(size: int) -> str:
    for unit in ["B", "KB", "MB", "GB"]:
        if abs(size) < 1024.0:
            return f"{size:3.1f} {unit}"
        size /= 1024.0
    return f"{size:.1f} TB"

def get_dir_stats(directory: Path):
    if not directory.exists():
        return {"files": 0, "size": 0, "jobs": {}, "orphans": []}

    files = 0
    total_size = 0
    jobs = defaultdict(list)
    orphans = []

    for item in directory.rglob("*"):
        if item.is_file():
            if item.name in PROTECTED_FILES:
                continue
            sz = item.stat().st_size
            files += 1
            total_size += sz

            # Group by job id if matches common naming convention
            name = item.name
            if "_flood" in name:
                job_id = name.split("_flood")[0]
                jobs[job_id].append((item, sz, item.stat().st_mtime))
            elif name.endswith((".tif", ".png", ".json", ".geo.json")):
                stem = item.stem.split(".")[0]
                jobs[stem].append((item, sz, item.stat().st_mtime))
            else:
                orphans.append((item, sz, item.stat().st_mtime))

    return {
        "files": files,
        "size": total_size,
        "jobs": dict(jobs),
        "orphans": orphans,
    }

def cmd_status(args):
    print("\n╔══════════════════════════════════════════════════════════════════════╗")
    print("║             NISAR Pro Artifact & Job Storage Status                  ║")
    print("╚══════════════════════════════════════════════════════════════════════╝")

    grand_total_size = 0
    grand_total_files = 0

    for d in RESULT_DIRS:
        rel = d.relative_to(WORKSPACE_ROOT)
        stats = get_dir_stats(d)
        grand_total_size += stats["size"]
        grand_total_files += stats["files"]

        print(f"\n📂 Directory: {rel}")
        print(f"   Files: {stats['files']} | Total Size: {format_bytes(stats['size'])}")
        if stats["jobs"]:
            print(f"   Identified Job Runs ({len(stats['jobs'])}):")
            for job_id, items in sorted(stats["jobs"].items()):
                job_sz = sum(sz for _, sz, _ in items)
                print(f"     • {job_id} ({len(items)} files, {format_bytes(job_sz)})")
        if stats["orphans"]:
            print(f"   Standalone / Cache Files ({len(stats['orphans'])}):")
            for item, sz, _ in stats["orphans"]:
                print(f"     • {item.name} ({format_bytes(sz)})")

    print("\n" + "─" * 70)
    print(f"📊 SUMMARY: {grand_total_files} artifact files consuming {format_bytes(grand_total_size)} disk space.")
    print("─" * 70 + "\n")

def cmd_clean(args):
    keep_n = 0 if args.all else args.keep
    dry_run = args.dry_run

    print("\n🧹 Cleaning Results & Artifacts...")
    if args.all:
        print("   Target: PURGE ALL old results and jobs.")
    else:
        print(f"   Target: Retaining {keep_n} most recent jobs, removing older/orphan files.")

    if dry_run:
        print("   [DRY RUN - No files will actually be deleted]")

    deleted_files = 0
    freed_bytes = 0

    for d in RESULT_DIRS:
        if not d.exists():
            continue
        rel = d.relative_to(WORKSPACE_ROOT)
        stats = get_dir_stats(d)

        # 1. Sort jobs by newest file mtime
        sorted_jobs = []
        for job_id, items in stats["jobs"].items():
            newest_mtime = max(mtime for _, _, mtime in items)
            sorted_jobs.append((newest_mtime, job_id, items))
        sorted_jobs.sort(reverse=True)

        jobs_to_delete = sorted_jobs[keep_n:]

        # Delete older jobs
        for _, job_id, items in jobs_to_delete:
            for item, sz, _ in items:
                if item.name in PROTECTED_FILES:
                    continue
                if not dry_run:
                    try:
                        if item.is_file():
                            item.unlink()
                        elif item.is_dir():
                            shutil.rmtree(item)
                    except Exception as e:
                        print(f"   ⚠️ Could not remove {item}: {e}")
                deleted_files += 1
                freed_bytes += sz
                print(f"   🗑️  Removed: {item.relative_to(WORKSPACE_ROOT)} ({format_bytes(sz)})")

        # Delete nested job subdirectories if empty
        jobs_subdir = d / "jobs"
        if jobs_subdir.exists():
            for child in jobs_subdir.iterdir():
                if child.is_dir() and args.all:
                    sz = sum(f.stat().st_size for f in child.rglob("*") if f.is_file())
                    if not dry_run:
                        shutil.rmtree(child)
                    deleted_files += 1
                    freed_bytes += sz
                    print(f"   🗑️  Removed job directory: {child.relative_to(WORKSPACE_ROOT)} ({format_bytes(sz)})")

        # Delete cache files (.npz, logs)
        for item, sz, _ in stats["orphans"]:
            if item.name in PROTECTED_FILES:
                continue
            if args.all or item.suffix in [".npz", ".log"] or "cache" in item.name.lower():
                if not dry_run:
                    try:
                        item.unlink()
                    except Exception as e:
                        print(f"   ⚠️ Could not remove {item}: {e}")
                deleted_files += 1
                freed_bytes += sz
                print(f"   🗑️  Removed cache/log: {item.relative_to(WORKSPACE_ROOT)} ({format_bytes(sz)})")

        # Ensure .gitkeep exists so the directory remains
        gitkeep = d / ".gitkeep"
        if not gitkeep.exists() and not dry_run:
            gitkeep.touch()

    print("\n" + "─" * 70)
    action_text = "Would delete" if dry_run else "Successfully removed"
    print(f"✨ CLEANUP COMPLETE: {action_text} {deleted_files} files, freeing {format_bytes(freed_bytes)} disk space.")
    print("─" * 70 + "\n")

def cmd_untrack_git(args):
    print("\n📦 Untracking heavy results and artifacts from git index...")
    try:
        # Untrack results/* without deleting the physical folder
        subprocess.run(["git", "rm", "-r", "--cached", "results/"], cwd=WORKSPACE_ROOT, check=False)
        # Re-add results/.gitkeep
        gitkeep = WORKSPACE_ROOT / "results" / ".gitkeep"
        gitkeep.touch()
        subprocess.run(["git", "add", "results/.gitkeep"], cwd=WORKSPACE_ROOT, check=True)
        print("✅ results/ untracked from git index (results/.gitkeep preserved).")
    except Exception as e:
        print(f"⚠️ Git untrack error: {e}")

def main():
    parser = argparse.ArgumentParser(description="NISAR Pro Result & Artifact Manager")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # status
    p_status = subparsers.add_parser("status", help="Show current artifact storage and jobs")
    p_status.set_defaults(func=cmd_status)

    # clean
    p_clean = subparsers.add_parser("clean", help="Clean up old jobs and results")
    p_clean.add_argument("--keep", type=int, default=1, help="Number of latest jobs to keep (default: 1)")
    p_clean.add_argument("--all", action="store_true", help="Purge all jobs and results")
    p_clean.add_argument("--dry-run", action="store_true", help="Preview deletions without deleting")
    p_clean.set_defaults(func=cmd_clean)

    # untrack-git
    p_git = subparsers.add_parser("untrack-git", help="Remove results from git index and update tracking")
    p_git.set_defaults(func=cmd_untrack_git)

    args = parser.parse_args()
    args.func(args)

if __name__ == "__main__":
    main()
