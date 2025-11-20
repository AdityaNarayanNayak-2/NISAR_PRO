# SAR Earth Imaging Dashboard

This dashboard provides a next-generation, highly animated, and aesthetic interface for non-technical remote sensing operators to visualize Earth imagery processed by the SAR (Synthetic Aperture Radar) system.

## Data Consumption (Conceptual)

In a fully functional end-to-end system, the frontend dashboard would consume processed SAR imagery data from a cloud storage solution (e.g., Azure Blob Storage, AWS S3, Google Cloud Storage). The workflow would typically be as follows:

1.  **SAR Job Submission**: A user (or an automated system) submits a `SarJob` custom resource to the Kubernetes cluster.
2.  **Operator Action**: The Kubernetes operator detects the new `SarJob`, orchestrates the `sar_decoder` (or a similar SAR processing application) to process raw SAR data.
3.  **Data Storage**: The `sar_decoder` processes the raw SAR signal and stores the resulting image (e.g., a GeoTIFF file) in the configured cloud storage bucket.
4.  **Metadata Update**: The Kubernetes operator updates the `SarJob` status with the URL of the processed image in cloud storage.
5.  **Frontend Fetch**: The frontend dashboard periodically queries the Kubernetes API (or a dedicated API gateway) for the status of `SarJob`s. Once a job is `Completed` and an `output_storage_path` (URL to the processed image) is available, the dashboard fetches this URL.
6.  **Visualization**: The dashboard uses a mapping library (e.g., Leaflet, Mapbox GL JS) and image processing libraries (e.g., `ol-mapbox-style`, `georaster-layer-for-leaflet`) to load and display the processed SAR image data, potentially overlaying it on a geographical map.

For this demonstration, a `simulated_sar_image.txt` file has been created, representing the output of the SAR decoder. In a real application, the dashboard would fetch a similar file (e.g., a GeoTIFF) from cloud storage and render it visually.

## Local Development

To run the dashboard locally:

```bash
cd /home/ubuntu/sar-dashboard
pnpm install
pnpm run dev
```

Then, open your browser to `http://localhost:5173`.

