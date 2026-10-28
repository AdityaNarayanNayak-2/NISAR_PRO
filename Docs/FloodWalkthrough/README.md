# Flood Monitoring, Explained for a Beginner

This folder explains the flood-monitoring part of NISAR Pro **from top to bottom**, in the order the computer runs it. It is written for someone who knows **basic Rust** (variables, `if`, loops, functions, `Result`) but has never seen radar data, HDF5, or a flood algorithm.

The explanations use everyday analogies first and exact Rust details second. Line numbers refer to the source files at the time this walkthrough was written. Blank lines, lone closing braces, and repetitive test fixtures are grouped, but every meaningful line is covered.

---

## 1. The one-sentence story

A satellite shines radar at the ground before a flood and after a flood; water reflects radar very differently from land, so the processor compares the two pictures, marks the pixels that became much darker, cleans up the noise, and writes a flood map plus a report.

That is the whole product. Everything below is the machinery that makes it safe, fast, and accurate.

---

## 2. The cast of files

| File | Job in plain English | Think of it as... |
| :--- | :--- | :--- |
| `sar_science_processor/src/main.rs` | Reads the command line, decides which pipeline to run, and calls every other file in order. | The **conductor** of an orchestra. |
| `sar_science_processor/src/nisar_parser.rs` | Opens a NISAR HDF5 file, finds the radar array, and cuts out only the user's small map window. | The **librarian** who finds one page in a giant book. |
| `sar_science_processor/src/windowed.rs` | Reads only the pieces (chunks) of the HDF5 array that overlap the map window. | A **pizza slicer** that takes two slices instead of baking the whole pizza again. |
| `sar_science_processor/src/flood_detect.rs` | The 7-stage science algorithm that turns pre/post radar values into flood classes. | The **detective** comparing two photos. |
| `sar_science_processor/src/io.rs` | Writes PNG previews, GeoTIFF rasters, and GeoJSON polygons. | The **printer / map maker**. |
| `sar_science_processor/src/lib.rs` | Lists the modules so other files can use them. | The **table of contents**. |
| `sar_science_processor/src/crash_journal.rs` | Writes checkpoints before big memory allocations, so a crash leaves a diary. | A **flight recorder**. |
| `sar_science_processor/src/water_mask.rs` | Reads an optional external water-body mask and applies it. | A **pre-drawn lake map**. |
| `sar_science_processor/src/multilook.rs` | Averages blocks of pixels to reduce noise and size. | Squinting at a photo to see the big shapes. |

The two input products are called **active** (after the event) and **baseline** (before the event). Older docs sometimes call them **master/slave**; in this walkthrough they are always active/baseline.

---

## 3. The big workflow picture

```
User types a command
        |
        v
+---------------------+
| main.rs             |
| parse CLI arguments |
+----------+----------+
           |
           v
+---------------------+       +----------------------+
| nisar_parser.rs     | ----> | windowed.rs          |
| open HDF5, find AOI |       | read only AOI chunks |
+----------+----------+       +----------------------+
           |
           |  active_slc (post)  +  baseline_slc (pre)
           v
+---------------------+
| flood_detect.rs     |
| 7 science stages    |
+----------+----------+
           |
           |  class_map (0..4) + report
           v
+---------------------+
| io.rs               |
| PNG / GeoTIFF / JSON|
+----------+----------+
           |
           v
    Files on disk + JSON events for the dashboard
```

"**AOI**" means **Area Of Interest**: the small rectangle around the town, dam, or field the user cares about. A NISAR granule can cover hundreds of kilometres; we never want to load all of it.

---

## 4. Five ideas you need before reading the code

### 4.1 Radar sees roughness, not colour

A radar satellite sends a pulse and measures the echo. A building or tree scatters the pulse in many directions, so a lot of energy comes back: the pixel is **bright**. Calm water acts like a mirror and sends the pulse away from the satellite, so almost nothing comes back: the pixel is **dark**.

So "flood" means: *the after-image is much darker than the before-image.*

### 4.2 Decibels (dB) make huge numbers friendly

Radar power can range from `0.0000001` to `1000`. Engineers compress that range with a logarithm:

```
power_db = 10 * log10(power)
```

Doubling the power is about `+3 dB`; dividing by ten is `-10 dB`. A flood pixel may drop by `-3 dB` to `-15 dB`. A drop is a **negative change**, which is why the command-line defaults are negative numbers.

### 4.3 Complex numbers store radar phase and amplitude

A radar echo has an amplitude (how strong) and a phase (where in the wave cycle). Rust stores both in one `Complex32`:

```rust
Complex32::new(real_part, imaginary_part)
```

For GCOV files the useful power is already in the **real part** and the imaginary part is `0.0`, which is why `flood_detect.rs` reads `c.re`.

### 4.4 HDF5 is a giant file cabinet

A `.h5` file is a tree of named arrays, like folders and files:

```
/science/LSAR/GCOV/grids/frequencyA/HHHH     <- the radar numbers
/science/LSAR/GCOV/grids/frequencyA/xCoordinates
/science/LSAR/GCOV/grids/frequencyA/yCoordinates
/science/LSAR/GCOV/metadata/processingInformation/parameters
```

NISAR can write these arrays in **chunks**: independent compressed blocks. `windowed.rs` finds the chunks under the AOI and decodes only those. That is the difference between needing 8 GB of RAM and needing about 30 MB.

### 4.5 A pixel class is just a small integer

The final map stores one `u8` per pixel:

| Value | Meaning |
| :---: | :--- |
| `0` | Land / no flood |
| `1` | Permanent water (lake, river that was already there) |
| `2` | New flood, high confidence |
| `3` | New flood, medium confidence |
| `4` | New flood, low confidence |

---

## 5. Read the walkthrough in this order

| Part | File explained | What you will learn |
| :--- | :--- | :--- |
| [01 - main.rs](./01-main.md) | `main.rs` | How a command becomes a pipeline, and every flood step in order. |
| [02 - nisar_parser.rs](./02-nisar-parser.md) | `nisar_parser.rs` | How the HDF5 file is opened, how coordinates become row/column numbers, and how cropping works. |
| [03 - windowed.rs](./03-windowed.md) | `windowed.rs` | How to read only the useful chunks of a huge array without loading the whole file. |
| [04 - flood_detect.rs](./04-flood-detect.md) | `flood_detect.rs` | The seven science stages, including Otsu thresholding and region growing. |
| [05 - io.rs](./05-io.md) | `io.rs` | How arrays become PNG, GeoTIFF, and GeoJSON files. |
| [06 - end-to-end.md](./06-end-to-end.md) | all files | One complete run, a glossary, common failures, and small exercises. |

---

## 6. A note about "loops everywhere"

This code uses Rust idioms that can look strange at first:

| You see | It means |
| :--- | :--- |
| `&Array2<f32>` | "Let me borrow a 2-D array; I promise not to destroy it." |
| `&mut Array2<f32>` | "Let me borrow it and change it in place." |
| `Option<T>` | "There may be a `T`, or there may be nothing." |
| `Result<T, E>` | "Either success `T`, or failure `E`." |
| `?` | "If this failed, return the error to my caller now." |
| `mapv(...)` | Apply a small function to every element of an array. |
| `for r in 0..rows` | Repeat for row `0`, `1`, ... up to `rows - 1`. |
| `[[r, c]]` | The pixel at row `r`, column `c`. Rows grow downward (north to south). |
| `drop(x)` | "I am finished with `x`; free its memory now." |
| `println!("{{\"event\":...}}")` | Print one line of JSON that the gateway/dashboard can parse. |

Continue to [01 - main.rs](./01-main.md).
