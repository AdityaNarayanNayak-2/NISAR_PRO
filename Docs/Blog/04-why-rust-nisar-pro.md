# Rust Wasn't a Requirement. It's the Reason NISAR Pro Runs on a Laptop.

*Why we built a NISAR flood-detection engine in Rust, what Python literally cannot give us, and the numbers behind both — measured on the same machine, the same file, the same window.*

---

*"Why Rust?"* It is the first question anyone asks, and the honest answer is
never the one people expect. It is not "because it is fast". Our Python
oracle read the same window **faster** than our Rust reader did.

The answer is: **Rust is the only way we could turn our product's promises
into something the compiler checks instead of something we hope for.**

(And yes — one day I would love to say this on a stage at RustConf 2027 next
to people who actually know NISAR inside out, like Paul Rosen and Heresh
Fattehi. That is the dream. Today it is a blog post and an InGARSS 2026
demo. Hold me to it.)

---

## First, what we are actually building

NISAR Pro is a local-first flood-detection platform. You pick a flood event,
we fetch two NISAR L-2 GCOV granules — before and after — and a Rust engine
runs a seven-stage detection pipeline **on your laptop**. The satellite data
never leaves your machine. That is a hard rule, not a feature.

Three promises fall out of that:

1. **Data never leaves the device** → no cloud compute to lean on.
2. **It runs on a laptop** → 7.7 GB of RAM, of which Windows, your browser
   and your IDE already eat most.
3. **It works live, in a demo** → no crashes, no 30-second stalls.

Now the numbers behind the file we feed it:

- Granule on disk: **6.95 GB**
- One image layer inside it: **4,386.7 MB** of pixels
- Our AOI: **15.3 MB**
- Free RAM on the demo machine: **~1.3 GB**

Those three promises plus those four numbers define a very narrow solution
space. This is where "necessary" starts to differentiate itself from
"required".

## The headline: the one thing Python cannot give us

Let me be precise, because this matters and the internet will happily
misquote it:

> **Python can be *written* this way. Python cannot *enforce* this way.**

What we need is an **enforceable memory ceiling**: a guarantee that no code
path — ours, or a dependency's — can quietly materialise a 4 GB buffer and
take the process down. In Rust we get that from three mechanisms that are
part of the language, not part of our style guide.

### 1. Allocation is a `Result`, not a gamble

```rust
pub fn try_reserve_checked<T>(buf: &mut Vec<T>, additional: usize,
                              operation: &str) -> anyhow::Result<()> {
    match buf.try_reserve_exact(additional) {
        Ok(())  => { write_entry("ALLOC_OK",  &format!("{operation}: reserved")); Ok(()) }
        Err(e)  => {
            let msg = format!("{operation} — ALLOCATION FAILED ({additional} elems): {e}");
            write_entry("ALLOC_FAIL", &msg);
            anyhow::bail!("{}", msg)          // typed failure, before the machine dies
        }
    }
}
```

`try_reserve` asks the allocator *first* and hands you an `Err` you can log,
report to the UI, and recover from. Our `guard_allocation()` sits in front of
it with real system numbers from `GlobalMemoryStatusEx`, requiring 512 MB of
headroom *after* the allocation — so a full-band request on the demo machine
is refused *before* any memory is touched, with a message shaped like this
(numbers abridged, format is ours):

```text
MEMORY GUARD BLOCKED: 'full-band read'
  Estimated allocation:  4386 MB
  Safety headroom:        512 MB
  Available RAM:          1300 MB
  DEFICIT:               3598 MB
  This allocation would likely exhaust available memory.
```

That is a **normal, handled error** — not a dead process. The Python
equivalent is a `ctypes` call you write yourself, which is fine right up
until the moment `pandas`, `matplotlib` or a transitive dependency allocates
behind your back, because *you* cannot make every allocation site in a Python
process go through your check. In our Rust pipeline, the allocations in the
hot path are the ones we typed — so the guard *is* the policy.

### 2. A copy cannot happen unless someone writes `clone()`

This one is invisible until you are debugging a memory spike at 2 a.m.

Our reader borrows the file mapping:

```rust
fn read_window_from(index: &ChunkIndex, file_data: &[u8], window: Window)
```

`file_data: &[u8]` is a **borrow** — the compiler proves nothing is copied.
If we want a copy, we have to type `to_vec()` or `.clone()`, and a reviewer
sees it in the diff. A 6.95 GB file costs our process 14.6 MB because there
is exactly one handle to it and no garbage collector quietly keeping it
alive.

In Python, `np.array(x)`, `.copy()`, a comprehension that captures a
variable, a closure in a cache — every one of them is an invisible
duplication of megabytes, and CPython's allocator often does not give memory
back to the OS afterwards. Your spike becomes your new baseline.

### 3. The dangerous operation is not in the API, and errors are types

Our reader's public surface is:

```rust
reader.read_window(dataset, window)       // -> Result<Vec<f32>, WindowError>
reader.read_window_with(dataset, window, |stats| ...)  // progress per chunk
```

There is no `read_everything()`. To allocate 4 GB you would have to write
`read_window(whole_grid)` deliberately, in one obvious line, and our tests
would notice. Errors come back as an **enum**:

```rust
pub enum WindowError {
    BadWindow { .. }, UnsupportedFilter { filter_id: u16 },
    ChunkOutOfFile { .. }, ShortChunk { .. }, /* ... */
}
```

A `match` over that enum has to deal with every variant, or it does not
compile. The classic Python recovery pattern — `except Exception: fall back
to reading the whole file` — is a memory bomb wearing an error-handling
hat. In Rust you can still write it, but you have to write `_ =>` to do it,
and it glows in review.

---

## The real-case comparison (measured today, same box)

Same machine, same 6.95 GB granule, same 2000 x 2000 AOI, **same Windows
commit counter** (`GetProcessMemoryInfo` → `PrivateUsage`) for both
languages:

| | Python 3.12 + h5py 3.16 + NumPy | Rust (release) |
|---|---|---|
| Process floor — *before any data* | **245.4 MB** (imports alone: +239 MB) | **14.6 MB** |
| Commit while holding the window | 270.4 MB | **32.3 MB** |
| Open the file | 9.0 ms | 0.2 ms |
| Cold windowed read | 69.4 ms | 124 ms |
| Warm windowed read | **62.8 ms** | 78 ms |
| Full-band read | 4,386.7 MB → **cannot run here** | not exposed by the API |
| Time to a usable process | ~225 ms (`python -c "import h5py"`) | ~11 ms |
| What you ship to another machine | **104.9 MB, 2,443 files** | **1 exe, 0.4 MB** |
| Extra cost per parallel worker | ~245 MB (Windows `spawn`) | ~0 — threads share the mmap |

Three things worth being honest about:

- **Python's decoder beat ours.** Warm read: 62.8 ms vs 78 ms — libhdf5's C
  is excellent, and we are about 24% behind it. Against a 2-second budget
  that is noise, but it is real, and it is where I would optimise next.
- **Python can read windows too.** It must — it is our independent oracle.
  The read was never the problem.
- **The problem is everything around the read.** Python's floor before a
  single pixel (245.4 MB) is already **81% of our entire 300 MB memory
  budget**. Add two granules, seven stages of temporaries and a plot window,
  and the ceiling is gone before the science starts. Our whole Rust process
  — file mapping, chunk index, decode, output — peaks at 32.3 MB.

And the benchmark we could not run: the Python full-band read. Not because
the code is hard — `arr = ds[:]` is one line — but because this machine has
1.3 GB free and the allocation is 4,386.7 MB. **The benchmark that fails to
launch is the argument.**

## What about the GIL?

Our seven stages are embarrassingly parallel: two granules, independent
tiles, row-block decoding. Rust gets `rayon` threads that share *one* file
mapping and *one* chunk index — zero copies, zero extra floor.

Python's escape hatch is `multiprocessing`, and on Windows every worker is a
fresh interpreter process. We measured the floor for one: **239 MB to
import h5py and NumPy**. Four workers come to roughly **1 GB of runtime
before a single pixel** — on a 7.7 GB laptop, that is one-eighth of the
machine spent on interpreters. Shared memory is possible in Python, but it is
plumbing you write by hand, in a language where nobody will notice if you get
it wrong.

## How Rust solved the memory problem — in four decisions

1. **Map the file, don't read it.** `rustyhdf5::MmapFile` gives us the whole
   6.95 GB as a byte slice; Windows demand-pages only what we touch →
   **14.6 MB**.
2. **Read metadata once, cache it.** Chunk grid, addresses, filters, fill
   value → 0.9 MB, built in 0.9 ms, reused by every window.
3. **Decode only intersecting chunks.** 20 chunks for our AOI instead of
   4,422 → **12.6 MB compressed in, 15.3 MB out, peak 32.3 MB**.
4. **Fail closed.** Typed errors, checked allocations, no full-band fallback
   anywhere in the path.

Before: **4,386.7 MB**. After: **32.3 MB** — **287x less memory**, landing
about **9x under** our own 300 MB pass bar and **16x under** the 2-second
time bar.

## If you do not write code: the library analogy

Think of the granule as a library's card catalogue for 4,422 books.

- **The old way** is asking for *every book in the building* so you can read
  one chapter, then carrying them all home to find out you needed 20 pages.
- **Our Rust way** is reading the catalogue once (0.9 ms), walking to exactly
  20 shelves, and carrying those 20 books back (15 MB).
- **What Rust adds** is that the building now has one door, the guard knows
  exactly how much you are allowed to carry, and the guard *works* — because
  the guard was written by the same compiler that refuses to build a cart
  without a size limit.

Python would get you the same 20 books — it did, as our test oracle. What it
cannot promise is that nothing else in the building decided to make copies
while you were walking.

## So: necessary, not just required?

A *requirement* is "must be memory-efficient". You can satisfy that in any
language with discipline, tests, and code review — until the day you are
tired, or a dependency changes, or someone new joins, and discipline does
not catch it.

*Necessary* means the promises our product made — never upload your data,
run on the machine you already own, survive a live demo — are **physical
claims about memory and time**, and Rust is the only mainstream language
where:

- the allocation you did not intend comes back as a catchable `Err` before
  the machine dies,
- the copy you did not mean to make has to be spelled `clone()`,
- the fallback that kills the demo has to be spelled `_ =>`,
- and the whole thing ships as one 0.4 MB executable with no runtime to
  install on a conference laptop with no wifi.

That is not taste. That is the difference between hoping the demo works and
knowing.

## What's special about Rust, in six one-liners

1. **Ownership instead of a garbage collector** — something owns every byte
   at all times; nothing lingers, nothing pauses the world.
2. **Borrowing instead of copying** — pass `&[u8]` and the compiler proves
   you did not duplicate 6.95 GB.
3. **`Result` + `?` instead of exceptions** — failures travel in the type, so
   you cannot forget they exist.
4. **Enums you must match exhaustively** — our `WindowError` cannot be
   ignored by accident.
5. **Fearless concurrency** — `rayon` threads over shared data with no locks
   and no GIL.
6. **Zero-cost abstractions** — iterators, generics and error handling
   compile down to the same loops you would write by hand, with no garbage
   collector and no runtime tax in the hot path.

## The honest counterpoint

Rust cost us: a slower first prototype, compile times, a real learning
curve, and a few `unsafe` blocks where we cast raw bytes to `f32` slices
(each one tested against the independent oracle). And for exploration, analysis
and plotting, we reach for Python every time — the oracle that proved our
reader correct was **80 lines of h5py**.

Two languages, each doing what it is good at:
**Python to find the truth. Rust to ship it.**

---

## The scoreboard

| | |
|---|---|
| Memory for a 2000 x 2000 AOI | 4,386.7 MB → **32.3 MB** |
| Cold / warm windowed read | **0.124 s / 0.078 s** |
| Correctness vs independent libhdf5 | **116 checks, 0 mismatches** |
| Unit tests | 55/55, 0 warnings |
| Pass bars | peak < 300 MB **PASS**, cold < 2 s **PASS** |
| Ship size | **0.4 MB** executable |

*Series: [1 — stop loading the whole file](01-stop-loading-whole-hdf5-file-into-ram.md) ·
[2 — prove it byte-for-byte](02-byte-for-byte-or-it-didnt-happen.md) ·
[3 — the engineering diary](03-engineering-diary-from-crash-to-0-12-seconds.md)*

---

So: InGARSS 2026, a live flood map, 32 MB of memory and no wifi. If Paul
Rosen or Heresh Fattehi ask me "why Rust?", I will hand them this post — and
then buy them a coffee, because they will have six better reasons than I do.

*See you at RustConf 2027, hopefully with a demo that still runs.*

`#Rust` `#NISAR` `#SAR` `#RemoteSensing` `#HDF5` `#RustConf` `#MemoryOptimization` `#Python` `#NASA` `#ISRO` `#InGARSS`
