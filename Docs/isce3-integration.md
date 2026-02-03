# ISCE3 Integration Reference

This document captures the research and technical approach for integrating ISCE3 C++ processing capabilities via Rust FFI, based on conversations with GitHub Copilot.

## Overview

ISCE3 (InSAR Scientific Computing Environment 3) is NASA/JPL's production-grade SAR processing framework. It provides battle-tested implementations of:

- Range compression (FFT-based pulse compression)
- Azimuth focusing (time-domain backprojection)
- Geometry handling (orbit/attitude integration)
- Calibration and antenna corrections

## Integration Approach

See the detailed technical specifications in:
- `Research/chat1.md` - Component mapping and file-level implementation guide
- `Research/chat2.md` - C++ facade design, cxx bridge implementation, build system

## Key Components to Wrap

1. **RangeComp** (`cxx/isce3/focus/RangeComp.cpp`) - CPU range compression
2. **Backproject** (`cxx/isce3/focus/Backproject.cpp`) - CPU azimuth focusing  
3. **Geometry** - rdr2geo/geo2rdr transformations
4. **HDF5 Reader** - L0B product ingestion

## When to Use This

**Consider ISCE3 integration when:**
- Processing real NISAR L0B data (when available)
- Client requires NASA-grade processing quality
- Rust RDA quality plateaus despite improvements
- Need reference implementation for validation

**Avoid if:**
- Only processing Sentinel-1 (already provides L1 SLC)
- Container size is critical (<100MB requirement)
- Full sovereignty is required (no external dependencies)

## Build Complexity

**Dependencies Required:**
- ISCE3 library (~300MB)
- FFTW3
- HDF5 C/C++ library
- Eigen3
- C++17 compiler

**Estimated Container Size:**
- Base image: ~100MB
- ISCE3 + deps: ~500MB
- **Total: ~600MB** (vs ~50MB for pure Rust)

## Implementation Status

- [ ] Not started (reference only)
- Decision deferred pending Rust RDA validation results

## See Also

- [Strategic Roadmap](../roadmap_enterprise.md) - Path comparison and decision framework
- [Architecture](../Docs/architecture.md) - System design
