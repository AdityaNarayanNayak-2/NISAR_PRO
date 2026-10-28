# Part 3 - `windowed.rs`: reading two slices, not the whole pizza

File: `sar_science_processor/src/windowed.rs` (975 lines)

This is the memory hero of the flood pipeline. A real NISAR GCOV band can be 8-10 GB. Loading it all into RAM (`read_f32()`) can need 30-40 GB and crash a normal laptop. But an AOI around a town is only a few hundred pixels wide. `windowed.rs` opens the file, finds the compressed **chunks** that overlap the AOI, decodes only those chunks, and copies the useful pixels into a small array.

The price: it must understand the HDF5 file format at a low level. That is why this file has many error variants and strict checks.

---

## 1. The idea of chunks (lines 1-11)

An HDF5 dataset stores its pixels in a grid of blocks called chunks.

```
Dataset 16000 x 16000, chunk size 1024 x 1024
+----+----+----+ ... +
| A  | B  | C  |     |
+----+----+----+     |
| D  | E  | F  |     |
+----+----+----+     |
```

If the AOI is inside chunk `E`, the reader decodes only `E` (and any other chunk the rectangle touches). It never touches the other 200+ chunks. Memory is proportional to the AOI, not the scene.

`rustyhdf5`'s easy API does not expose partial reads, so this module uses `rustyhdf5_format` (the low-level parser) directly.

---

## 2. Imports and constant (lines 13-30)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 13-15 | `HashMap`, `fmt`, `Path` | A hash map for the index cache, formatting for errors, and a file path type. |
| 17 | `use rustyhdf5::MmapFile;` | Memory-map a file: make it look like a giant byte slice without copying it into RAM. |
| 18 | `collect_chunk_info` | Walk HDF5's B-tree index and list every chunk. |
| 19-27 | format parsers | Types for layout, shape, datatype, filters, object headers, and the superblock. |
| 30 | `pub const ELEMENT_SIZE: u64 = 4;` | Each value is a 32-bit float = 4 bytes. |

Memory mapping is important: opening a 10 GB file costs almost nothing because the operating system pages in only the bytes actually touched.

---

## 3. `WindowError` (lines 32-117)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 32-33 | `#[derive(Debug)] pub enum WindowError` | Every possible failure is its own variant, so callers can tell "file missing" from "unsupported compression". |
| 35-68 | variants | `Open`, `NotFound`, `UnsupportedRank`, `UnsupportedDatatype`, `UnsupportedLayout`, `UnsupportedFilter`, `MissingChunkIndex`, `InconsistentOffsets`, `BadWindow`, `ChunkOutOfFile`, `ShortChunk`, `SizeOverflow`, `Format`. Each name says exactly what went wrong. |
| 71-109 | `impl fmt::Display` | Human-readable messages for each variant. `write!(f, ...)` writes into the formatter. |
| 111 | `impl std::error::Error` | Marks it as a standard error type. |
| 113-117 | `impl From<FormatError>` | Lets `?` convert a low-level format error into `WindowError::Format` automatically. |

Why so strict? If the reader meets a layout it does not fully understand, it must refuse rather than return garbage numbers. A wrong flood map is worse than a clear error.

---

## 4. `Window` (lines 119-157)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 119-127 | `pub struct Window { row_start, row_end, col_start, col_end }` | A half-open pixel rectangle. `row_end` and `col_end` are not included. |
| 128-130 | `rows()` | Height = `row_end - row_start`. |
| 131-133 | `cols()` | Width. |
| 134-136 | `elements()` | Total pixels = height * width. |
| 138-156 | `validate(rows, cols)` | Reject an empty/inverted window (`start >= end`) and a window that reaches past the dataset. Return `Ok(())` if valid. |

These checks are cheap and prevent out-of-bounds panics later.

---

## 5. `WindowStats`, `ChunkIndex`, and `ChunkedF32Reader` (lines 159-273)

### 5.1 `WindowStats` (lines 159-171)

| Line(s) | Field | Plain English |
| :---: | :--- | :--- |
| 161-171 | `cells_touched`, `chunks_decoded`, `chunks_missing`, `compressed_bytes`, `decoded_bytes`, `elapsed_ms` | Telemetry: how many chunk slots the window covers, how many actually existed and were decoded, how many were absent (filled with the fill value), and timing/size numbers. |

### 5.2 `ChunkIndex` (lines 173-199)

| Line(s) | Field | Plain English |
| :---: | :--- | :--- |
| 175-192 | dataset/shape/chunk shape/fill/pipeline | Everything needed to decode without re-parsing the file header. |
| 186-187 | `chunks: HashMap<(u64, u64), ChunkInfo>` | The chunk index, keyed by the chunk's top-left pixel `(row, col)`. |
| 189 | `stored_chunks` | How many chunks the index reported. |
| 191 | `grid_cells` | Number of chunk slots implied by the dataset shape. |

### 5.3 `ChunkedF32Reader` (lines 201-273)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 202-205 | `file: MmapFile`, `cache: HashMap<String, ChunkIndex>` | One memory-mapped file and a cache of indexes, one per dataset path. |
| 209-217 | `open(path)` | Map the file and start with an empty cache. |
| 220-222 | `file_len()` | Length of the mapped file, used in bounds checks. |
| 224-227 | `cached_indexes()` | How many dataset indexes are cached. |
| 230-237 | `ensure_index(dataset)` | If the dataset is not cached, build its index and insert it. |
| 240-242 | `index_of(dataset)` | Borrow a cached index. |
| 245-248 | `read_window(dataset, window)` | Convenience wrapper that ignores progress callbacks and returns only the data. |
| 251-272 | `read_window_with(...)` | Start a timer, ensure the index, call `read_window_from_with`, then record elapsed time, fire the callback one last time, shrink the vector, and return `(data, stats)`. |

`.expect("index inserted by ensure_index")` is justified: the line immediately above guarantees the key exists unless the program has a bug.

---

## 6. `parse_fill_value` (lines 275-323)

Some chunks may be missing from the file (for example, all-nodata regions are often not stored). Those pixels get a **fill value** from the dataset header.

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 275-283 | doc comment | The byte layout: version, allocation flags, write flags, defined flag, 4-byte size, then the value. A size of zero means "use the default". |
| 284-288 | length guard | The message must be at least 8 bytes. |
| 289 | `version = msg[0]` | HDF5 fill-value message version (1 or 2). |
| 290 | `defined = msg[3]` | Whether a value is defined. |
| 291-295 | version check | Refuse unknown versions. |
| 296 | `size = u32::from_le_bytes(...)` | Read the 4-byte little-endian size. |
| 298-303 | size zero | Default fill `0.0`, with a note about the defined flag. |
| 304-311 | size must be 4 | This dataset is `f32`, so a stored fill must be 4 bytes. Anything else (e.g. an 8-byte `f64` value) is refused rather than misread. |
| 312-318 | read value | The value starts at byte 8; parse 4 bytes into `f32`. |
| 319-322 | return | `(value, description)`. |

The description string ends up in logs/reports so a human can see whether the fill was stored or defaulted.

---

## 7. `build_index` (lines 325-520)

This is the most format-heavy function. It reads the dataset header and builds a map from chunk position to chunk byte range.

### 7.1 Find the dataset and its messages (lines 326-337)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 326-334 | `resolve_path_any` | Follow the HDF5 group tree to the dataset's object header address. `as usize` is needed because the parser slices a byte array. |
| 335 | `ObjectHeader::parse` | Parse the header using the superblock's offset/length sizes. |
| 337 | `msg` closure | Helper: find the first header message of a given type. |

### 7.2 Shape (dataspace) (lines 339-351)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 339-346 | `Dataspace` | Parse the shape message. Missing -> error. |
| 347-349 | `rank != 2` | Only 2-D arrays are supported. |
| 350-351 | rows/cols | The dataset dimensions. |

### 7.3 Datatype (lines 353-395)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 353-356 | parse | Get the datatype description. |
| 357-388 | floating-point checks | Require 4-byte, little-endian IEEE-754 binary32: size 4, offset 0, precision 32, mantissa 23, exponent 8, bias 127. Anything else is refused. |
| 390-394 | missing message | Error. |

### 7.4 Layout and chunk dimensions (lines 397-444)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 397-404 | parse layout | Missing -> error. |
| 405-421 | `match layout` | Only `Chunked` is supported; extract chunk dimensions, B-tree address, and version. |
| 422-426 | at least 2 chunks dims | Error otherwise. |
| 427-431 | version 3 | Only the chunked layout version this reader understands. |
| 432-434 | B-tree address | A zero/missing address means no usable chunk index. |
| 436-437 | chunk shape | Convert to `u64`. |
| 438-444 | sanity check | Chunks must be nonzero and no larger than the dataset. |

### 7.5 Filter pipeline (lines 446-453)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 446-452 | parse pipeline | Compression/filter messages (shuffle, deflate, fletcher32). No pipeline means an empty list. |
| 453 | `validate_pipeline_filters(...)` | Reject filters this reader cannot undo. |

### 7.6 Fill value (lines 455-465)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 458-459 | complete message | Parse normally. |
| 460-463 | truncated message | Treat as "no value stored", default `0.0`. |
| 464 | no message | HDF5 default `0.0`. |

### 7.7 Read the chunk B-tree (lines 467-502)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 467-470 | `collect_chunk_info` | Walk the B-tree and return one record per stored chunk. |
| 472 | map | Pre-allocate a map. |
| 473-478 | offsets count | A 2-D chunk needs at least 2 offsets; otherwise the index is inconsistent. |
| 479 | key | The chunk's top-left `(row, col)` is the key. |
| 480-487 | bounds | Reject chunks outside the dataset. |
| 488-495 | grid alignment | The chunk offset must be a multiple of the chunk size. |
| 496-500 | extra dimensions | Any higher offsets must be zero (no 3-D selection). |
| 501 | insert | Store the chunk info. |

### 7.8 Finish the index (lines 504-519)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 504-505 | grid counts | `rows.div_ceil(chunk_rows)` = how many chunk rows are needed, rounding up. |
| 507-519 | construct | Store shape, chunk shape, fill, pipeline, counts, and the map. |

---

## 8. B-tree address and filters (lines 522-563)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 522-527 | `btree_address_of` | Treat `None` or `0` as "no B-tree"; return `Some(address)` only for a real address. |
| 535-543 | `validate_pipeline_filters` | Only filter IDs `1` (deflate), `2` (shuffle), and `3` (fletcher32) are supported. Anything else (SZIP, N-bit, scale-offset) is rejected at index time. |
| 548-563 | `pipeline_for_chunk` | A chunk's `filter_mask` says which filters were **skipped** for that chunk. Bit `i` set means filter `i` was not applied, so drop it. Otherwise decoding would unshuffle/uncompress data that was never shuffled/compressed. |

---

## 9. `read_window_from_with` (lines 578-678) - the actual read

This is where a window becomes pixels.

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 578-586 | signature | Take an index, the mapped file bytes, a window, and a callback. The callback receives stats after every chunk (useful for live memory measurement). |
| 587 | `window.validate(...)` | Refuse empty/inverted/out-of-range windows. |
| 589-590 | `win_cols`, `elements` | Width and pixel count of the output. |
| 591-593 | `out_len` | Convert `u64` to `usize`; error on overflow. |
| 594 | `file_len` | For chunk bounds checks. |
| 596 | `let mut out = vec![index.fill; out_len];` | Allocate the output, pre-filled with the dataset's fill value. Missing chunks stay at this value. |
| 597 | `stats` | Start all counters at zero. |
| 599-602 | chunk range | Find the first/last chunk row and column that overlap the window. Integer division maps pixel -> chunk. |
| 604-607 | expected bytes | Every decoded chunk should be `chunk_rows * chunk_cols * 4` bytes. |
| 609-611 | outer loops | Visit every chunk slot in the overlapping grid. |
| 612 | `key` | Absolute `(row, col)` of the chunk's top-left. |
| 613-620 | missing chunk | If the index has no chunk there, increment `chunks_missing`, call the callback, and `continue`. |
| 622-634 | byte range | `start = info.address`, `end = start + info.chunk_size`, check for arithmetic overflow and for reading past the file. |
| 635-637 | slice | Borrow the compressed chunk bytes from the memory map. |
| 639-640 | decode | Rebuild the filter list for this chunk and call `decompress_chunk` with the expected size and element width. |
| 641-647 | length check | A short/long decode is an error, never silently accepted. |
| 648-650 | stats | Count decoded chunks and bytes. |
| 652-655 | chunk bounds | `chunk_r1`/`chunk_c1` are clamped to the dataset edges for the last row/column of chunks. |
| 657-660 | overlap | Intersect the chunk rectangle with the requested window: `src_r0..src_r1`, `src_c0..src_c1`. |
| 662 | `width` | How many pixels to copy per row. |
| 664-671 | copy loop | For each row, compute the source offset inside the decoded chunk and the destination offset inside `out`, reinterpret the bytes as `f32`, and copy the row. |
| 673 | callback | Report stats after each chunk. |
| 677 | return | `(out, stats)`. |

The source offset formula:

```
src_off = ((row - chunk_r0) * chunk_cols + (src_c0 - chunk_c0))
```

and the destination:

```
dst_off = ((row - window.row_start) * win_cols + (src_c0 - window.col_start))
```

Both are row-major: move across the row first, then down.

---

## 10. `bytemuck_cast` (lines 680-683)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 680-683 | `fn bytemuck_cast(bytes: &[f32])` | Reinterpret a byte slice as `f32` without copying. `as_ptr() as *const f32`, then `std::slice::from_raw_parts`. |

This is `unsafe` because Rust cannot verify that the bytes are valid `f32` bit patterns or correctly aligned. The code has already checked that the chunk decoded to the expected length and that the file declares `f32`, so the values are valid. Alignment relies on the decoded buffer's allocation; a future cleanup could use a checked conversion crate instead.

---

## 11. Tests (lines 685-975)

| Test | What it proves |
| :--- | :--- |
| `pipeline_for_chunk_drops_masked_filters` | `filter_mask` bits remove the correct filters. |
| `fill_value_message_is_decoded_from_the_header` | Version 1, version 2, default fill, and the wrong-size rejection all behave. |
| `window_validation_rejects_inverted_and_out_of_range` | Bad windows are rejected before reading. |
| `unsupported_filters_are_refused_at_index_build` | Only deflate/shuffle/fletcher32 are accepted. |
| `fully_masked_chunk_is_passed_through_raw` | When every filter is skipped, raw bytes survive untouched. |
| `short_decoded_chunk_is_a_typed_error` | A short decode returns `ShortChunk`, not a panic. |
| `chunk_address_past_eof_is_a_typed_error` | A corrupt address returns `ChunkOutOfFile`. |
| `absent_chunks_are_filled_from_the_header_value` | Missing chunks become the fill value. |
| `progress_callback_sees_every_chunk` | The callback fires once per chunk slot, not only at the end. |

The hand-built `ChunkIndex` helper (lines 860-877) lets these error paths be tested without a real 8 GB fixture.

Next: [04 - flood_detect.rs](./04-flood-detect.md), the science.
