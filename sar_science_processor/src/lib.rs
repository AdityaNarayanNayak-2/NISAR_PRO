//! SAR Science Processor Library
//!
//! Memory-efficient InSAR & GCOV processing engine for NISAR L-band products.
//! Designed for crop-before-load execution with aggressive memory management.
//!
//! Pipeline modes:
//! - InSAR: Master+Slave SLC → Interferogram → Coherence → Unwrap → Displacement
//! - GCOV: Geocoded Covariance → Speckle Filter → Colormapped PNG

pub mod crash_journal;
pub mod errors;
pub mod io;
pub mod nisar_parser;
pub mod insar;
pub mod infra_health;
pub mod multilook;
pub mod coregister;
pub mod phase_filter;
pub mod unwrap;
pub mod topo_phase;
pub mod deramp;
pub mod water_mask;
pub mod flood_detect;

