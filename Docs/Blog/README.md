# NISAR Pro — Engineering Blog Series

Four posts, in sharing order. Each one stands alone, but together they tell
the full story: **the fix, the proof, the journey, and why Rust.**

| # | Post | Read time | Best for |
|---|---|---|---|
| 1 | [7 GB In, 32 MB Out: Stop Loading Your Whole HDF5 File Into RAM](01-stop-loading-whole-hdf5-file-into-ram.md) | ~7 min | Anyone with a memory problem in scientific data |
| 2 | [Byte-for-Byte or It Didn't Happen: How We Proved Our NISAR Reader Correct](02-byte-for-byte-or-it-didnt-happen.md) | ~7 min | Test/QA-minded engineers, data scientists |
| 3 | [From an Out-of-Memory Crash to a 0.12-Second AOI Read: Our Engineering Diary](03-engineering-diary-from-crash-to-0-12-seconds.md) | ~8 min | The wider NISAR/SAR community, project followers |
| 4 | [Rust Wasn't a Requirement. It's the Reason NISAR Pro Runs on a Laptop.](04-why-rust-nisar-pro.md) | ~9 min | Rust vs Python debates, RustConf-style audiences |

---

## Suggested LinkedIn captions

### Post 1 — the fix

> Our NISAR GCOV granules are 7 GB. Our laptop has 7.7 GB of RAM.
>
> The old code read one image layer entirely into memory — 4,386.7 MB —
> to use a 15 MB square. Then it crashed.
>
> The file was never the problem. Chunked formats are designed so you only
> ever read the blocks you touch. Our library in front of it forgot that.
>
> We now mmap the file, build the chunk index once, and decode only the 20
> chunks a 2000x2000 window needs:
>
> 4,386.7 MB -> 32.3 MB peak. 0.124 s cold read. 287x less memory.
>
> Full walkthrough with code you can copy into Rust, Python, GDAL and
> Xarray — including the 7 gotchas that will bite you (fill values,
> filter masks, mmap-is-virtual, silent full-read fallbacks).
>
> If your app is OOM-ing on a NISAR product, the fix is almost never more
> RAM. It is stop asking for the file when you want a window.
>
> #NISAR #SAR #HDF5 #RemoteSensing #Rust #MemoryOptimization #NASA #ISRO

### Post 2 — the proof

> The most dangerous bug in earth-observation software is the one that
> produces a plausible image.
>
> When we built a memory-bounded HDF5 reader for NISAR granules, the bar
> was not "it runs". It was: every byte must match an independent
> implementation, or the change does not ship.
>
> So we tested against embedded h5py/libhdf5 — a different language, a
> different library — across 21 goldens, an adversarial fixture with
> deliberately missing chunks, and 32 full-read-vs-crop differentials.
>
> 116 checks. 0 mismatches.
>
> It caught 4 bugs in MY code in one afternoon:
> - hashing 24 bytes of Rust Vec metadata instead of the data
> - refusing a legal 2-byte Fill Value message
> - trusting _FillValue=NaN when the header says 0.0
> - a report bug: chunk grid printed as 564,300 instead of 4,422
>
> If your suite has never failed, it has never been tested.
>
> Full playbook + copy-paste test matrix in the post.
>
> #SoftwareTesting #NISAR #HDF5 #SAR #QualityAssurance #Rust #NASA #ISRO

### Post 3 — the journey

> Where we are on NISAR Pro, honestly.
>
> START: a 7 GB granule, a 7.7 GB laptop, and code that read 4,386.7 MB
> to process a 15 MB crop. It could not run a real product — only
> synthetic ones, because nobody had tried.
>
> TODAY: 32.3 MB peak, 0.124 s windowed read, 116 byte-for-byte checks
> passing, and a memory guard that actually works on Windows (ours was
> Linux-only and failed open — we found that out the hard way).
>
> NOT YET DONE: the production parser still does full-read-then-crop on
> purpose — integration waits for human review of the numbers. The
> baseline granule for the pre/post flood pair is not downloaded. The
> end-to-end demo has not run.
>
> 10 lessons in the post, but the two that mattered most:
> 1. quantify before you optimise — "4 GB for 15 MB" beats "it feels heavy"
> 2. trust the spec, not the attribute — the file's _FillValue said NaN,
>    the header said 0.0, and both look fine on screen
>
> Next: integrate, download the baseline, put a real flood map on screen.
>
> #NISAR #Engineering #SAR #RemoteSensing #ProjectDiary #NASA #ISRO #InGARSS

### Post 4 — why Rust

> "Why Rust?" is the first question anyone asks about NISAR Pro, and the
> honest answer is not "because it is fast".
>
> We benchmarked both languages on the same laptop, same 6.95 GB granule,
> same 2000x2000 window, same Windows memory counter:
>
> - Python 3.12 + h5py: 245.4 MB just to exist (imports alone), 270.4 MB
>   while holding a 15 MB array
> - Rust: 14.6 MB floor, 32.3 MB peak with everything
> - warm read: Python 62.8 ms, Rust 78 ms — libhdf5 beat us, and we say so
> - ship size: 104.9 MB / 2,443 files of Python vs one 0.4 MB exe
>
> The thing Python cannot give us is not speed. It is an enforceable memory
> ceiling: allocation that returns a Result instead of killing the process,
> copies that only happen if you write clone(), and an API with no
> read-everything() in it.
>
> The benchmark we could not run is the argument: the full-band read is
> 4,386.7 MB and this machine has 1,300 MB free.
>
> Full comparison + what Python does better in the post.
>
> #Rust #NISAR #SAR #RemoteSensing #HDF5 #RustConf #Python #NASA #ISRO

---

## Numbers referenced in the series (measured, not projected)

Environment: Windows, release build unless noted, single 6.95 GiB GCOV
granule, real 2000 x 2000 AOI.

| Metric | Value |
|---|---|
| Full-band read (old path) | 4,386.7 MB |
| Peak commit during windowed read | 32.3 MB (release) / 32.6 MB (debug) |
| Cold / warm windowed read | 0.124 s / 0.078 s (release) |
| Cold windowed read (debug) | 0.964 s |
| Open file (mmap) | 0.2 ms, 14.6 MB commit |
| Chunk index build (4422 chunks) | 0.9 ms, +0.9 MB |
| Chunk grid | 66 x 67 = 4422, all present, 512 x 512, shuffle -> deflate |
| Goldens vs independent libhdf5 | 21 / 21 PASS |
| Synthetic missing-chunk fixture | 8 / 8 PASS |
| Full-read-vs-crop differential | 32 / 32 PASS |
| Unit tests | 55 / 55 PASS, 0 warnings |
| Pass bars | peak < 300 MB PASS, cold < 2 s PASS |

### Python vs Rust (post 4, same file / AOI / Windows commit counter)

| Metric | Python 3.12 + h5py 3.16 | Rust (release) |
|---|---|---|
| Process floor (before any data) | 245.4 MB (imports: +239 MB) | 14.6 MB |
| Commit holding the window | 270.4 MB | 32.3 MB |
| Open file | 9.0 ms | 0.2 ms |
| Cold / warm windowed read | 69.4 ms / 62.8 ms | 124 ms / 78 ms |
| Time to a usable process | ~225 ms (`import h5py`) | ~11 ms |
| Ship to another machine | 104.9 MB, 2,443 files | 0.4 MB exe |
| Per parallel worker (Windows spawn) | ~245 MB | ~0 (shared mmap) |

## Companion material

- `Docs/memory-fix-research-brief.md` — original problem framing plus
  section 9 with the full validation record
- `scripts/nisar_probe.py` — the independent h5py oracle (recon, goldens,
  fixture generation)
- `sar_science_processor/src/windowed.rs` — the reader
- `sar_science_processor/src/bin/gcov_*.rs` — verifier, differential,
  measurement and probe tools
