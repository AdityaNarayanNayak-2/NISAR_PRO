# ADITYA NARAYAN NAYAK
+91 6372299553 ⋄ Bhubaneswar, IN  
Mail ⋄ LinkedIn ⋄ GitLab

## OBJECTIVE
Platform Engineer building high-performance geospatial and cloud-native systems. Currently developing NISAR Pro, a real-time SAR & InSAR data processing platform in pure Rust using NASA (ASF) / ISRO NISAR satellite datasets. Experienced in Kubernetes, multi-cloud infrastructure, and scalable distributed data pipelines. Cloud Native Hackathon Winner.

## SKILLS
* **Programming:** Rust, Python, Shell Script, YAML, TypeScript, JavaScript
* **Cloud & DevOps:** Kubernetes, Docker, Terraform, GitLab CI/CD, Azure, GCP, Azure Arc, Prometheus, Grafana
* **SAR & Geospatial:** Range-Doppler Algorithm, InSAR, Persistent Scatterer Analysis, POLSAR, NISAR HDF5 (RSLC/GCOV/GUNW), Sentinel-1 SAFE, GeoTIFF, Leaflet
* **Frameworks/Libraries:** Axum, Tokio, React, ndarray, kube-rs

## EXPERIENCE

**Cloud and DevOps Engineer** | Tecfinics Pvt Ltd | *Aug 2023 – Feb 2024 (Remote, IN)*
• Led deployments across development and test environments, securing 6 critical microservices with end-to-end CI/CD pipelines.
• Provisioned GKE infrastructure including VPC, subnets, and GCR; integrated GitLab CI for Keycloak, PostgreSQL, and RabbitMQ, reducing environment setup time by 30%.
• Optimized GitLab pipelines for build management and continuous integration, reducing overall build times by 30%.

**DevOps Engineer** | OD10 Ventures | *Feb 2022 – May 2023 (Remote, IN)*
• Implemented Kubernetes clusters with Envoy and Consul service mesh, improving microservices reliability across production workloads.
• Deployed and maintained Prometheus and Grafana monitoring stack for system-wide observability and capacity alerting.
• Managed cloud infrastructure across AWS, Azure, and GCP supporting highly available open-source production applications.

## PROJECTS

**NISAR Pro — Distributed Geospatial Intelligence Platform** | *Rust, Kubernetes, React, Axum* | *2024 – Present*
*[gitlab.com/Aditya-Narayan-Nayak/nisar_pro]*
• Engineered a complete Synthetic Aperture Radar (SAR) processing pipeline in pure Rust, implementing the Range-Doppler Algorithm with sinc-interpolated RCMC, Lee Sigma filtering, and CLAHE contrast enhancement—achieving zero dependency on Python or C++ libraries.
• Developed an advanced **InSAR (Interferometric SAR) module**, implementing complex interferogram formation and spatial coherence estimation via parallelized `ndarray` operations to detect Persistent Scatterers (PS).
• Built a structural health monitoring engine capable of measuring millimeter-level displacement on critical infrastructure (bridges, dams), automatically classifying anomalies into Stable/Critical GeoJSON reports.
• Wrote a native HDF5 parser for NASA/ISRO architectures, extracting complex SLC arrays from compound datatypes and processing a 6.4GB RSLC matrix (31,920 × 26,338 samples) in ∼3 minutes.
• Architected a distributed execution backend using a custom `kube-rs` Kubernetes operator to reconcile `SarJob` CRDs into batch pods, streaming processing logs via Server-Sent Events (SSE) to an interactive React/Leaflet dashboard.

**AutodeployAI** | *TypeScript, OpenRouter* | *2023*
• Built a web application that generates production-ready Dockerfiles and Kubernetes manifests from natural language descriptions using LLM inference.
• Reduced manual DevOps effort by automating infrastructure configuration and accelerating deployment workflows.

**Pothole Detection via Drone Footage** | *TypeScript, Roboflow* | *2023*
• Built a web application performing real-time pothole detection on drone footage using Roboflow model inference.
• Enabled automated road condition analysis to support scalable infrastructure monitoring and maintenance decisions.

## CERTIFICATIONS
• **AZ-104** — Microsoft Certified Azure Administrator [credential]
• **GCP ACE** — Google Associate Cloud Engineer [credential]
• **AZ-900** — Microsoft Azure Fundamentals [credential]
• **HashiCorp Terraform Associate 003** [credential]

## EDUCATION
**B.Tech. in Computer Science** | GKCET | *2024 – 2026*
*Cloud Native Hackathon Winner*








