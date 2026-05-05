# Dam & Infrastructure Monitoring

This document details how the NISARPro platform utilizes the InSAR processing pipeline to monitor the structural health of critical infrastructure.

## The Challenge
Large infrastructure projects like hydroelectric dams, suspension bridges, and cooling towers undergo continuous micro-movements. These movements are caused by:
-   Hydrostatic pressure changes (water levels rising/falling).
-   Thermal expansion (seasonal temperature swings).
-   Geological shifts and soil subsidence.

Traditional monitoring relies on physical ground sensors (GPS receivers, total stations, strain gauges). These are expensive to install, require manual maintenance, and only provide data for the exact point where they are attached.

## The NISARPro Solution: Virtual Sensors
Using **Persistent Scatterer Interferometry (PS-InSAR)**, NISARPro turns the entire surface of the dam into thousands of virtual sensors without deploying a single piece of hardware on the ground.

Because concrete and steel are excellent radar reflectors, they exhibit extremely high **coherence** over time. By calculating the phase difference between SAR acquisitions, we can measure millimeter-level surface displacement.

## Processing Workflow
1.  **Scene Selection:** The user selects a time-series of NISAR or Sentinel-1 SLC (Single Look Complex) images over the dam via the Dashboard.
2.  **Coregistration & Interferometry:** The `sar_processor` precisely aligns the images and generates the interferograms.
3.  **Topographic Phase Removal:** A high-resolution Digital Elevation Model (DEM) is used to mathematically subtract the phase caused by the static shape of the earth and the structure itself.
4.  **Persistent Scatterer Selection:** The system isolates pixels with a coherence index $> 0.85$ (the concrete structure).
5.  **Phase Unwrapping & Displacement Calculation:** The cyclical phase shifts ($-\pi$ to $\pi$) are unwrapped into an absolute Line-of-Sight (LOS) measurement, converting radians into millimeters of physical movement.

## Visualization
The resulting data is passed back to the `sar-dashboard-v3` as a GeoJSON feature layer or a classified PNG.
-   🔴 **Red Pixels:** Indicate subsidence or deflection (the structure is moving *away* from the satellite).
-   🔵 **Blue Pixels:** Indicate uplift or rebound (the structure is moving *towards* the satellite).
-   🟢 **Green Pixels:** Indicate absolute stability.
