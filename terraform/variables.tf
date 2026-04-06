# SAR Processor Infrastructure - Variables

variable "project_name" {
  description = "Base name for Azure resources"
  type        = string
  default     = "sarprocessor"
}

variable "environment" {
  description = "Environment identifier (e.g., dev, prod)"
  type        = string
  default     = "dev"
}

variable "azure_region" {
  description = "Azure region for cloud resources"
  type        = string
  default     = "East US"
}

variable "kind_cluster_name" {
  description = "Name of the local kind cluster"
  type        = string
  default     = "nisar-local-cluster"
}
