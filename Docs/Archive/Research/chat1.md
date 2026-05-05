Understood — you want to call ISCE3 C++ directly from Rust (cxx/bindgen), run on CPU-only edge servers, and get an end-to-end L0B → RSLC pipeline you can scale later in K8s. Below I give:

• (1) a focused, file-by-file mapping for the CPU path from Raw (L0B) → RSLC (Range‑Doppler focusing) — the key C++ components to wrap, what each does, and direct repo links; and
• (2) a practical C++ facade / Rust interop design (cxx-preferred) with API sketch, build notes, memory & performance recommendations for CPU-only deployment, and next actionable steps (I can generate code for these next).

If anything below should target GRD/RTC or geocoding as first-class outputs, tell me and I’ll add that mapping.

1) Key CPU components to wrap (L0B → RSLC) — file-level mapping and role
(These are the CPU implementations you will call from Rust. I show file path + what to wrap.)

• Raw product ingestion / HDF5 helpers
  - Purpose: read NISAR L0B HDF5 (metadata, chirp, PRF, orbit/attitude, antenna patterns) and read raw echo arrays (block reads).
  - Repo helper (python): python/packages/nisar/h5/h5utils.py — useful for understanding HDF5 layout and attributes (but Python only).
    - https://github.com/isce-framework/isce3/blob/develop/python/packages/nisar/h5/h5utils.py
  - Recommendation: implement a small C++ RawReader that uses HDF5 C/C++ API to extract:
    - metadata struct (sensingStart, sampleRate, prf, chirp params, center frequency, polarization, grid sizes)
    - block reader method read_raw_block(line_start, n_lines, buffer*)
  - Rationale: ISCE3’s NISAR product readers live in Python layers; for robust performance you should implement/port a thin HDF5 reader in C++ and expose it.

• Range compression (CPU)
  - Files:
    - cxx/isce3/focus/RangeComp.h
      - https://github.com/isce-framework/isce3/blob/develop/cxx/isce3/focus/RangeComp.h
    - cxx/isce3/focus/RangeComp.cpp
      - https://github.com/isce-framework/isce3/blob/develop/cxx/isce3/focus/RangeComp.cpp
  - Purpose: build reference function (chirp spectrum) and perform FFT-based pulse compression (supports batching, OpenMP parallel loops).
  - What to wrap: RangeComp class (constructor from chirp, rangecompress(out, in, batch), applyNotch(), chirp_spectrum()).

• Chirp formation / utility
  - Files (CPU chrirp helpers are used by RangeComp and Python glue):
    - cxx/isce3/focus/Chirp.* (look up in repo under cxx/isce3/focus — Python bindings exist)
    - Python binding file: python/extensions/pybind_isce3/focus/focus.cpp shows chirp bindings
      - https://github.com/isce-framework/isce3/blob/develop/python/extensions/pybind_isce3/focus/focus.cpp
  - Purpose: create chirp reference from chirp parameters when needed.

• Azimuth focusing (Backprojection, CPU)
  - Files:
    - cxx/isce3/focus/Backproject.h and corresponding .cpp (CPU)
      - header: https://github.com/isce-framework/isce3/blob/develop/cxx/isce3/focus/Backproject.h
      - Note: there is also a CUDA backproject alternative; for CPU-only use the CPU backproject implementation (the header above).
  - Purpose: time-domain backprojection focusing (azimuth compression) using input range-compressed data, doppler/orbit/geometry.
  - What to wrap: backproject function(s) — the CPU API accepts packed in/out geometries, DEM/Orbit/ Doppler LUT objects.

• Doppler estimation & LUT containers
  - Python-side logic - isce3::core::LUT2d (used across geometry and focusing modules). You will either:
      - build a Doppler LUT in C++ (preferred), or
      - compute it using the logic in the Python file and port the parts you need to C++.
  - What to wrap/implement:
    - A C++ function compute_doppler_lut(raw_reader, orbit, attitude, params) returning a serializable LUT2d-like struct (x_start/spacing/width, y_start/spacing/length, data vector).

• Geometry & rdr2geo / geo2rdr
  - Filesgeo_bracket / geo2rdr_bracket functions used by backproject and geocode modules.

• Geocoding / remapping (if you plan Geo products)
  - Files:
    - cxx/isce3/geocode/geocodeSlc.cpp and geocode helpers
      - Example: geocodeSlc.cpp contains CPU geocoding loops and baseband removal logic
      - https://github.com/isce-framework/isce3/blob/develop/cxx/isce3/geocode/geocodeSlc.cpp
  - Purpose: resample SLC to map grid (GeoTIFF, GRD).

• Calibration LUTs & antenna helpers
  - Files:
    - python/packages/isce3/focus/calibration_luts.py (Python-level)
      - https://github.com/isce-framework/isce3/blob/develop/python/packages/isce3/focus/calibration_luts.py
    - ElNullRangeEst C++ class + pybind (antenna null estimation) — used for antenna corrections
      - pybind wrapper: python/extensions/pybind_isce3/antenna/ElNullRangeEst.cpp
      - https://github.com/isce-framework/isce3/blob/develop/python/extensions/pybind_isce3/antenna/ElNullRangeEst.cpp
  - Purpose: radiometric corrections and antenna pattern compensation.

2) Which of these you should call from Rust (priority)
• Mandatory for RD focusing:
  1. RawReader (C++ HDF5 reader) — you must expose raw access
  2. RangeComp (cxx/isce3/focus/RangeComp) — core range-compress CPU code
  3. Doppler LUT generator (implement in C++ or port necessary parts from Python)
  4. Backproject (cxx/isce3/focus/Backproject CPU implementation) — CPU azimuth focus
  5. Geometry functions (rdr2geo/geo2rdr) for geometry & mapping
• Optional / later:
  - Geocoding (geocodeSlc)
  - Calibration/antenna functions
  - GPU code (not needed for C++ façade & Rust interop design (cxx preferred)
High-level approach (practical & safe):

• Why cxx:
  - cxx crate provides safe interop for idiomatic C++ (std::string, std::vector) and is usually easier/safer than raw bindgen for modern C++ classes.
  - But cxx cannot bind all C++ patterns (templates, complex hierarchies). For complex classes (Orbit, Attitude, LUT2d) you can:
    - create simple C++ wrapper types with C++-safe public methods (std::vector/std::string/structs) and expose them via cxx, or
    - create small extern "C" C API and use bindgen to generate Rust bindings.

Facade API sketch (header-like pseudocode you can implement in C++):

• Types (repr in both C++ & Rust):
  - struct Metadata { double sensing_start; double sample_rate; double prf; int n_lines; int n_samples; double center_freq; /etc/ };
  - struct Grid { double x_start, x_spacing; int width; double y_start, y_spacing; int length; std::vector<float> data; }  // for LUT2d serialization
  - struct ComplexF32 { float re; float im; }; // repr(C) if needed

• Class & functions:
  - class RawReader {
        RawReader(std::string path);
        Metadata metadata();
        // read num_lines x num_samples into preallocated buffer (row-major, complex interleaved)
        void read_block(int line_start, int n_lines, ComplexF32* out_buffer);
        void close();
    };
  - class Processor {
        Processor(); ~Processor();
        // Range compression: pass chirp params (or chirp vector) and input buffer pointer (num_lines x num_samples)
        void prepare_rangecomp(std::vector<ComplexF32> chirp, int input_size, int max_batch);
        void rangecompress(ComplexF32 out, const ComplexF32 in, int batch);
        // Doppler LUT: return Grid describing doppler LUT
        Grid compute_doppler_lut(RawReader& raw, std::string orbit_file, std::string attitude_file, Params params);
        // Azimuth focus/backproject: provide in/out buffers and geometries
        void backproject(Grid &out_grid_metadata, ComplexF32 out, const Grid& in_geometry, const ComplexF32 in);
    };

• C++ error handling:
  - Methods return exceptions internally — but the facade should catch exceptions and return error codes or set last_error message accessible by get_last_error() to avoid exceptions crossing into Rust.

• cxx bridge:
  - Use cxx::bridge to define the above structs and methods with types cxx supports (std::string, Vec<T>, shared_ptr for classes).
  - For classes containing pointers to heavy C++ objects (Orbit, DEM, LUT2d) prefer storing them inside the Processor C++ object and expose handle methods.

4) Memory layout & zero-copy recommendations
• Use a plain ComplexF32 struct (repr(C)) and ensure both Rust and C++ agree on layout.
• For large arrays, have Rust allocate Vec<ComplexF32> and pass a mutable pointer or use cxx’s &mut [T] support (cxx supports exchanging Vec<T> limited ways). Alternatively, allocate buffers in C++ and expose as boxed/cxx::UniquePtr and map on Rust side.
• Avoid copying if possible: implement read_block to fill a caller-provided buffer to avoid extra copies from HDF5 reading.
• Use streaming: process raw data in blocks/tiles so memory fits edge server.

5) CPU-only performance & threading
• ISCE3 CPU code uses OpenMP in many places (RangeComp rangecompress uses #pragma omp). Ensure you build with OpenMP enabled and set environment variable OMP_NUM_THREADS to control parallelism on your node.
• Batch processing: use "maxbatch" call and amortize cost.
• FFT backend: ISCE3 uses its own FFT plan wrapper around FFTW/other libs — ensure FFTW (or the linked backend) is installed for best performance.
• For multicore edge servers:
  - tune OMP_NUM_THREADS and the C++ facade to avoid oversubscription (if you spawn multiple Rust worker threads call into C++ ensure Processor objects are not contended).
• I/O bottleneck:
  - Use HDF5 chunked reads and memmap if possible.
  - If raw HDF5 is stored remotely, copy the needed subset locally before processing.

6) K8s scaling (CPU-only)
• Strategy: horizontal scaling via tiling
  - Partition processing by geographic tile (range/azimuth blocks) or time segments. Each pod receives an L0B product or subrange to focus.
  - Use shared storage / object store (S3) to pull L0B files to local pod scratch storage for processing.
  - Ensure each pod runs with CPU limits/requests tuned and sets OMP_NUM_THREADS so multi-threaded C++ uses pod CPU allocation correctly.
• Container image:
  - Build a container with ISCE3 libraries + your facade + Rust binary. For CPU-only base images, use ubuntu/debian and install dependencies: HDF5, FFTW, Eigen, libs required by ISCE3.
  - At runtime set environment variables to control parallelism (OMP_NUM_THREADS, OMP_PLACES, etc.).

7) Build & packaging notes
• Build ISCE3 (develop branch) using CMake as in repo instructions; build static or shared libs for the components you need.
• Add a CMake target that builds your C++ façade and produces a shared library (libisce3proc.so).
• Use the same compiler/toolchain to build ISCE3 and your façade to avoid ABI mismatches.
• In Rust:
  - If using cxx: add cxx to    - println!("cargo:rustc-link-search=native=/path/to/lib");
  - If you prefer a C ABI façade, expose extern "C" C functions and use bindgen.

8) Validation & testing
• Start with a minimal end-to-end prototype:
  - load a small L0B subset (few azimuth lines),
  - range compress it using RangeComp,
  - compute a simple (1D) Doppler estimate,
  - run backproject for a small tile,
  - write RSLC HDF5 or raw binary and compare magnitudes to the ISCE3 Python run (sanity check).
• Unit tests: reuse ISCE3 tests (there are C++ tests for RangeComp) as references — see tests/cxx/isce3/focus/rangecomp.cpp
  - https://github.com/isce-framework/isce3/blob/develop/tests/cxx/isce3/focus/rangecomp.cpp

9) Actionable next steps I can do for you (pick one)
• A — Produce the actual C++ facade header + implementation skeleton (header + .cpp) that wraps RangeComp + a minimal RawReader, plus build CMake changes to produce libisce3proc; and produce the matching Rust cxx::bridge code and a small Rust example that calls rangecompress on a test buffer. (I recommend starting here.)
• B — Produce a full file-by-file mapping for every function used by the full L0B → RSLC → geocode pipeline (long list). (You previously asked for B2; I can produce exhaustive mapping.)
• C — Create a minimal end-to-end code prototype (C++ facade + Rust consumer) that reads a tiny HDF5 sample (I can use a placeholder API since I can’t access your L0B), and runs range compression + backproject on CPU sample data.

Which do you want me to do next? If A, tell me:
• preferred Rust FFI style: cxx (recommended) or C ABI + bindgen?
• do you want the facade to include Backproject (az comp) now or RangeComp + RawReader first?
• Give a minimal example L0B path or a small synthetic test (I can create synthetic chirp + raw data example).

If you want B (full mapping), I’ll produce a long file-by-file map showing exact functions and where they are implemented in the develop branch, including links.