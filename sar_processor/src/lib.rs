//! SAR Processor Library
//!
//! Core SAR processing algorithms for NISAR Level-1+ products:
//! - NISAR HDF5 format parsing (RSLC/GSLC/GCOV/GUNW)
//! - Sentinel-1 SAFE format parsing
//! - InSAR: coregistration, coherence, phase unwrapping, deramping
//! - Infrastructure health / PS-InSAR analysis
//! - Ship detection (CA-CFAR)
//! - Polarimetric SAR decomposition (PolSAR)

pub mod algorithm;
pub mod errors;
pub mod io;
pub mod nisar_parser;
pub mod gunw_parser;
pub mod polsar;
pub mod radar_utils;
pub mod safe_parser;
pub mod smart_downloader;
pub mod insar;
pub mod infra_health;
pub mod ship_detection;
pub mod multilook;
pub mod coregister;
pub mod phase_filter;
pub mod unwrap;
pub mod topo_phase;
pub mod deramp;
pub mod water_mask;
