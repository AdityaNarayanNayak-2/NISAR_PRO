GitHub Copilot Chat Assistant

Plan: I will give you a concrete, minimal C++ façade + Rust cxx bridge to wrap ISCE3 RangeComp and a simple RawReader (HDF5). This will let you:

• read raw blocks from an L0B HDF5 product into a caller-provided buffer, and
• perform CPU FFT-based range compression with ISCE3 RangeComp.

I’ll include:
1. design and short rationale
2. C++ façade header + implementation skeleton (RangeComp + RawReader)
3. cxx bridge definition (Rust side)
4. Cargo build.rs and Cargo.toml snippets + CMake notes to build the façade as a shared lib and link ISCE3
5. minimal Rust usage example showing range compression on a block
6. practical notes (memory layout, threading, dependencies, testing)

Confirm after you review and I will:
• produce full files you can drop into your repo (cpp/h/cmake/rust),
• or iterate the façade to add Backproject later.

1) Design summary (why this approach)
• Use a small C++ façade that owns heavy C++ objects (HDF5 reading, ISCE3 RangeComp) and expose a narrow API to Rust.
• Use the cxx crate for safe, ergonomic interop with std::string and std::vector and class handles.
• Keep GPU code out (you said CPU-only). Use ISCE3 CPU RangeComp (uses FFTW/OpenMP).
• Read HDF5 directly from C++ (HDF5 C/C++ API) to avoid Python dependency and to stay efficient.
• Zero-copy data path: Rust allocates Vec<ComplexF32>, passes pointer to C++ read_block & rangecompress to avoid extra copies.

2) C++ façade header (RangeCompFacade.h)
• save as cxx_iface/RangeCompFacade.h

```c++
#pragma once
#include <string>
#include <vector>
#include <memory>
#include <complex>

// Forward-declare ISCE3 RangeComp
namespace isce3 { namespace focus {
    class RangeComp;
}}

struct ComplexF32 {
    float re;
    float im;
};

// Simple metadata returned to Rust
struct RawMetadata {
    double sensing_start;
    double sample_rate;
class RawReader {
public:
    // throws std::runtime_error on error
    RawReader(const std::string &h5path, const std::string &dataset_path);
    ~RawReader();

    RawMetadata metadata() const;

    // read 'n_lines' starting at 'line_start' into caller-provided buffer
    // buffer must be at least n_lines * n_samples elements
    // returns number of lines read
    int read_block(int line_start, int n_lines, ComplexF32* buffer);

    void close();

private:
    struct Impl;
    std::unique_ptr<Impl> _impl;
};


class RangeCompFacade {
public:
    // Construct with chirp vector (time-domain samples) and input size (samples per range line)
    RangeCompFacade(const std::vector<ComplexF32>& chirp, int inputsize, int maxbatch=1, int mode=0);
    ~RangeCompFacade();

    // Compress a batch; 'inbuf' must contain batchinputsize values; outbuf must be batchoutputSize()
    // returns outputSize()
    int output_size() const;
    int first_valid_sample() const_ptr<Impl> _impl;
};

// error helper
std::string get_last_error();
```

3) C++ façade implementation sketch (RangeCompFacade.cpp)
• save as cxx_iface/RangeCompFacade.cpp
• Important: catch exceptions and set last_error

```c++
#include "RangeCompFacade.h"
#include <isce3/focus/RangeComp.h>
#include <isce3/focus/Chirp.h> // if needed
#include <H5Cpp.h> // HDF5 C++ API
#include <stdexcept>
#include <cstring>
#include <mutex>

static thread_local std::string tls_last_error;

std::string get_last_error() {
    return tls_last_error;
}

// Helper to convert ComplexF32 <-> std::complex<float>
static inline std::complex<float> to_cpx(const ComplexF32 &c) { return {c.re, c.im}; }
static inline ComplexF32 from_cpx(const std::complex<float> &c) { return {c.real(), c.imag()}; }

/ RawReader Impl /
struct RawReader::Impl {
    H5::H5File file;
    H5::DataSet ds;
    Raw]);

        // Fill meta with placeholder values or read attributes
        meta.n_lines = n_lines;
        meta.n_samples = n_samples;
        meta.sample_rate = 1.0; // read actual attributes...
        meta.sensing_start = 0.0;
        meta.prf = 0.0;
        meta.center_freq = 0.0;
    }

    int read_block(int line_start, int nread, ComplexF32* buffer) {
        // read hyperslab: [line_start : line_start+nread, 0 : n_samples]
        H5::DataSpace filespace = ds.getSpace();
        hsize_t offset[2] = { static_cast<hsize_t mdims[2] = { static_cast<hsize_t>(nread), static_cast<hsize_t>(n_samples) };
        H5::DataSpace memspace(2, mdims);

        // Define a compound type if raw dataset is complex interleaved; for simplicity assume 2x float dataset [2] or complex64 native.
        // Here we attempt to read as float32 interleaved IQ stored as [nread, n_samples, 2] or complex64. Adapt to product layout.

        // Fallback approach: read into temporary buffer of floats (2*N) and convert
        std::vector<float> tmp(nread  n_samples  2);
        H5::CompType float2_type(sizeof(float)*2);
        float2_type.insertMember("i", 0, H5::PredType::NATIVE_FLOAT);
        float2_type.insertMember("q", sizeof(float), H5::PredType::NATIVE_FLOAT);

        try {
            ds.read(tmp.data(), float2_type, memspace, filespace);
        } catch (...) {
            throw;
        }

        // convert
        size_t cnt = size_t(nread) * size_t(n_samples);
        for (size_t i = 0; i < cnt; ++i) {
            buffer[i].re = tmp[2*i];
            buffer[i].im = tmp[2*i + 1];
        }
        return nread;
    }
};

/ RawReader methods /

RawReader::RawReader(const std::string &h5path, const std::string &dataset_path) {
    try {
        _impl = std::make_unique<Impl>(h5path, dataset_path);
    } catch (const std::exception &e) {
        tls_last_error = e.what();
        throw;
    }
}

RawReader::~RawReader() = default;

RawMetadata RawReader::metadata() const {
    return _impl->meta;
}

int RawReader::read_block(int line_start, int n_lines, ComplexF32* buffer) {
    try {
        return _impl->read_block(line_start, n_lines, buffer);
    } catch (const std::exception &e) {
        tls_last_error = e.what();
        throw;
    }
}

void RawReader::close() {
    _impl.reset();
}

/ RangeCompFacade impl /

struct RangeCompFacade::Impl {
    std::unique_ptr<isce3::focus::RangeComp> rc;
    int inputsize;
    Impl(const std::vector<ComplexF32>& chirp, int inputsize, int maxbatch, int mode) 
        : inputsize(inputsize) {
        // convert chirp -> std::vector<std::complex<float>>
        std::vector<std::complex<float>> chirp_c(chirp.size());
        for (size_t i = 0; i < chirp.size(); ++i) chirp_c[i] = to_cpx(chirp[i]);
        // mode mapping: 0 => Full, 1 => Valid, 2 => Same
        isce3::focus::RangeComp::Mode m = isce3::focus::RangeComp::Mode::Full;
        if (mode == 1) m = isce3::focus::RangeComp::Mode::Valid;
        else if (mode == 2) m = isce3::focus::RangeComp::Mode::Same;
        rc = std::make_unique<isce3::focus::RangeComp>(chirp_c, inputsize, maxbatch, m);
    }
};

RangeCompFacade::RangeCompFacade(const std::vector<ComplexF32>& chirp, int inputsize, int maxbatch, int mode)
: _impl(std::make_unique<Impl>(chirp, inputsize, maxbatch, mode)) {}

RangeCompFacade::~RangeCompFacade() = default;

int RangeCompFacade::output_size() const {
    return _impl->rc->outputSize();
}

int RangeCompFacade::first_valid_sample() const {
    return _impl->rc->firstValidSample();
}

void RangeCompFacade::rangecompress(ComplexF32 outbuf, const ComplexF32 inbuf, int batch) {
    try {
        // convert inbuf to std::complex<float> on-the-fly into a temporary vector to match RangeComp's API
        int insz = _impl->inputsize;
        std::vector<std::complex<float>> invec(size_t(batch) * size_t(insz));
        for (size_t i = 0; i < invec.size(); ++i) invec[i] = to_cpx(inbuf[i]);
        std::vector<std::complex<float>> outvec(size_t(batch) * size_t(_impl->rc->outputSize()));
        _impl->rc->rangecompress(outvec.data(), invec.data(), batch);
        // convert back
        size_t outcnt = outvec.size();
        for (size_t i = 0; i < outcnt; ++i) {
            outbuf[i] = from_cpx(outvec[i]);
        }
    } catch (const std::exception &e) {
        tls_last_error = e.what();
        throw;
    }
}

void RangeCompFacade::apply_notch(double freq, double bandwidth) {
    try {
        _impl->rc->applyNotch(freq, bandwidth);
    } catch (const std::exception &e) {
        tls_last_error = e.what();
        throw;
    }
}
```

Notes:
• The above is a skeleton. You must adapt HDF5 dataset path & type logic to the exact NISAR L0B dataset layout (IQ storage format). Some datasets may be complex64 native; adjust read code accordingly.
• The conversion vectors inside rangecompress currently copy from ComplexF32 into std::complex vectors because ISCE3 RangeComp accepts std::complex<float>. To avoid the temporary, you could reinterpret_cast if layouts match, but safe copy is recommended initially.

4) cxx bridge (Rust) — src/bridge.rs or inline in Rust crate
• save as src/main.rs (bridge module plus usage)

```rust
// Cargo.toml will include cxx = "1.0"
#[cxx::bridge]
mod ffi {
    extern "C++" {
        include!("RangeCompFacade.h");
        type RawReader;
        type RangeCompFacade;
        // Shared POD types
        struct ComplexF32 {
            re: f32,
            im: f32,
        }
        struct RawMetadata {
            sensing_start: f64,
            sample_rate: f64,
            prf: f64,
            n_lines: i32,
            n_samples: i32,
            center_freq: f64,
        }

        // RawReader
        fn new_rawreader(path: &CxxString, dataset_path: &CxxString) -> UniquePtr<RawReader>;
        fn metadata(self: &RawReader) -> RawMetadata;
        fn read_block(self: &RawReader, line_start: i32, n_lines: i32, buffer: *mut ComplexF32) -> i32;
        fn close(self: &mut RawReader);

        // RangeCompFacade
        fn new_rangecomp(chirp: &CxxVector<ComplexF32>, inputsize: i32, maxbatch: i32, mode: i32) -> UniquePtr<RangeCompFacade>;
        fn output_size(self: &RangeCompFacade) -> i32;
        fn first_valid_sample(self: &RangeCompFacade) -> i32;
        fn rangecompress(self: &RangeCompFacade, outbuf: mut ComplexF32, inbuf: const ComplexF32, batch: i32);
        fn apply_notch(self: &RangeCompFacade, freq: f64, bandwidth: f64);

        // global helper
        fn get_last_error() -> String;
    }
}

use cxx::UniquePtr;
use std::slice;

fn main() {
    // Example synthetic usage
    let chirp = {
        let mut v = ffi::CxxVector::<ffi::ComplexF32>::new();
        // fill chirp samples: tiny example
        for i in 0..1024 {
            v.push_back(ffi::ComplexF32 { re: (i as f32) * 0.001, im: 0.0 });
        }
        v
    };

    let input_size = 2048;
    let maxbatch = 4;
    let mode = 0; // Full

    let rc = ffi::new_rangecomp(&chirp, input_size, maxbatch, mode);
    let out_size = rc.output_size() as usize;
    println!("RangeComp output size = {}", out_size);

    // prepare input buffer with batch = 1
    let batch = 1;
    let mut inbuf = vec![ffi::ComplexF32 { re: 0.0, im: 0.0 }; input_size * batch as usize];
    // fill synthetic pulse into inbuf[0..chirp.len()]
    for i in 0..(chirp.len()) {
        inbuf[i].re = chirp.get(i).unwrap().re;
    }
    let mut outbuf = vec![ffi::ComplexF32 { re: 0.0, im: 0.0 }; out_size * batch];

    // call rangecompress
    unsafe {
        rc.rangecompress(outbuf.as_mut_ptr(), inbuf.as_ptr(), batch);
    }

    // Print first few magnitudes
    for i in 0..10 {
        let c = outbuf[i];
        let mag = (c.re  c.re + c.im  c.im).sqrt();
        println!("out[{}] mag = {}", i, mag);
    }
}
```

Notes on cxx glue functions (new_* helpers): cxx cannot directly call C++ constructors with complex signatures unless declared in the bridge. For convenience you will implement thin factory wrapper functions in C++ with C++ linkage, e.g.:

In RangeCompFacade.h add declarations:

```c++
std::unique_ptr<RawReader> new_rawreader(const std::string &path, const std::string &dataset_path);
std::unique_ptr<RangeCompFacade> new_rangecomp(const std::vector<ComplexF32>& chirp, int inputsize, int maxbatch, int mode);
```

and define them in RangeCompFacade.cpp to simply create UniquePtr. cxx::bridge uses include path to that header.

5) CMake and build notes
• Add a CMake target to build the façade as shared library and link against isce3 and HDF5/FFTW:

CMakeLists.txt snippet to add to ISCE3-top-level or your own project:

```cmake
add_library(isce3proc SHARED
    cxx_iface/RangeCompFacade.cpp
)

target_include_directories(isce3proc PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/cxx_iface)
target_link_libraries(isce3proc PUBLIC isce3::isce3 HDF5::HDF5 fftw3)

install header for cxx include
install(FILES cxx_iface/RangeCompFacade.h DESTINATION include)
```

• Ensure you build ISCE3 first (develop branch) and have it installed or reachable (CMake find_package/isce3 config). Link against the isce3 target or libs.

6) Rust build.rs and Cargo.toml
• Cargo.toml (essential parts)

```toml
[package]
name = "nisar_rust_client"
version = "0.1.0"
edition = "2021"

[dependencies]
cxx = "1.0"

[build-dependencies]
cxx-build = "1.0"
```

• build.rs (to compile bridge and link shared lib)

```rust
fn main() {
    // Compile cxx bridge
    cxx_build::bridge("src/main.rs") // or separate mod file with #[cxx::bridge]
        .file("cxx_iface/RangeCompFacade.cpp")
        .flag_if_supported("-std=c++17")
        .compile("nisar_cxxbridge");

    println!("cargo:rustc-link-lib=dylib=isce3proc"); // the shared lib you built with CMake
    println!("cargo:rustc-link-search=native=/path/to/your/cmake/build/lib");
    // Also link any required system libs
    println!("cargo:rustc-link-lib=dylib=fftw3");
    println!("cargo:rustc-link-lib=dylib=hdf5");
}
```

Notes:
• You must set the correct include paths for ISCE3 headers in cxx_build flags or use a separate build step (CMake) to install the façade header to a known include dir.
• The cxx_build step above can be optional since the façade .cpp will already be compiled via CMake into libisce3proc; you can remove .file if you prefer only linking shared lib.

7 call into the same RangeCompFacade object unless you ensure thread-safety.
• FFTW: ensure you link FFTW and install its development libs on the edge server; FFTW planners may be expensive — RangeComp constructs plans at creation time and reuses them.
• Testing:
  - Start with small synthetic data (chirp + replicate) and compare C++ RangeComp output to ISCE3 unit test references.
  - Then test with a tiny subset of real L0B (a few azimuth lines).
• Error handling:
  - get_last_error() returns last thrown message. cxx will translate std::string to Rust String.
  - Consider wrapping methods to return bool + error string instead of letting exceptions propagate.

8) Quick checklist for you to provide / confirm so I can produce ready-to-drop files:
• Do you want me to:
  A) generate full ready-to-drop C++ files (header + cpp), and a Rust crate skeleton with cxx bridge and build.rs (I will adapt HDF5 read to a likely NISAR dataset path but you must test)?
  B) or generate the minimal façade but leave HDF5 read location as placeholders you’ll fill in?

If A: provide one example / sample L0B HDF5 file path or tell me the dataset path inside the HDF5 for raw echoes (e.g., "/science/echo_data/chan_1/complex_data" or show a sample h5utils usage) so I can tailor RawReader::Impl reading code correctly. If you don’t have it, I’ll use a common interleaved-IQ layout and mark where to adapt.

Which do you want next?