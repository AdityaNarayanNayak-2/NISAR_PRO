//! ISCE3 FFI Bridge
//!
//! This module provides Rust bindings to the ISCE3 C++ facade
//! for production-quality SAR processing.

// Note: The cxx bridge is conditionally compiled.
// When the C++ facade is not built, we provide stub implementations.

#[cfg(feature = "isce3")]
#[cxx::bridge]
mod ffi {
    // Shared types between Rust and C++
    #[derive(Debug, Clone, Copy)]
    struct ComplexF32 {
        re: f32,
        im: f32,
    }

    #[derive(Debug, Clone)]
    struct RawMetadata {
        sensing_start: f64,
        sample_rate: f64,
        prf: f64,
        n_lines: i32,
        n_samples: i32,
        center_freq: f64,
    }

    unsafe extern "C++" {
        include!("RangeCompFacade.h");

        // Types
        type RawReader;
        type RangeCompFacade;

        // RawReader methods
        fn new_rawreader(path: &CxxString, dataset_path: &CxxString) -> UniquePtr<RawReader>;
        fn metadata(self: &RawReader) -> RawMetadata;
        unsafe fn read_block(
            self: &RawReader,
            line_start: i32,
            n_lines: i32,
            buffer: *mut ComplexF32,
        ) -> i32;
        fn close(self: Pin<&mut RawReader>);

        // RangeCompFacade methods
        fn new_rangecomp(
            chirp: &CxxVector<ComplexF32>,
            inputsize: i32,
            maxbatch: i32,
            mode: i32,
        ) -> UniquePtr<RangeCompFacade>;
        fn output_size(self: &RangeCompFacade) -> i32;
        fn first_valid_sample(self: &RangeCompFacade) -> i32;
        unsafe fn rangecompress(
            self: &RangeCompFacade,
            outbuf: *mut ComplexF32,
            inbuf: *const ComplexF32,
            batch: i32,
        );
        fn apply_notch(self: Pin<&mut RangeCompFacade>, freq: f64, bandwidth: f64);

        // Error handling
        fn get_last_error() -> String;
    }
}

// ============================================================================
// Rust-native wrapper (used when ISCE3 is not available)
// ============================================================================

use log::info;
use ndarray::Array2;
use num_complex::Complex32;

/// Complex number type compatible with C++ facade
#[repr(C)]
#[derive(Debug, Clone, Copy, Default)]
pub struct ComplexF32 {
    pub re: f32,
    pub im: f32,
}

impl From<Complex32> for ComplexF32 {
    fn from(c: Complex32) -> Self {
        Self { re: c.re, im: c.im }
    }
}

impl From<ComplexF32> for Complex32 {
    fn from(c: ComplexF32) -> Self {
        Complex32::new(c.re, c.im)
    }
}

/// Metadata from raw SAR product
#[derive(Debug, Clone)]
pub struct RawMetadata {
    pub sensing_start: f64,
    pub sample_rate: f64,
    pub prf: f64,
    pub n_lines: i32,
    pub n_samples: i32,
    pub center_freq: f64,
}

/// ISCE3 Range Compression Processor (Rust wrapper)
///
/// This provides a unified interface that can use either:
/// - The actual ISCE3 C++ library (when feature "isce3" is enabled)
/// - A pure Rust fallback implementation
pub struct Isce3RangeComp {
    chirp: Vec<ComplexF32>,
    input_size: usize,
    output_size: usize,
}

impl Isce3RangeComp {
    /// Create a new range compressor
    ///
    /// * `chirp` - Reference chirp waveform (time domain samples)
    /// * `input_size` - Number of samples per range line
    pub fn new(chirp: Vec<ComplexF32>, input_size: usize) -> Self {
        let output_size = input_size + chirp.len() - 1;
        info!(
            "ISCE3 Bridge: Initialized RangeComp with {} samples -> {} output",
            input_size, output_size
        );
        Self {
            chirp,
            input_size,
            output_size,
        }
    }

    /// Get the expected output size after compression
    pub fn output_size(&self) -> usize {
        self.output_size
    }

    /// Perform range compression on a batch of lines
    ///
    /// This is a placeholder implementation. The real ISCE3 version
    /// would use FFT-based matched filtering.
    pub fn rangecompress(&self, input: &Array2<Complex32>) -> Array2<Complex32> {
        let (rows, cols) = input.dim();
        info!(
            "ISCE3 Bridge: Range compressing {} lines x {} samples",
            rows, cols
        );

        // For now, return identity (placeholder)
        // Real implementation would call into C++ via ffi::rangecompress
        let mut output = Array2::<Complex32>::zeros((rows, self.output_size));

        for i in 0..rows {
            for j in 0..cols.min(self.output_size) {
                output[[i, j]] = input[[i, j]];
            }
        }

        output
    }
}

/// Check if ISCE3 C++ library is available
pub fn is_isce3_available() -> bool {
    #[cfg(feature = "isce3")]
    {
        true
    }
    #[cfg(not(feature = "isce3"))]
    {
        false
    }
}

/// Get ISCE3 version string (if available)
pub fn isce3_version() -> String {
    if is_isce3_available() {
        "ISCE3 (C++ backend)".to_string()
    } else {
        "Rust fallback (ISCE3 not linked)".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use num_complex::Complex32;

    #[test]
    fn test_complex_conversion() {
        let c = Complex32::new(1.0, 2.0);
        let cf: ComplexF32 = c.into();
        assert_eq!(cf.re, 1.0);
        assert_eq!(cf.im, 2.0);

        let c2: Complex32 = cf.into();
        assert_eq!(c2.re, 1.0);
        assert_eq!(c2.im, 2.0);
    }

    #[test]
    fn test_rangecomp_stub() {
        let chirp = vec![ComplexF32 { re: 1.0, im: 0.0 }; 128];
        let rc = Isce3RangeComp::new(chirp, 1024);
        assert_eq!(rc.output_size(), 1024 + 128 - 1);
    }
}
