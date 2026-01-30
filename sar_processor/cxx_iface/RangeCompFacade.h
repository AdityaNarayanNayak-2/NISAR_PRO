#pragma once
#include <string>
#include <vector>
#include <memory>
#include <complex>

// ============================================================================
// SAR Processor ISCE3 Facade
// Thin C++ wrapper around ISCE3 for Rust FFI via cxx
// ============================================================================

// Simple complex type for C interop (matches Rust repr(C))
struct ComplexF32 {
    float re;
    float im;
};

// Metadata from L0B raw product
struct RawMetadata {
    double sensing_start;
    double sample_rate;
    double prf;
    int n_lines;
    int n_samples;
    double center_freq;
};

// ============================================================================
// RawReader - HDF5 L0B file reader
// ============================================================================
class RawReader {
public:
    // Opens HDF5 file and dataset
    // h5path: path to L0B HDF5 file
    // dataset_path: internal HDF5 dataset path (e.g., "/science/LSAR/SLC/swaths/frequencyA/HH")
    RawReader(const std::string& h5path, const std::string& dataset_path);
    ~RawReader();

    // Get metadata extracted from file attributes
    RawMetadata metadata() const;

    // Read block of raw data
    // line_start: first azimuth line to read
    // n_lines: number of lines to read
    // buffer: pre-allocated output buffer (must hold n_lines * n_samples ComplexF32)
    // Returns: number of lines actually read
    int read_block(int line_start, int n_lines, ComplexF32* buffer);

    void close();

private:
    struct Impl;
    std::unique_ptr<Impl> _impl;
};

// ============================================================================
// RangeCompFacade - Range compression using ISCE3
// ============================================================================
class RangeCompFacade {
public:
    // mode: 0=Full, 1=Valid, 2=Same (output size modes)
    RangeCompFacade(const std::vector<ComplexF32>& chirp, int inputsize, int maxbatch = 1, int mode = 0);
    ~RangeCompFacade();

    // Get output size after compression
    int output_size() const;

    // Get first valid sample index
    int first_valid_sample() const;

    // Perform range compression
    // outbuf: pre-allocated output (batch * output_size elements)
    // inbuf: input data (batch * inputsize elements)
    // batch: number of range lines to process
    void rangecompress(ComplexF32* outbuf, const ComplexF32* inbuf, int batch);

    // Apply notch filter to remove interference
    void apply_notch(double freq, double bandwidth);

private:
    struct Impl;
    std::unique_ptr<Impl> _impl;
};

// ============================================================================
// Factory functions for cxx bridge compatibility
// ============================================================================
std::unique_ptr<RawReader> new_rawreader(const std::string& path, const std::string& dataset_path);
std::unique_ptr<RangeCompFacade> new_rangecomp(const std::vector<ComplexF32>& chirp, int inputsize, int maxbatch, int mode);

// Thread-local error message from last exception
std::string get_last_error();
