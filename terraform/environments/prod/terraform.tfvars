# Production Environment Configuration

project_name = "sar-processor"
environment  = "prod"
owner        = "sar-team"
region       = "ap-south-1"  # Mumbai

# Networking - same CIDR, 3 AZs for HA
vpc_cidr           = "10.0.0.0/16"
availability_zones = ["ap-south-1a", "ap-south-1b", "ap-south-1c"]

# Kubernetes - larger instances for production
kubernetes_version  = "1.28"
node_instance_types = ["t3.large", "t3.xlarge"]
node_desired_size   = 3
node_min_size       = 2
node_max_size       = 10
node_disk_size      = 100

# GPU nodes for production SAR processing
enable_gpu_nodes       = true
gpu_instance_types     = ["g4dn.xlarge"]
gpu_node_desired_size  = 1

# Storage - longer retention for production
raw_data_retention_days       = 30
processed_data_retention_days = 365

# GitOps enabled for production
enable_gitops    = true
gitops_repo_url  = "https://gitlab.com/Aditya-Narayan-Nayak/nisar_pro.git"
