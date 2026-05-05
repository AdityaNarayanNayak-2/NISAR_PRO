# NISARPro Architecture Diagrams
---

## 1. High-Level Architecture (Cloud Frontend + Local Backend)

This diagram shows the primary operating mode where the React dashboard is hosted statically in the cloud, while the heavy processing engine runs securely on the user's local machine (Zero-Upload Architecture).

```mermaid
flowchart TB
    classDef cloud fill:#0078D4,stroke:#fff,stroke-width:2px,color:#fff;
    classDef local fill:#E5F4FB,stroke:#0078D4,stroke-width:2px,color:#000;
    classDef external fill:#F3F2F1,stroke:#605E5C,stroke-width:2px,color:#000;
    classDef storage fill:#00BCF2,stroke:#fff,stroke-width:2px,color:#fff;

    subgraph Cloud["Cloud Hosting (GitLab Pages / Vercel)"]
        Dashboard["SAR Dashboard (React/Vite SPA)"]:::cloud
    end

    subgraph Local["User's Local Environment"]
        Browser["User's Web Browser"]:::local
        Gateway["SAR Gateway (Rust Axum on localhost:3000)"]:::local
        Processor["SAR Processor (Rust Core Engine)"]:::local
        LocalDisk[("Local Hard Drive / SSD")]:::storage
    end

    subgraph External["External Services"]
        NASA["NASA ASF DAAC"]:::external
    end

    Browser -- "1. Loads Static Assets via HTTPS" --> Dashboard
    Browser -- "2. API Requests & SSE Logs (localhost:3000)" --> Gateway
    Gateway -- "3. Spawns Child Process" --> Processor
    Processor -- "4. Reads Raw Data (HDF5/SAFE)" --> LocalDisk
    Processor -- "5. Writes Georeferenced PNG" --> LocalDisk
    LocalDisk -. "Manual Download" .- NASA

    %% Styling
    linkStyle 0,1,2,3,4 stroke:#0078D4,stroke-width:2px;
```

---

## 2. Deployment Workflow (CI/CD)

This diagram illustrates what happens when code is pushed to the repository. The pipeline automatically runs tests, security audits, and deploys the frontend to GitLab Pages.

```mermaid
flowchart LR
    classDef dev fill:#107C10,stroke:#fff,stroke-width:2px,color:#fff;
    classDef cicd fill:#D83B01,stroke:#fff,stroke-width:2px,color:#fff;
    classDef host fill:#0078D4,stroke:#fff,stroke-width:2px,color:#fff;

    Dev["Developer"]:::dev -- "git push" --> GitLab["GitLab Repository"]:::cicd

    subgraph Pipeline["GitLab CI/CD Pipeline"]
        direction TB
        BuildRust["build_rust"]:::cicd
        TestRust["test_rust"]:::cicd
        AuditRust["audit_rust"]:::cicd
        BuildNode["build_dashboard"]:::cicd
    end

    GitLab --> BuildRust
    GitLab --> TestRust
    GitLab --> AuditRust
    GitLab --> BuildNode

    Deploy["pages (Deploy to GitLab Pages)"]:::cicd

    BuildNode --> Deploy
    Deploy -- "Hosts Static Files" --> Pages["GitLab Pages Infrastructure"]:::host
```

---

## 3. SAR Processor (The Math Engine)

This diagram details the internal processing pipeline of the `sar_processor` Rust binary. It shows how raw signal data is transformed into a focused image.

```mermaid
flowchart TD
    classDef input fill:#00BCF2,stroke:#fff,stroke-width:2px,color:#fff;
    classDef compute fill:#0078D4,stroke:#fff,stroke-width:2px,color:#fff;
    classDef output fill:#107C10,stroke:#fff,stroke-width:2px,color:#fff;

    RawData[("Raw SAR Data (NISAR HDF5 / S1 SAFE)")]:::input

    subgraph Pipeline["Image Processing Pipeline (Rayon Parallelized)"]
        Parser["Parser Module (Extracts I/Q Data & Ephemeris)"]:::compute
        RangeComp["Range Compression (FFT -> Matched Filter -> IFFT)"]:::compute
        RCMC["RCMC (Sinc Interpolation for Range Cell Migration)"]:::compute
        AzimuthComp["Azimuth Compression (Azimuth Matched Filter)"]:::compute
        Detect["Amplitude Detection & Multi-looking"]:::compute
    end

    subgraph Addons["Advanced Processing (Optional)"]
        CFAR["CA-CFAR Ship Detection"]:::compute
        InSAR["InSAR Coherence & Interferogram"]:::compute
    end

    OutputImage["Focused SAR Image (PNG)"]:::output
    OutputVector["Ship Bounding Boxes (GeoJSON)"]:::output

    RawData --> Parser
    Parser --> RangeComp
    RangeComp --> RCMC
    RCMC --> AzimuthComp
    AzimuthComp --> Detect
    
    Detect --> OutputImage
    Detect --> CFAR
    Detect --> InSAR

    CFAR --> OutputVector
```

---

## 4. SAR Dashboard

This outlines the component structure of the React frontend, showing how it manages state and communicates with the backend.

```mermaid
flowchart TB
    classDef ui fill:#0078D4,stroke:#fff,stroke-width:2px,color:#fff;
    classDef state fill:#50E6FF,stroke:#0078D4,stroke-width:2px,color:#000;
    classDef api fill:#E5F4FB,stroke:#0078D4,stroke-width:2px,color:#000;

    subgraph App["React Dashboard (sar-dashboard-v3)"]
        Router["React Router"]:::state
        
        subgraph Pages["Main Views"]
            Connection["ConnectionSetup.jsx (Gatekeeper)"]:::ui
            Dashboard["AppDashboard.jsx"]:::ui
            Docs["DocsPage.jsx"]:::ui
            Academy["AcademyPage.jsx"]:::ui
        end
        
        subgraph Components["Dashboard Components"]
            Search["NisarCatalogSearch.jsx"]:::ui
            Viz["DataVisualization.jsx (Leaflet Map)"]:::ui
            Logs["Log Terminal"]:::ui
        end
        
        APIConfig["api.js (Centralized URL Config)"]:::api
    end

    Gateway["Local sar-gateway (localhost:3000)"]:::state

    Router --> Connection
    Router --> Dashboard
    Router --> Docs
    Router --> Academy

    Dashboard --> Search
    Dashboard --> Viz
    Dashboard --> Logs

    Connection -- "Writes URL" --> LocalStorage[("localStorage")]:::state
    APIConfig -- "Reads URL" --> LocalStorage

    Search -- "fetch()" --> APIConfig
    Dashboard -- "fetch() & EventSource" --> APIConfig
    APIConfig -- "HTTP GET/POST/SSE" --> Gateway
```

---

## 5. SAR Operator (Kubernetes Mode)

For users running the platform in a Kubernetes environment instead of locally, this diagram shows how the custom `sar_operator_v2` manages workloads.

```mermaid
flowchart TD
    classDef user fill:#605E5C,stroke:#fff,stroke-width:2px,color:#fff;
    classDef k8s fill:#0078D4,stroke:#fff,stroke-width:2px,color:#fff;
    classDef resource fill:#00BCF2,stroke:#fff,stroke-width:2px,color:#fff;

    Admin["Cluster Admin / User"]:::user
    API["Kubernetes API Server"]:::k8s

    subgraph Operator["sar_operator_v2 (kube-rs)"]
        Controller["Reconciliation Loop"]:::k8s
    end

    subgraph Cluster["Kubernetes Cluster"]
        CRD["SarJob Custom Resource"]:::resource
        Job["batch/v1 Job"]:::resource
        Pod["Pod (runs sar-processor Docker Image)"]:::resource
        PVC[("Persistent Volume Claim (Data Storage)")]:::resource
    end

    Admin -- "1. kubectl apply -f job.yaml" --> API
    API -- "2. Stores" --> CRD
    Controller -- "3. Watches for new SarJobs" --> API
    Controller -- "4. Generates Job Manifest" --> API
    API -- "5. Creates" --> Job
    Job -- "6. Schedules" --> Pod
    Pod -- "7. Mounts Volume & Processes Data" --> PVC
```
