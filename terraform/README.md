# SAR Processor Infrastructure

This directory contains OpenTofu/Terraform configuration for deploying the SAR processing infrastructure to cloud providers.

## Overview

The infrastructure deploys:
- **Kubernetes Cluster** (EKS/GKE) for SAR processing workloads
- **Object Storage** (S3/GCS) for raw SAR data and processed outputs
- **Container Registry** for Docker images
- **VPC/Network** configuration
- **IAM/RBAC** for secure access

## Directory Structure

```
terraform/
├── environments/
│   ├── dev/          # Development environment
│   └── prod/         # Production environment
├── modules/
│   ├── k8s-cluster/  # Kubernetes cluster module
│   ├── storage/      # Object storage module
│   └── networking/   # VPC and networking module
├── main.tf           # Root configuration
├── variables.tf      # Input variables
├── outputs.tf        # Outputs
└── providers.tf      # Provider configuration
```

## Usage

```bash
# Initialize (first time)
tofu init

# Plan changes
tofu plan -var-file=environments/dev/terraform.tfvars

# Apply (creates resources - COSTS MONEY!)
tofu apply -var-file=environments/dev/terraform.tfvars

# Destroy (removes all resources)
tofu destroy -var-file=environments/dev/terraform.tfvars
```

## Prerequisites

1. OpenTofu or Terraform >= 1.5
2. Cloud provider CLI configured (aws/gcloud)
3. Appropriate IAM permissions

## Cost Warning

⚠️ **These configurations will create real cloud resources that incur costs!**  
Always run `tofu plan` first and review before applying.

## Supported Providers

- AWS (primary)
- GCP (alternative)

Set `cloud_provider` variable to switch between them.
