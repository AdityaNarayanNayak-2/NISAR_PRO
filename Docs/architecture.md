# System Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                            │
└─────────────────────────────┬───────────────────────────────────┘
                              │ HTTP :8080
┌─────────────────────────────▼───────────────────────────────────┐
│                    Kubernetes Cluster                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  sar-dashboard (Nginx + React)                          │    │
│  │  - Serves static frontend                               │    │
│  │  - Proxies /api/* to Gateway                            │    │
│  └─────────────────────────┬───────────────────────────────┘    │
│                            │ /api/*                              │
│  ┌─────────────────────────▼───────────────────────────────┐    │
│  │  sar-gateway (Rust + Axum)                              │    │
│  │  - OAuth2 authentication with ESA                       │    │
│  │  - Unified API for multiple data sources                │    │
│  └─────────────────────────┬───────────────────────────────┘    │
│                            │                                     │
│  ┌─────────────────────────▼───────────────────────────────┐    │
│  │  sar-operator (Kubernetes Operator)                     │    │
│  │  - Watches SARJob CRDs                                  │    │
│  │  - Spawns sar-processor pods                            │    │
│  └─────────────────────────┬───────────────────────────────┘    │
│                            │                                     │
│  ┌─────────────────────────▼───────────────────────────────┐    │
│  │  sar-processor (Job Pod)                                │    │
│  │  - Downloads SAR data (HTTP Range)                      │    │
│  │  - Processes GeoTIFF/HDF5                               │    │
│  │  - Outputs analysis results                             │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                    External APIs                                 │
│  - ESA Copernicus (Sentinel-1)                                  │
│  - ISRO Bhoonidhi (RISAT)                                       │
│  - NASA Earthdata (NISAR)                                       │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. sar-dashboard-v3
- **Tech**: React + Vite + Spline 3D
- **Purpose**: User interface for searching and viewing SAR data
- **Key Files**:
  - `src/components/Hero.jsx` - Search UI with 3D background
  - `src/components/LiveFeed.jsx` - Job status cards
  - `nginx.conf` - Reverse proxy config

### 2. sar-gateway
- **Tech**: Rust + Axum + Tokio
- **Purpose**: Secure API gateway with OAuth2
- **Key Files**:
  - `src/main.rs` - Server setup
  - `src/handlers.rs` - API endpoints
  - `src/esa_client.rs` - ESA API integration

### 3. sar-operator
- **Tech**: Rust + kube-rs
- **Purpose**: Kubernetes operator for job management
- **CRD**: `SARJob` custom resource

### 4. sar-processor
- **Tech**: Rust + GDAL bindings
- **Purpose**: Actual SAR data processing
- **Features**:
  - Smart Downloader (HTTP Range requests)
  - GeoTIFF/HDF5 parsing
  - Ship detection, flood mapping

## Data Flow

1. User searches for location in Dashboard
2. Dashboard calls `/api/search?lat=X&lon=Y`
3. Nginx proxies to Gateway
4. Gateway authenticates with ESA OAuth2
5. Gateway queries Copernicus OData API
6. Results returned to Dashboard
7. User clicks "Process"
8. Gateway creates SARJob CR
9. Operator detects CR, spawns Processor
10. Processor downloads and analyzes data
