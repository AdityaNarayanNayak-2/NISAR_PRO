# API Reference

## Base URL

| Environment | URL |
|-------------|-----|
| Local Dev | `http://localhost:3000` |
| Kubernetes | `http://sar-gateway-svc` (internal) |
| Via Dashboard | `/api/*` (proxied) |

---

## Endpoints

### GET /search

Search for SAR scenes near a location.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| lat | float | Yes | Latitude (-90 to 90) |
| lon | float | Yes | Longitude (-180 to 180) |
| start_date | string | No | ISO 8601 date (e.g., 2024-01-01) |
| end_date | string | No | ISO 8601 date |

**Example Request:**
```bash
curl "http://localhost:3000/search?lat=12.97&lon=77.59"
```

**Example Response:**
```json
[
  {
    "id": "S1A_IW_SLC__1SDV_20241115T...",
    "platform": "Sentinel-1A",
    "date": "2024-11-15T06:23:45Z",
    "footprint": {
      "type": "Polygon",
      "coordinates": [...]
    }
  }
]
```

**Error Responses:**

| Status | Meaning |
|--------|---------|
| 400 | Invalid parameters |
| 401 | ESA authentication failed |
| 503 | ESA API unavailable |

---

### GET /health

Health check endpoint.

**Example:**
```bash
curl http://localhost:3000/health
```

**Response:**
```json
{"status": "ok"}
```

---

## Authentication

The Gateway authenticates with ESA using OAuth2 Client Credentials flow. Credentials are read from environment variables:

```env
ESA_USERNAME=your_email
ESA_PASSWORD=your_password
```

The access token is cached and refreshed automatically.

---

## Future Endpoints (Planned)

| Endpoint | Purpose |
|----------|---------|
| POST /jobs | Create processing job |
| GET /jobs/{id} | Get job status |
| GET /jobs/{id}/result | Download processed output |
| GET /sources | List available data sources |
