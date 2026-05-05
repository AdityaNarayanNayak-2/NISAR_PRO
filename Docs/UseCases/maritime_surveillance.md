# Maritime Surveillance & Dark Vessel Detection

This document details the Maritime Surveillance capabilities of the NISARPro platform, specifically focusing on dark vessel detection using the CA-CFAR algorithm.

## The Challenge
Illegal, Unreported, and Unregulated (IUU) fishing, as well as smuggling operations, rely on disabling their Automatic Identification System (AIS) transponders to "go dark." Because the ocean is vast, optical satellites are practically useless—they cannot see through clouds and are blind at night.

Synthetic Aperture Radar (SAR) provides day-and-night, all-weather imaging capabilities, making it the primary technology for global maritime domain awareness.

## Detection Pipeline
The NISARPro platform automates the detection of these vessels using the following pipeline:

1.  **Scene Ingestion & Formatting:** A NISAR or Sentinel-1 scene is loaded. For maritime detection, dual-pol or single-pol data (e.g., HH or VV) is sufficient.
2.  **Land Masking (Pre-processing):** Coastal regions and islands are mathematically masked out using a high-resolution shoreline vector database. This is critical because buildings and rocky cliffs are bright radar reflectors that would trigger thousands of false positive "ships" if passed into the detection algorithm.
3.  **Adaptive Thresholding (CA-CFAR):** The image is passed through the Cell-Averaging Constant False Alarm Rate algorithm. Because the sea state changes (e.g., rough waves in a storm reflect more radar energy than a calm sea), a static brightness threshold will fail. CA-CFAR sweeps a sliding window across the ocean, dynamically calculating the local wave clutter and flagging pixels that are statistically anomalous.
4.  **Spatial Clustering:** Ships are composed of multiple bright pixels. A Density-Based Spatial Clustering of Applications with Noise (DBSCAN) algorithm groups adjacent flagged pixels into single unified objects.
5.  **Feature Extraction:** For each grouped object, the system estimates:
    *   Length (based on pixel count and ground sample distance).
    *   Heading (based on the major axis of the pixel cluster).
    *   Center Lat/Lon coordinate.
6.  **GeoJSON Export:** The extracted ship data is exported as a standard GeoJSON FeatureCollection.

## Integration & Visualization
In the NISARPro dashboard, the generated GeoJSON is overlaid on the Leaflet map as tactical markers. If integrated with an external AIS database, the system can automatically cross-reference the detected SAR ships with known AIS broadcasts. Any SAR ship without a corresponding AIS broadcast is flagged as a "Dark Vessel."
