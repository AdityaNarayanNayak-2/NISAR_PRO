//! SAR Processor Library
//!
//! Core SAR processing algorithms including:
//! - Range-Doppler Algorithm (RDA)
//! - ISCE3 integration (optional)
//! - Anomaly detection (AMTAD)

pub mod algorithm;
pub mod errors;
pub mod io;
pub mod isce3_ffi;
pub mod radar_utils;
pub mod rda;
pub mod smart_downloader;
