# SAR Processor Infrastructure - Input Variables

# =============================================================================
# General Configuration
# =============================================================================

variable "project_name" {
  description = "Name of the project, used for resource naming"
  type        = string
  default     = "sar-processor"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "owner" {
  description = "Owner of the infrastructure"
  type        = string
  default     = "sar-team"
}

variable "region" {
  description = "AWS region for resources"
  type        = string
  default     = "ap-south-1"  # Mumbai - close to ISRO/SAR data
}

# =============================================================================
# Networking Configuration
# =============================================================================

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = ["ap-south-1a", "ap-south-1b", "ap-south-1c"]
}

# =============================================================================
# Kubernetes Cluster Configuration
# =============================================================================

variable "kubernetes_version" {
  description = "Kubernetes version for EKS"
  type        = string
  default     = "1.28"
}

variable "node_instance_types" {
  description = "EC2 instance types for worker nodes"
  type        = list(string)
  default     = ["t3.large", "t3.xlarge"]
}

variable "node_desired_size" {
  description = "Desired number of worker nodes"
  type        = number
  default     = 2
}

variable "node_min_size" {
  description = "Minimum number of worker nodes"
  type        = number
  default     = 1
}

variable "node_max_size" {
  description = "Maximum number of worker nodes"
  type        = number
  default     = 5
}

variable "node_disk_size" {
  description = "Disk size for worker nodes in GB"
  type        = number
  default     = 50
}

# =============================================================================
# GPU Node Configuration (for SAR processing)
# =============================================================================

variable "enable_gpu_nodes" {
  description = "Enable GPU nodes for SAR processing"
  type        = bool
  default     = false
}

variable "gpu_instance_types" {
  description = "EC2 instance types for GPU nodes"
  type        = list(string)
  default     = ["g4dn.xlarge", "g4dn.2xlarge"]
}

variable "gpu_node_desired_size" {
  description = "Desired number of GPU nodes"
  type        = number
  default     = 1
}

# =============================================================================
# Storage Configuration
# =============================================================================

variable "raw_data_retention_days" {
  description = "Number of days to retain raw SAR data"
  type        = number
  default     = 30
}

variable "processed_data_retention_days" {
  description = "Number of days to retain processed data"
  type        = number
  default     = 90
}

# =============================================================================
# GitOps Configuration
# =============================================================================

variable "enable_gitops" {
  description = "Enable FluxCD for GitOps deployment"
  type        = bool
  default     = true
}

variable "gitops_repo_url" {
  description = "Git repository URL for FluxCD"
  type        = string
  default     = ""
}
