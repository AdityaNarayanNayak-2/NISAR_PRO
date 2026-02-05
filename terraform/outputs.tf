# SAR Processor Infrastructure - Outputs

# =============================================================================
# Networking Outputs
# =============================================================================

output "vpc_id" {
  description = "ID of the VPC"
  value       = module.networking.vpc_id
}

output "private_subnet_ids" {
  description = "IDs of private subnets"
  value       = module.networking.private_subnet_ids
}

output "public_subnet_ids" {
  description = "IDs of public subnets"
  value       = module.networking.public_subnet_ids
}

# =============================================================================
# Kubernetes Cluster Outputs
# =============================================================================

output "cluster_name" {
  description = "Name of the EKS cluster"
  value       = module.k8s_cluster.cluster_name
}

output "cluster_endpoint" {
  description = "Endpoint for EKS cluster"
  value       = module.k8s_cluster.cluster_endpoint
  sensitive   = true
}

output "cluster_ca_certificate" {
  description = "CA certificate for EKS cluster"
  value       = module.k8s_cluster.cluster_ca_certificate
  sensitive   = true
}

output "kubeconfig_command" {
  description = "Command to configure kubectl"
  value       = "aws eks update-kubeconfig --region ${var.region} --name ${local.cluster_name}"
}

# =============================================================================
# Storage Outputs
# =============================================================================

output "raw_data_bucket" {
  description = "S3 bucket for raw SAR data"
  value       = module.storage.raw_data_bucket
}

output "processed_data_bucket" {
  description = "S3 bucket for processed SAR data"
  value       = module.storage.processed_data_bucket
}

# =============================================================================
# Container Registry Outputs
# =============================================================================

output "ecr_repository_urls" {
  description = "URLs for ECR repositories"
  value = {
    processor = aws_ecr_repository.sar_processor.repository_url
    gateway   = aws_ecr_repository.sar_gateway.repository_url
    dashboard = aws_ecr_repository.sar_dashboard.repository_url
  }
}

output "docker_login_command" {
  description = "Command to login to ECR"
  value       = "aws ecr get-login-password --region ${var.region} | docker login --username AWS --password-stdin ${aws_ecr_repository.sar_processor.repository_url}"
}

# =============================================================================
# Deployment Info
# =============================================================================

output "deployment_info" {
  description = "Summary of deployed infrastructure"
  value = {
    environment     = var.environment
    region          = var.region
    cluster_name    = local.cluster_name
    gpu_enabled     = var.enable_gpu_nodes
    gitops_enabled  = var.enable_gitops
  }
}
