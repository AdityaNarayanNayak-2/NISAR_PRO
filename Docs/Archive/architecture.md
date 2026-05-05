# System Architecture

This document details the telemetry and task execution boundaries of the NISAR Pro platform. The system has migrated away from monolithic local sub-processes in favor of a distributed Kubernetes orchestration model.

## Component Network Topology

```text
[ Browser / Client ] 
       │
       ├─ (1) GET /search            --> Queries ESA OData API
       ├─ (2) POST /jobs             --> Gateway deploys CRD
       └─ (3) GET /jobs/{id}/logs    --> Gateway pipes SSE stream
       │
[ API Gateway (sar-gateway) ]
       │
       ├─ Authenticates via ServiceAccount with K8s APIServer
       ├─ Submits `SarJob` Custom Resources
       └─ Connects async IO streams to Pod stdouts
       │
[ K8s APIServer ]
       │
[ Custom Controller (sar_operator_v2) ]
       │
       ├─ Watches for new/modified `SarJob` objects
       ├─ Parses `processing_pipeline` and `ml_models` fields
       └─ Generates `batch/v1::Job` Pod Specs
       │
[ Stateful Workloads (sar_processor) ]
       │
       └─ Connects to S3/EFS persistent volumes
          Executes binary SAR calculations
          Writes `.png` outputs
```

## Detailed Subsystem Interactions

### SSE Telemetry Pipeline
One of the core architectural features is the ability of the frontend React client to view real-time compilation and execution logs of a processing job happening deep inside a remote Kubernetes node.

The flow is as follows:
1. Client requests `POST /jobs`. The Gateway uses `kube-rs` to construct a `SarJob` CRD and posts it.
2. The Gateway responds synchronously with a generated `Job ID`.
3. The Client immediately connects to `GET /jobs/{id}/logs` via EventSource.
4. The Gateway initiates an infinite `tokio` loop that queries the Kubernetes APIServer using a `ListParams` Label Selector (`sarjob={id}`).
5. Once the Operator generates the `Pod` and it enters the `Running` state, the Gateway triggers `kube::Api::log_stream()`.
6. This function utilizes `k8s-openapi` to connect an asynchronous network stream directly to the container daemon's stdout file.
7. The Gateway reads this stream line-by-line and broadcasts it onto the EventSource connection.

### SAR Processor
The `sar_processor` binary executes in a fire-and-forget capacity managed by the Kubernetes `Job` controller.
The binary accepts environment variables injected by the Operator:
- `SAR_SCENE_ID`
- `SAR_OUTPUT_PATH`
- `SAR_PIPELINE`
- `SAR_PURPOSE`

The spatial multilooking algorithm dynamically scales the image slice. By grouping the azimuth and range arrays into N-sized block averages (determined by the length of the coordinate request), speckle noise is virtually eliminated and the resulting PNG overlay is strictly constrained beneath 2048 pixels, preventing dashboard memory faults.
