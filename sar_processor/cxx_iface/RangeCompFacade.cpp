// ============================================================================
// SAR Processor ISCE3 Facade Implementation
// Wraps ISCE3 C++ classes for Rust FFI
// ============================================================================

#include "RangeCompFacade.h"

// ISCE3 headers (when ISCE3 is installed)
#ifdef HAVE_ISCE3
#include <isce3/focus/RangeComp.h>
#include <isce3/focus/Chirp.h>
#endif

// HDF5 C++ API
#ifdef HAVE_HDF5
#include <H5Cpp.h>
#endif

#include <stdexcept>
#include <cstring>
#include <mutex>

// Thread-local error storage
static thread_local std::string tls_last_error;

std::string get_last_error() {
    return tls_last_error;
}

// Helper conversions
static inline std::complex<float> to_cpx(const ComplexF32& c) { 
    return {c.re, c.im}; 
}

static inline ComplexF32 from_cpx(const std::complex<float>& c) { 
    return {c.real(), c.imag()}; 
}

// ============================================================================
// RawReader Implementation
// ============================================================================

struct RawReader::Impl {
    RawMetadata meta;
    int n_lines;
    int n_samples;
    bool is_open;

#ifdef HAVE_HDF5
    H5::H5File file;
    H5::DataSet ds;

    Impl(const std::string& h5path, const std::string& dataset_path) : is_open(false) {
        try {
            file = H5::H5File(h5path, H5F_ACC_RDONLY);
            ds = file.openDataSet(dataset_path);

            // Get dimensions
            H5::DataSpace space = ds.getSpace();
            hsize_t dims[2];
            space.getSimpleExtentDims(dims);
            n_lines = static_cast<int>(dims[0]);
            n_samples = static_cast<int>(dims[1]);

            // Fill metadata (read actual attributes in production)
            meta.n_lines = n_lines;
            meta.n_samples = n_samples;
            meta.sample_rate = 1.0;  // TODO: Read from attributes
            meta.sensing_start = 0.0;
            meta.prf = 0.0;
            meta.center_freq = 0.0;

            is_open = true;
        } catch (const H5::Exception& e) {
            throw std::runtime_error(std::string("HDF5 error: ") + e.getCDetailMsg());
        }
    }

    int read_block(int line_start, int nread, ComplexF32* buffer) {
        if (!is_open) throw std::runtime_error("File not open");

        H5::DataSpace filespace = ds.getSpace();
        hsize_t offset[2] = { static_cast<hsize_t>(line_start), 0 };
        hsize_t count[2] = { static_cast<hsize_t>(nread), static_cast<hsize_t>(n_samples) };
        filespace.selectHyperslab(H5S_SELECT_SET, count, offset);

        hsize_t mdims[2] = { static_cast<hsize_t>(nread), static_cast<hsize_t>(n_samples) };
        H5::DataSpace memspace(2, mdims);

        // Read as interleaved float pairs
        std::vector<float> tmp(nread * n_samples * 2);

        H5::CompType float2_type(sizeof(float) * 2);
        float2_type.insertMember("r", 0, H5::PredType::NATIVE_FLOAT);
        float2_type.insertMember("i", sizeof(float), H5::PredType::NATIVE_FLOAT);

        ds.read(tmp.data(), float2_type, memspace, filespace);

        // Convert to ComplexF32
        size_t cnt = static_cast<size_t>(nread) * static_cast<size_t>(n_samples);
        for (size_t i = 0; i < cnt; ++i) {
            buffer[i].re = tmp[2 * i];
            buffer[i].im = tmp[2 * i + 1];
        }

        return nread;
    }
#else
    // Stub implementation without HDF5
    Impl(const std::string& h5path, const std::string& dataset_path) : is_open(false) {
        (void)h5path;
        (void)dataset_path;
        // For testing without HDF5, create synthetic data
        n_lines = 1024;
        n_samples = 2048;
        meta.n_lines = n_lines;
        meta.n_samples = n_samples;
        meta.sample_rate = 25.0e6;
        meta.sensing_start = 0.0;
        meta.prf = 1600.0;
        meta.center_freq = 5.4e9;
        is_open = true;
    }

    int read_block(int line_start, int nread, ComplexF32* buffer) {
        (void)line_start;
        // Fill with zeros for stub
        size_t cnt = static_cast<size_t>(nread) * static_cast<size_t>(n_samples);
        std::memset(buffer, 0, cnt * sizeof(ComplexF32));
        return nread;
    }
#endif
};

RawReader::RawReader(const std::string& h5path, const std::string& dataset_path) {
    try {
        _impl = std::make_unique<Impl>(h5path, dataset_path);
    } catch (const std::exception& e) {
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
    } catch (const std::exception& e) {
        tls_last_error = e.what();
        throw;
    }
}

void RawReader::close() {
    _impl.reset();
}

// ============================================================================
// RangeCompFacade Implementation
// ============================================================================

struct RangeCompFacade::Impl {
    int inputsize;
    int outsize;
    int first_valid;

#ifdef HAVE_ISCE3
    std::unique_ptr<isce3::focus::RangeComp> rc;

    Impl(const std::vector<ComplexF32>& chirp, int inputsize, int maxbatch, int mode)
        : inputsize(inputsize) {
        // Convert chirp to std::complex
        std::vector<std::complex<float>> chirp_c(chirp.size());
        for (size_t i = 0; i < chirp.size(); ++i) {
            chirp_c[i] = to_cpx(chirp[i]);
        }

        // Map mode
        isce3::focus::RangeComp::Mode m = isce3::focus::RangeComp::Mode::Full;
        if (mode == 1) m = isce3::focus::RangeComp::Mode::Valid;
        else if (mode == 2) m = isce3::focus::RangeComp::Mode::Same;

        rc = std::make_unique<isce3::focus::RangeComp>(chirp_c, inputsize, maxbatch, m);
        outsize = rc->outputSize();
        first_valid = rc->firstValidSample();
    }

    void rangecompress(ComplexF32* outbuf, const ComplexF32* inbuf, int batch) {
        // Convert input
        std::vector<std::complex<float>> invec(static_cast<size_t>(batch) * static_cast<size_t>(inputsize));
        for (size_t i = 0; i < invec.size(); ++i) {
            invec[i] = to_cpx(inbuf[i]);
        }

        // Process
        std::vector<std::complex<float>> outvec(static_cast<size_t>(batch) * static_cast<size_t>(outsize));
        rc->rangecompress(outvec.data(), invec.data(), batch);

        // Convert output
        for (size_t i = 0; i < outvec.size(); ++i) {
            outbuf[i] = from_cpx(outvec[i]);
        }
    }

    void apply_notch(double freq, double bandwidth) {
        rc->applyNotch(freq, bandwidth);
    }
#else
    // Stub implementation without ISCE3 - uses simple matched filter
    std::vector<std::complex<float>> chirp_spectrum;

    Impl(const std::vector<ComplexF32>& chirp, int inputsize, int maxbatch, int mode)
        : inputsize(inputsize) {
        (void)maxbatch;
        (void)mode;

        // For stub: output size = input size (Full mode approximation)
        outsize = inputsize + static_cast<int>(chirp.size()) - 1;
        first_valid = 0;

        // Store chirp for simple processing
        chirp_spectrum.resize(chirp.size());
        for (size_t i = 0; i < chirp.size(); ++i) {
            chirp_spectrum[i] = to_cpx(chirp[i]);
        }
    }

    void rangecompress(ComplexF32* outbuf, const ComplexF32* inbuf, int batch) {
        // Stub: just copy input to output (placeholder)
        // Real ISCE3 would do FFT-based matched filtering
        int copy_size = std::min(inputsize, outsize);
        for (int b = 0; b < batch; ++b) {
            for (int i = 0; i < copy_size; ++i) {
                outbuf[b * outsize + i] = inbuf[b * inputsize + i];
            }
            // Zero pad the rest
            for (int i = copy_size; i < outsize; ++i) {
                outbuf[b * outsize + i] = {0.0f, 0.0f};
            }
        }
    }

    void apply_notch(double freq, double bandwidth) {
        (void)freq;
        (void)bandwidth;
        // Stub: no-op
    }
#endif
};

RangeCompFacade::RangeCompFacade(const std::vector<ComplexF32>& chirp, int inputsize, int maxbatch, int mode)
    : _impl(std::make_unique<Impl>(chirp, inputsize, maxbatch, mode)) {}

RangeCompFacade::~RangeCompFacade() = default;

int RangeCompFacade::output_size() const {
    return _impl->outsize;
}

int RangeCompFacade::first_valid_sample() const {
    return _impl->first_valid;
}

void RangeCompFacade::rangecompress(ComplexF32* outbuf, const ComplexF32* inbuf, int batch) {
    try {
        _impl->rangecompress(outbuf, inbuf, batch);
    } catch (const std::exception& e) {
        tls_last_error = e.what();
        throw;
    }
}

void RangeCompFacade::apply_notch(double freq, double bandwidth) {
    try {
        _impl->apply_notch(freq, bandwidth);
    } catch (const std::exception& e) {
        tls_last_error = e.what();
        throw;
    }
}

// ============================================================================
// Factory Functions
// ============================================================================

std::unique_ptr<RawReader> new_rawreader(const std::string& path, const std::string& dataset_path) {
    return std::make_unique<RawReader>(path, dataset_path);
}

std::unique_ptr<RangeCompFacade> new_rangecomp(const std::vector<ComplexF32>& chirp, int inputsize, int maxbatch, int mode) {
    return std::make_unique<RangeCompFacade>(chirp, inputsize, maxbatch, mode);
}
