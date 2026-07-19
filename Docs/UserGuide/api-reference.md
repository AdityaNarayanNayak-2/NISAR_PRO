# API Reference

This document describes the API endpoints provided by the `sar-gateway` microservice, enabling client applications to query catalogs, retrieve environmental context, manage SAR processing tasks, and stream execution logs.

## Base URL

| Environment | Endpoint |
| :--- | :--- |
| **Local Development** | `http://localhost:3000` |
| **Kubernetes (Internal)** | `http://sar-gateway-svc.nisarpro.svc.cluster.local` |
| **Production (Public)** | `https://<EC2_IP>.sslip.io/api` |

---

## 1. System Discovery & Telemetry Endpoints

### `GET /jobs/health-ping`
Performs a lightweight system check to confirm the gateway is online.
* **Response Status**: `200 OK`
* **JSON Payload**:
  ```json
  {
    "status": "ok"
  }
  ```

### `GET /assets/search`
Queries pre-defined critical infrastructure coordinates and metadata matching a text query.
* **Query Parameters**:
  * `query` (string, required): Search term (e.g. `Kolab`, `Hirakud`).
* **Response Status**: `200 OK`
* **JSON Payload**:
  ```json
  [
    {
      "name": "Upper Kolab Dam",
      "type": "DAM",
      "lat": 18.7889,
      "lon": 82.6049,
      "state": "Odisha, India",
      "description": "Concrete gravity and earthen masonry dam."
    }
  ]
  ```

### `GET /context`
Queries dynamic telemetry data (weather, soil anomalies, seismicity) for a geographical location.
* **Query Parameters**:
  * `lat` (float, required): Latitude of target coordinate.
  * `lon` (float, required): Longitude of target coordinate.
* **Response Status**: `200 OK`
* **JSON Payload**:
  ```json
  {
    "rainfall": "12.4 mm (Heavy Rain)",
    "soil_moisture": "Saturated (Waterlogging Risk)",
    "seismic": "No Activity (0 events > 2.5 M within 100km)",
    "season": "Monsoon",
    "storage_pct": 82.4,
    "source": "OHPC/IMD telemetry network"
  }
  ```

---

## 2. Satellite Catalog Search Endpoints

### `GET /search`
Queries the ESA Copernicus OData catalog for Sentinel-1 scenes matching criteria.
* **Query Parameters**:
  * `lat` (float, required): Latitude of target location.
  * `lon` (float, required): Longitude of target location.
  * `start_date` (string, optional): ISO-8601 start date (e.g. `2026-01-01`).
  * `end_date` (string, optional): ISO-8601 end date.
* **Response Status**: `200 OK`

### `GET /search/nisar`
Queries the NASA Alaska Satellite Facility (ASF) catalog for NISAR H5 products matching a bounding box.
* **Query Parameters**:
  * `bbox` (string, required): Bounding box format `west,south,east,north` (e.g. `82.5,18.7,82.7,18.9`).
  * `start_date` (string, optional): ISO-8601 start datetime (e.g. `2026-01-01T00:00:00Z`).
  * `end_date` (string, optional): ISO-8601 end datetime.
* **Response Status**: `200 OK`
* **JSON Payload**:
  ```json
  [
    {
      "id": "NISAR_L2_PR_GUNW_009_127_A_011_...",
      "date": "2026-01-05T23:53:14Z",
      "size_bytes": 128456209,
      "download_url": "https://datapool.asf.alaska.edu/GUNW/NISAR_...",
      "footprint": {
        "type": "Polygon",
        "coordinates": [[[82.5, 18.7], [82.7, 18.7], [82.7, 18.9], [82.5, 18.9], [82.5, 18.7]]]
      }
    }
  ]
  ```

---

## 3. Job Execution & Processing Endpoints

### `POST /jobs`
Submits a SAR processing task to the queue.
* **Content-Type**: `application/json`
* **JSON Request Properties**:
  * `input_file` (string, required): Absolute local path or remote URL to the master HDF5 file.
  * `slave_file` (string, optional): Absolute path to the secondary (slave) H5 product for InSAR.
  * `pipeline` (string, required): Target pipeline module (`insar`, `cfar`, or `standard_rda`).
  * `crop_lat` (float, optional): Center latitude to crop processing domain.
  * `crop_lon` (float, optional): Center longitude to crop processing domain.
  * `crop_radius_km` (float, optional): Radius of crop circle in kilometers (defaults to `10.0`).
* **Response Status**: `201 Created`
* **JSON Payload**:
  ```json
  {
    "job_id": "sar-f83d2a1b"
  }
  ```

### `GET /jobs/:id`
Retrieves the execution status and output products of a submitted job.
* **Response Status**: `200 OK`
* **JSON Payload**:
  ```json
  {
    "id": "sar-f83d2a1b",
    "status": "completed",
    "output_path": "results/sar-f83d2a1b.tif",
    "bbox": {
      "south": 18.723,
      "north": 18.854,
      "west": 82.511,
      "east": 82.689
    }
  }
  ```
* **Status Variants**: `queued`, `running`, `completed`, `failed(string_reason)`.

### `POST /jobs/:id/cancel`
Terminates an active processing task.
* **Response Status**: `200 OK`

### `POST /upload`
Uploads a local HDF5 product from the browser via multipart form data.
* **Content-Type**: `multipart/form-data`
* **Response Status**: `200 OK`
* **JSON Payload**:
  ```json
  {
    "path": "/home/aditya/Desktop/sar_analyzer/sar-gateway/results/uploads/temp.h5"
  }
  ```

---

## 4. Log Streaming (Server-Sent Events)

### `GET /jobs/:id/logs`
Establishes a persistent, uni-directional Server-Sent Events (SSE) stream returning stdout/stderr logs from the executing subprocess or container in real-time.

* **Headers**: `Content-Type: text/event-stream`, `Cache-Control: no-cache`
* **Stream Events**:
  * Late-connecting clients automatically receive a replay of all cached logs prior to receiving live log lines.
  * Specialized structured JSON events are embedded to trigger map redraws:
    * `{"event":"georef","bbox":{"south":...,"north":...}}` - Sets Leaflet bounds.
    * `{"event":"insar_report","path":"results/sar-xxx_insar.json"}` - Identifies Persistent Scatterers.
    * `{"event":"ships_detected","path":"results/sar-xxx_ships.json"}` - Identifies CFAR vessel coordinate markers.
  * System hooks report terminations: `[SYSTEM] PROCESS_COMPLETED` or `[SYSTEM] PROCESS_FAILED`.

---

## 5. Static Results Proxy

### `GET /results/*`
Static asset server exposing generated results (displacement maps, coherence maps, vector reports).
* **Usage**: TiTiler reads continuous GeoTIFFs from this endpoint using HTTP streaming:
  ```
  http://localhost:8000/cog/tiles/WebMercatorQuad/{z}/{x}/{y}?url=http://localhost:3000/results/sar-f83d2a1b_defo_phase.tif
  ```
