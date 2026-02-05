# Development Environment Configuration

project_name = "sar-processor"
environment  = "dev"
owner        = "aditya-narayan-nayak"
region       = "ap-south-1"  # Mumbai

# Networking
vpc_cidr           = "10.0.0.0/16"
availability_zones = ["ap-south-1a", "ap-south-1b"]

# Kubernetes
kubernetes_version  = "1.28"
node_instance_types = ["t3.medium"]  # Smaller for dev
node_desired_size   = 2
node_min_size       = 1
node_max_size       = 3
node_disk_size      = 30

# No GPU nodes in dev (cost savings)
enable_gpu_nodes = false

# Storage - shorter retention for dev
raw_data_retention_days       = 7
processed_data_retention_days = 14

# GitOps
enable_gitops = false  # Manual deployments in dev
