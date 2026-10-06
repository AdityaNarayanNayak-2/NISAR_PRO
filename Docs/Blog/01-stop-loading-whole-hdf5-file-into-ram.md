# 7 GB In, 32 MB Out: Stop Loading Your Whole HDF5 File Into RAM

*A fix for the biggest memory trap in NISAR GCOV processing — and how to apply it to any chunked scientific file.*

---

## The wall every NISAR developer hits

You download a real NISAR Level-2 GCOV granule. It is **6.95 GB** on disk.

You write what looks like reasonable code:

```rust
let band: Vec<f32> = dataset.read_f32()?;   // one nice line
let crop = &band[row_start..row_end];        // take the part I need
```

And your app dies. Not because your laptop is weak — because that one line
materialises **4.4 GB** of pixels (33624 x 34200 float32) to use a **15 MB**
square. On a 16 GB machine running a browser, an IDE and Windows itself, that
is an out-of-memory crash waiting to happen.

This is the single most common complaint I see in the NISAR community right
now: *the products are chunked and compressed on disk, but every library in
front of them hands you a "read the whole thing" API, so the memory cost is
the file size instead of the window size.*

The pattern is not HDF5-specific. It shows up everywhere:

| Format | The tempting one-liner | What it really costs |
|---|---|---|
| HDF5 | `dataset.read_f32()` | whole dataset |
| GeoTIFF | `band.ReadRaster(0,0,w,h)` | whole band |
| Zarr/Xarray | `arr.values` | whole array, lazily *until it isn't* |
| Raw binary | `read_to_end` | whole file |

## Why the "obvious" library call hurts you

Chunked file formats already do the smart thing *on disk*. Your 7 GB granule
is cut into **512 x 512 pixel blocks**, each independently compressed with
gzip + shuffle. Reading a 2000 x 2000 window only physically needs **20 of
those 4422 blocks** — about 12.6 MB of compressed bytes.

The compression is half the story. The other half: if you ask a naïve API for
"the dataset", it decompresses **all 4422 chunks** into a flat array. You pay
in RAM for data you never look at.

## The fix in four steps

```
OLD PATH (what most code does)
7 GB file -> read_f32() -> 4.4 GB in RAM -> crop -> 15 MB -> drop the rest
                                             peak = 4.4 GB

NEW PATH (what we shipped)
7 GB file -> mmap only (0 bytes of payload in RAM)
          -> read chunk index once (0.9 ms)
          -> decompress 20 intersecting chunks (12.6 MB in, 20 MB out)
          -> stitch into a 15.3 MB window
                                             peak = 32 MB
```

**Step 1 — Map the file, do not read it.**
`mmap` gives you the file as a byte slice. Windows/Linux demand-page only the
ranges you actually touch, so a 7 GB mapping costs your heap about the same
as an empty `Vec`.

**Step 2 — Read metadata once, cache it.**
Walk the object header and the chunk B-tree a single time per dataset: chunk
grid, chunk shape, addresses, compressed sizes, filter pipeline, fill value.
Store it. Every later window reuses it. Our index for 4422 chunks costs
**0.9 MB** and builds in **0.9 ms**.

**Step 3 — Decode only intersecting chunks.**
Convert the pixel window to a chunk-grid rectangle, decompress just those
blocks, and copy the overlapping rows out of each.

**Step 4 — Report progress *while* decoding, not after.**
If you sample memory only when the read finishes, you miss the peak. We
invoke a callback after every chunk so the measurement is honest.

## The code, simplified

```rust
let mut reader = ChunkedF32Reader::open(Path::new("granule.h5"))?;

let (data, stats) = reader.read_window_with(
    "/science/LSAR/GCOV/grids/frequencyA/HHHH",
    Window { row_start: 10850, row_end: 12850,
             col_start: 4119,  col_end: 6119 },
    |s| println!("decoded {} chunks so far", s.chunks_decoded),
)?;

println!("{} px, {} missing chunks, {} ms",
         data.len(), stats.chunks_missing, stats.elapsed_ms);
```

The core of the loop is not complicated:

```rust
for chunk_row in first_row..=last_row {
    for chunk_col in first_col..=last_col {
        let (addr, size) = index.get(chunk_row, chunk_col)?; // from Step 2
        let compressed = &file[addr..addr + size];           // mmap read
        let decoded = decompress(compressed, pipeline)?;     // 1 MB, not 4.4 GB
        copy_overlap_into(&mut window_buffer, &decoded, ...);
    }
}
```

## Same idea in your stack

You do not have to rewrite your application in Rust. Every serious format
stack has a partial-read path — the trick is to make sure you are using it.

**h5py (Python)** — slicing a dataset reads only intersecting chunks:

```python
import h5py
with h5py.File("granule.h5", "r") as f:
    ds = f["/science/LSAR/GCOV/grids/frequencyA/HHHH"]
    window = ds[10850:12850, 4119:6119]   # 15 MB, not 4.4 GB
```

**GDAL (raster, GeoTIFF/NetCDF/COG)** — windowed read by offset:

```python
from osgeo import gdal
raster = gdal.Open(path)
band = raster.GetRasterBand(1)
arr = band.ReadAsArray(xoff=4119, yoff=10850, xsize=2000, ysize=2000)
```

**NumPy `memmap` (raw/binary)** — pages in only what you touch:

```python
import numpy as np
mm = np.memmap("data.bin", dtype="float32", mode="r",
               shape=(33624, 34200))
window = np.array(mm[10850:12850, 4119:6119])  # copy out only this
```

**Xarray** — this one is the sneaky case. `ds.values` materialises
everything. Force the window first, then `.load()`:

```python
window = ds.isel(y=slice(10850, 12850), x=slice(4119, 6119)).load()
```

## What it actually bought us

| Metric | Old full-read path | Windowed reader |
|---|---|---|
| Bytes touched for a 2000 x 2000 AOI | 4,386.7 MB | 15.3 MB |
| Peak process commit | ~4.4 GB | **32.3 MB** |
| Cold read (release build) | seconds + a swap risk | **0.124 s** |
| Warm read (index cached) | — | **0.078 s** |
| Ratio | 1x | **287x less memory** |

The file on disk never shrank. We just stopped paying for the other 4402
chunks.

## Seven gotchas before you ship this

1. **Chunk vs window amplification.** A 1-pixel read still inflates a whole
   512 x 512 chunk (1 MB). Plan windows around chunk boundaries.
2. **Compression order.** Re-reading the same chunk with a sliding window
   re-inflates it. Batch by chunk, or cache decoded chunks.
3. **Filter masks.** HDF5 chunks carry a bitmask of filters that were
   *skipped* for that chunk. Ignore it and you will decode compressed bytes as
   if they were raw — silently corrupt pixels.
4. **Fill values: read the header, not the attribute.** Our granule advertises
   `_FillValue = NaN`, but the Fill Value *message* stores size 0, which means
   "use the type default" = `0.0`. The attribute lied. Trust the header.
5. **`mmap` is virtual memory.** Mapping is free; touching everything is not.
   Measure real commit size (Windows `GetProcessMemoryInfo` /
   `PrivateUsage`), never "we used mmap" as proof.
6. **No silent fallback.** If a window cannot be read, return a typed error.
   Falling back to a full read is a memory bomb disguised as error handling.
7. **Index once, read many.** Cache the chunk index per dataset, never the
   pixel data.

## Checklist for your application

- [ ] No `read_f32()` / `.values` / `ReadRaster(full)` anywhere on the hot path
- [ ] Partial read verified with a byte-for-byte comparison against a
      full read (see the companion verification post)
- [ ] Chunk index built once and reused across windows
- [ ] Fill value, filter mask and edge clipping handled explicitly
- [ ] Peak memory sampled *during* the read, per chunk
- [ ] Typed errors, no full-band fallback
- [ ] A pass bar you can fail: ours was "peak < 300 MB, cold read < 2 s"

## The bigger point

NISAR's products are designed for people who read *windows*. The mission
grids are chunked, compressed and georeferenced precisely so a 10 km AOI
never has to touch 7 GB. Our tools forgot that part.

If your application is OOM-ing on a NISAR granule, the answer is almost never
"buy more RAM". It is "stop asking for the file when you want a window".

---

*Companion posts: how we proved the reader byte-for-byte correct, and the
full engineering diary behind these numbers.*

`#NISAR` `#SAR` `#RemoteSensing` `#HDF5` `#Rust` `#MemoryOptimization` `#InSAR` `#NASA` `#ISRO` `#DataEngineering`
