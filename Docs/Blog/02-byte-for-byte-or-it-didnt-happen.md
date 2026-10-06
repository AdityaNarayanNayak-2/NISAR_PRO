# Byte-for-Byte or It Didn't Happen: How We Proved Our NISAR Reader Correct

*In remote sensing, a small bug does not look like a bug. It looks like science. Here is the verification playbook that caught four bugs in my own code in one afternoon.*

---

## "It looks right" is not a test

The scariest class of bug in earth-observation software is the one that
produces a **plausible image**.

A reader that is off by one chunk, that ignores a filter mask, that fills
missing data with zeros instead of the header value — all of those still give
you a flood map. It is just 200 metres in the wrong place, or 0.3 dB off, and
nobody notices until a reviewer does.

So when we built a memory-bounded windowed reader for NISAR GCOV granules
(7 GB files, gzip-compressed 512 x 512 chunks), the bar was not "it runs".
The bar was:

> **Every byte must match an independent HDF5 implementation, or the change
> does not ship.**

This post is the playbook, and the four real bugs it caught in *my* code.

## Rule 1 — Never test your reader with the library that wrote your file

The first decision: the oracle cannot be us.

We built the reader in Rust on top of `rustyhdf5-format` (header parsing,
B-tree walking, shuffle/deflate decode). If the test also used that crate, a
bug in the crate would be invisible in both — the test would agree with the
bug.

So we built a second, independent path: an **embedded CPython 3.12 with
h5py 3.16 and libhdf5 2.0** — a completely separate implementation written in
C, talking to the same file:

```python
# scripts/nisar_probe.py  (the oracle)
import h5py, numpy as np, hashlib

with h5py.File(GRANULE, "r") as f:
    ds = f["/science/LSAR/GCOV/grids/frequencyA/HHHH"]
    window = np.asarray(ds[10850:12850, 4119:6119])   # libhdf5 reads it
    digest = hashlib.sha256(np.ascontiguousarray(window)
                            .astype("<f4").tobytes()).hexdigest()
    write_golden("aoi", window, digest)
```

```rust
// sar_science_processor/src/bin/gcov_verify.rs  (the accused)
let ours = reader.read_window(&dataset, window)?;
let ours_bytes = unsafe {
    std::slice::from_raw_parts(ours.as_ptr() as *const u8, ours.len() * 4)
};
let ours_sha = sha256_hex(ours_bytes);
assert_eq!(ours_sha, golden.sha256);   // must be identical, not close
```

If `sha256` matches, every single pixel matches — not "within tolerance".
Bit-for-bit.

## Rule 2 — Choose windows that would expose each class of bug

Random testing is weak against structural bugs. We hand-picked windows that
target the machinery:

| Window | What it proves |
|---|---|
| The real AOI (2000 x 2000, snapped to grid) | the demo path |
| All four frame corners | edge clipping, ragged final chunks |
| Exact chunk boundary, then +1 pixel | straddle logic (`511..513` is the killer) |
| A single chunk | no cross-chunk contamination |
| A NaN region | fill values are not silently zeroed |
| Highest file address | `u64` offsets are not truncating |
| 24 deterministic pseudo-random windows | assembly/crop maths generally |

Plus a fourth, different kind of check: a **full-read-vs-crop differential**
on the one small dataset (80 m grid, 4203 x 4275, 68 MB) that is cheap enough
to read whole. Decode the entire array once through the chunk pipeline, then
decode 32 windows and compare each against the corresponding crop of the full
array:

```
same decoder, two different paths
   full decode  ──┐
                  ├── must be identical
   window decode ─┘
```

That isolates *window assembly and clipping* from *chunk decoding*, which the
goldens alone cannot separate.

**Result: 21/21 goldens, 32/32 differential windows, all byte-identical.**

## Rule 3 — Build a fixture for the path your real file cannot exercise

The real granule has a suspicious property: **all 4422 chunks are present**,
and every `filter_mask` is zero. So the two paths most likely to be wrong —
"chunk missing, use the header fill value" and "chunk had filters skipped" —
are never executed by the real file.

You cannot fake that inside a production product without corrupting it. So we
generated a tiny purpose-built HDF5 file with the oracle:

```python
# 20 x 35 pixels, 8 x 8 chunks -> 15 grid cells, only 10 written.
# The 5 unwritten cells MUST come back as NaN (the declared fill).
```

and asserted each window against its own golden:

```
fixture : shape 20 x 35, chunk 8 x 8, fill NaN, chunks stored 10 / 15
  all            PASS  20x35  missing=5 decoded=10
  first_chunk    PASS   8x8   missing=1 decoded=0
  ragged_edge_r  PASS   5x35  missing=3 decoded=7
  single_pixel   PASS   1x1   missing=0 decoded=1
  straddle       PASS   2x2   missing=1 decoded=3
passed 8, failed 0
```

If your production file cannot fail a path, build a file that can.

## Rule 4 — Unit-test the error paths, not just the happy path

A windowed reader earns its keep by **refusing** the wrong work: an
unsupported filter, a chunk address past end-of-file, a short decompressed
buffer, an out-of-range window. Each must be a typed error — never a panic,
never a silent fallback to a full-band read.

We hand-build an in-memory index in tests so these paths are reachable
without fixture files:

```rust
match read_window_from(&index, &file_data, window) {
    Err(WindowError::ShortChunk { expected, got, .. }) => {
        assert_eq!(expected, 256);   // 8x8 px promised
        assert_eq!(got, 8);          // 8 bytes delivered
    }
    other => panic!("expected ShortChunk, got {other:?}"),
}
```

## What the tests caught (the honest part)

All four bugs were **mine**, and none would have produced an obviously broken
image.

**Bug 1 — I measured the wrong buffer.**
The fixture verifier compared *24 bytes* against a 2800-byte golden and
failed 8/8. Rust's `size_of_val(&some_vec)` returns the size of the `Vec`
header (24 bytes on x86-64), not the data it points at.

```rust
// wrong: silently hashes 24 bytes of stack metadata
let bytes = unsafe { std::slice::from_raw_parts(
    v.as_ptr() as *const u8, std::mem::size_of_val(&v)) };

// right: length comes from the element count
let bytes = unsafe { std::slice::from_raw_parts(
    v.as_ptr() as *const u8, v.len() * 4) };
```

**Bug 2 — a legal HDF5 file my code refused to open.**
The B-band dataset carries a 2-byte Fill Value message instead of the usual
8+ bytes. My parser demanded at least 8 and returned
`unsupported layout`, failing every window on that dataset. In HDF5, a
truncated fill message is *legal* and means "no stored value, use the type
default". Refusing it was wrong; but so was treating it as data.

**Bug 3 — the attribute and the header disagreed.**
`_FillValue = NaN` was an *attribute*; the Fill Value *message* stored size 0,
meaning default `0.0`. Code that reads the attribute fills unwritten pixels
with NaN; code that reads the header fills with 0.0; both "pass" a visual
check. Only the spec-compliant header read is correct — and only a fixture
with genuinely missing chunks shows which one you actually implemented.

**Bug 4 — the report was wrong, the reader was right.**
A separate fingerprint tool printed the chunk grid as `66 x 8550 = 564,300
chunks` instead of `66 x 67 = 4422`. The layout message is
`[512, 512, 4]` — the trailing `4` is the *element size*, not a dimension.
Indexing `[1]` and `[2]` instead of `[0]` and `[1]` divided the column count
by 4. The bug lived in the diagnostic, which is exactly where bugs hide: the
thing you trust to tell you the reader is fine.

There was a fifth, process bug: my progress callback fired **once after the
whole read**, so any peak-memory measurement would have reported the trough
instead of the peak.

## The scoreboard

| Layer | Tool | Result |
|---|---|---|
| Independent oracle | embedded h5py + libhdf5 2.0 | — |
| Real-granule goldens (2 datasets, 16 + 5 windows) | SHA-256 compare | **21/21 PASS** |
| Synthetic missing-chunk fixture (8 windows) | SHA-256 compare | **8/8 PASS** |
| Full-read-vs-crop differential (32 windows) | element-wise | **32/32 PASS** |
| Unit tests (reader + hash vectors) | `cargo test` | **55/55 PASS** |
| Build warnings | `cargo build` | 0 |

Total: **116 independent checks, zero mismatches.**

## Copy this test matrix for your own reader

1. **Independent oracle** — a second implementation, ideally a different
   language and a different library than the one you ship.
2. **Targeted goldens** — corners, boundaries (`n-1, n, n+1`), single units,
   extreme file offsets, fill regions, plus a few random windows with a fixed
   seed so failures are reproducible.
3. **Adversarial fixture** — a tiny file you generate that *does* have
   missing chunks, masked filters, ragged edges, weird fill messages.
4. **Differential** — same data through two code paths, compared element-wise.
5. **Typed-error tests** — every rejection path, asserted by variant.
6. **Digests, not eyeballs** — SHA-256 of raw little-endian bytes. Tolerance
   masks are for radar, not for readers.
7. **A bug you have not found yet** — if the suite has never failed, it has
   never been tested. Ours failed 8/8 on the first honest run and that is the
   most valuable output of the day.

---

*This is the part of the job nobody posts about: the reader was easy, the
proof was the work. Next post: the full engineering diary, from an
out-of-memory crash to a 0.12-second windowed read.*

`#NISAR` `#SoftwareTesting` `#HDF5` `#SAR` `#Rust` `#RemoteSensing` `#QualityAssurance` `#NASA` `#ISRO`
