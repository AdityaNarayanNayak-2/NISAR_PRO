# From an Out-of-Memory Crash to a 0.12-Second AOI Read: Our NISAR Pro Engineering Diary

*Where this project started, what actually works today, the bugs along the way, and what we are building next.*

---

## The promise, and the wall we hit

NISAR Pro is a local-first flood-detection platform: a user picks a flood
event on a map, we fetch the pre- and post-event NISAR L2 GCOV granules, and
a Rust engine runs a seven-stage change-detection pipeline **on their
laptop**. The data never leaves the machine — that is a hard product rule,
not a preference.

Then we tried it with a real granule and the project hit a wall.

- Real file: **6.95 GB**
- One image layer inside it: **4,386.7 MB** of float32 pixels
- The demo laptop: **7.7 GB of RAM total**, ~1.3 GB free with the OS,
  browser and IDE running
- Our code: read the whole layer, then crop a 2000 x 2000 AOI out of it

Peak memory was set by the *product size*, not by what we needed. The code
could not process a real granule on a typical developer laptop — and it had
only ever been tested on small synthetic crops, so nobody noticed.

That is the wall. Everything below is how we got past it.

## Phase 1 — Quantify the failure before touching the fix

The first week produced a research brief, not code, and that was deliberate:
*"is this the right problem, and how big is it really?"*

Four root causes, in order of severity:

1. **Full-band read-then-crop.** The GCOV branch called `read_f32()` on the
   entire dataset and copied out a crop. The flood run repeated it for both
   granules, so two 4 GB spikes per run.
2. **The safety net was Linux-only.** Our `guard_allocation()` reads
   `/proc/meminfo`. On Windows — the demo OS — it returned `None` and
   *silently proceeded* to allocate. The guard that was supposed to save us
   was disabled on exactly the machine that needed it.
3. **Type bloat.** Real power data was being wrapped in `Complex32`,
   doubling every intermediate array for no reason.
4. **No streaming.** The whole pipeline materialised buffers for the whole
   crop at once.

Honest lesson: **we had written a safety mechanism, assumed it worked, and
never once ran it on Windows.** Assumptions like that are what crash live
demos.

## Phase 2 — Choose a route (and why we did not pick the obvious one)

We evaluated three conventional routes:

- **Route A:** swap in an HDF5 binding with hyperslab/selection reads.
  Clean in theory — but it means a second HDF5 in the process, new linkage,
  new locking behaviour, and it does nothing for the other 90% of the
  pipeline that still materialises whole buffers.
- **Route A′:** ask the archive to serve a cropped file server-side.
  Elegant, but a network dependency during a live demo. Never the only path.
- **Route B:** tile-streaming pipeline with edge overlap. Right long-term
  architecture, high risk, wrong thing to build first.

We took a fourth option nobody put on the whiteboard:

> **Use what we already depend on.** The crate in front of us
> (`rustyhdf5-format`) already parses object headers, the data-layout
> message, the chunk B-tree, the filter pipeline, and can decompress a single
> chunk. It never exposed a *selection* API — but it exposed every primitive
> one.

So instead of adopting a bigger library, we wrote ~900 lines that read the
metadata once and decode only the chunks a window touches. No new HDF5, no
FFI, no second file handle.

**Route D: be a good citizen of the file format instead of fighting it.**

## Phase 3 — Get the ground truth first

Before writing the reader, we probed the file so we were coding against
facts, not guesses:

```
dataset : frequencyA/HHHH
shape   : 33624 x 34200 (f32, 10 m, gamma-0, EPSG:32646)
chunks  : 512 x 512, grid 66 x 67 = 4422, ALL PRESENT
filters : shuffle -> deflate (gzip level 1), every filter_mask = 0
fill    : header message size 0  ->  default 0.0
          (the _FillValue attribute says NaN — the attribute is the liar)
```

Two findings from this phase shaped the entire build:

- The **fill value in the header is not the fill value in the attribute**.
  Code that trusts the attribute produces NaN-filled gaps; code that trusts
  the header produces 0.0. Both look "fine" on screen. Only one is correct.
- The real file **never exercises the missing-chunk path**. So we generated
  our own 20 x 35 HDF5 fixture with 5 of 15 chunks deliberately never
  written, to test it.

## Phase 4 — Build it, then prove it

The reader itself: mmap the file, build one cached chunk index per dataset,
decode intersecting chunks, clip to edges, honour filter masks and header
fill, and return **typed errors** instead of ever falling back to a
full-band read.

Then the part that took longer than the code: **proving every byte is
right** against an independent libhdf5 oracle — targeted goldens, the
adversarial fixture, and a full-read-vs-crop differential. That is a separate
post, and it caught four bugs in my own code, including one where I was
hashing 24 bytes of Rust metadata instead of the data.

## Phase 5 — Measure, then write it down

The measurement had to be honest, so we sample **Windows commit size after
every decoded chunk** (not after the read finishes, which would show the
trough), and we report it at three points: after open, after index, peak
during decode.

**Today, on the real granule, real AOI, release build:**

| Metric | Before | Now |
|---|---|---|
| Memory for a 2000 x 2000 AOI | 4,386.7 MB | **32.3 MB** |
| Cold windowed read | seconds (or a crash) | **0.124 s** |
| Warm windowed read (cached index) | — | **0.078 s** |
| Open the 6.95 GB file | load risk | **0.2 ms, 14.6 MB commit** |
| Chunk index (4422 chunks) | — | **0.9 ms, +0.9 MB** |

Both of our pass bars — **peak < 300 MB** and **cold read < 2 s** — pass
with roughly ten times the margin on memory and sixteen times on time.

**Verification scoreboard: 21/21 real goldens, 8/8 fixture windows,
32/32 differential windows, 55/55 unit tests, 0 build warnings.**

And the housekeeping that no one puts in a demo: the 7 GB granule is out of
`.gitignore`-harm's way, a tracked secret manifest is untracked (rotation
still pending on purpose — history rewriting needs an owner's approval), the
research brief now carries the measured numbers instead of projections, and
the SPA redirect file that `dist/`-ignoring was silently swallowing now lives
in `public/` where the build can find it.

## What is still true about this project

We are not done, and it is worth being precise about that:

- **`src/nisar_parser.rs` still does full-read-then-crop.** The new reader is
  proven and isolated; integration is deliberately gated on a human
  reviewing these numbers. Proof first, then we touch the production path.
- **The baseline granule is not downloaded yet**, so the pre/post flood pair
  has never run end-to-end. That is the single biggest open item for the
  demo.
- **The AOI centre needs a decision.** Snapping to a fully-covered region
  pushed the 20 km box slightly east of the original polygon edge. Data
  coverage says one thing, the study area definition says another.
- **The Windows memory guard is implemented but not yet exercised
  end-to-end** on this path — the failure mode it exists for (blocking an
  implausible allocation gracefully) has not been demonstrated in a real run.

## Ten things we would tell anyone starting this

1. **Quantify before you optimise.** "It feels memory-hungry" is not a
   bug report; "4,386.7 MB for a 15 MB crop" is.
2. **Read your own safety code on the OS you demo on.** Ours was
   Linux-only and failed open.
3. **Ask the file format first.** Chunked formats are *designed* for windowed
   reads; the library in front of you may be the only thing standing in the way.
4. **Do not add a dependency to get what your current one already has.**
   We wrote 900 lines instead of a second HDF5 linkage.
5. **Trust the spec, not the attribute.** Header beats attribute.
6. **An oracle in another language.** Same-library self-tests confirm your
   bugs to each other.
7. **Build the file that breaks.** If production data cannot fail a path, it
   cannot prove that path works.
8. **Measure the peak while it is happening.** Sample per chunk.
9. **Make correctness a merge gate.** Byte-for-byte or it does not ship —
   116 checks, zero mismatches, or the change does not go in.
10. **Write the numbers down.** The brief now says what we measured, with
    build profile, OS and bars — so nobody re-litigates it from memory.

## What comes next

1. **Integration.** Replace the full-band read in `nisar_parser.rs` with the
   proven windowed path, after sign-off on these results.
2. **The baseline pair.** Download the pre-event granule, run active vs
   baseline through all seven stages, and put a real flood map on screen.
3. **Guard on Windows.** Exercise `guard_allocation()` end-to-end: it must
   block an absurd AOI gracefully and pass a 10 km one.
4. **The demo.** One button in the dashboard, one local worker, one flood
   event, no OOM, under two seconds to first pixels.

The mountain was never the algorithm — the flood pipeline already worked on
small data. The mountain was making a 7 GB product behave like it lives on a
laptop.

It does now.

---

*Posts 1 and 2 in this series cover the memory fix in copy-paste detail and
the verification playbook that proved it correct.*

`#NISAR` `#Engineering` `#SAR` `#RemoteSensing` `#Rust` `#HDF5` `#MemoryOptimization` `#ProjectDiary` `#NASA` `#ISRO` `#InGARSS`
