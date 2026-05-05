# Feasibility Analysis: Multi-Source SAR Platform

## The Vision
A unified platform that:
1.  Takes a Lat/Lon input.
2.  Queries multiple providers (ESA, Bhoonidhi, NASA) for the best resolution data.
3.  Downloads a small ROI (Region of Interest), e.g., 10km x 10km.
4.  Performs advanced analysis (ML, 3D, 20+ parameters).
5.  Visualizes the result.

## Feasibility Check (16GB RAM / 1TB Disk)

### 1. Multi-Source Data Aggregation (Feasible ✅)
-   **Strategy**: We don't download everything. We query **Metadata APIs** first.
-   **Implementation**: A new service (`sar-gateway`) that hits STAC (SpatioTemporal Asset Catalog) APIs. Most providers (NASA, ESA) support STAC. Bhoonidhi has its own API.
-   **Constraint Check**: Metadata is tiny (KB). No hardware issues.

### 2. "Best Resolution" Logic (Feasible ✅)
-   **Logic**: Compare `pixel_spacing` or `ground_sample_distance` from the metadata.
-   **Constraint Check**: Simple math. No hardware issues.

### 3. Downloading 10km ROI (Feasible ✅)
-   **Strategy**: This is the critical part. A full Sentinel-1 scene is ~4GB. A NISAR scene might be larger.
-   **Solution**: Use **Partial Reads** (HTTP Range Requests / VSICURL). We only download the bytes for the 10km chunk we need.
-   **Constraint Check**: A 10km x 10km S-Band image is roughly 100MB - 500MB. This fits easily in your 16GB RAM.

### 4. Advanced Analysis & ML (Feasible with Caveats ⚠️)
-   **Anomalies (Ships/Vehicles)**: ✅ Feasible. Our current Rust code is fast enough.
-   **Green Level (Biomass)**: ✅ Feasible. Simple math on Polarimetric bands (RVI - Radar Vegetation Index).
-   **Height/3D (InSAR)**: ⚠️ **Hard**. Requires *two* images from different times (Interferometry). Computationally heavy but possible in Rust.
-   **Object Detection (Houses/Vehicles)**: ⚠️ **Medium**. Requires a Deep Learning model (e.g., YOLO or UNet). Running inference on CPU is possible for small 10km chips, but slow.
-   **Constraint Check**: 16GB RAM is tight for training models, but fine for *running* pre-trained models on small chunks.

### 5. 3D Visualization (Feasible ✅)
-   **Strategy**: Generate a Height Map (DEM) and overlay the SAR image as a texture.
-   **Tech**: The React Dashboard can use `Three.js` or `CesiumJS` to render this in the browser.

## Proposed Roadmap (Small Steps)

### Phase 1: The Gateway (Next Step)
-   Create a new microservice `sar-gateway`.
-   Implement ESA/Copernicus API connection.
-   Goal: Input Lat/Lon -> Get list of available images.

### Phase 2: The Smart Downloader
-   Implement "Partial Download" logic in `sar_processor`.
-   Goal: Download only the 10km chunk, not the whole 4GB file.

### Phase 3: The Analyst
-   Upgrade `sar_processor` to handle real GeoTIFFs.
-   Implement basic parameters (Vegetation Index, Water Mask).

### Phase 4: The 3D View
-   Upgrade Dashboard to render 3D terrain.

## Recommendation
**Start with Phase 1.** Let's build the "Search Engine" that finds the data first. We can mock the actual download for now.
