# SAR Processor Infrastructure - Main Configuration
# OpenTofu/Terraform compatible
#
# This configuration deploys:
# - Kubernetes cluster for SAR processing
# - Object storage for SAR data
# - Container registry for images
# - Networking infrastructure

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
  }

  # Backend configuration - uncomment for production
  # backend "s3" {
  #   bucket         = "sar-processor-tfstate"
  #   key            = "terraform.tfstate"
  #   region         = "ap-south-1"
  #   encrypt        = true
  #   dynamodb_table = "sar-processor-tfstate-lock"
  # }
}

# Local variables
locals {
  common_tags = {
    Project     = "SAR-Processor"
    Environment = var.environment
    ManagedBy   = "OpenTofu"
    Owner       = var.owner
  }

  cluster_name = "${var.project_name}-${var.environment}"
}

# =============================================================================
# Networking Module
# =============================================================================

module "networking" {
  source = "./modules/networking"

  project_name       = var.project_name
  environment        = var.environment
  region             = var.region
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
  
  tags = local.common_tags
}

# =============================================================================
# Storage Module (S3 buckets for SAR data)
# =============================================================================

module "storage" {
  source = "./modules/storage"

  project_name = var.project_name
  environment  = var.environment
  region       = var.region
  
  # Bucket configuration
  raw_data_retention_days       = var.raw_data_retention_days
  processed_data_retention_days = var.processed_data_retention_days
  enable_versioning             = var.environment == "prod"
  
  tags = local.common_tags
}

# =============================================================================
# Kubernetes Cluster Module (EKS)
# =============================================================================

module "k8s_cluster" {
  source = "./modules/k8s-cluster"

  cluster_name    = local.cluster_name
  cluster_version = var.kubernetes_version
  
  vpc_id          = module.networking.vpc_id
  subnet_ids      = module.networking.private_subnet_ids
  
  # Node group configuration
  node_instance_types = var.node_instance_types
  node_desired_size   = var.node_desired_size
  node_min_size       = var.node_min_size
  node_max_size       = var.node_max_size
  node_disk_size      = var.node_disk_size
  
  # GPU nodes for SAR processing (optional)
  enable_gpu_nodes       = var.enable_gpu_nodes
  gpu_instance_types     = var.gpu_instance_types
  gpu_node_desired_size  = var.gpu_node_desired_size
  
  tags = local.common_tags
  
  depends_on = [module.networking]
}

# =============================================================================
# Container Registry (ECR)
# =============================================================================

resource "aws_ecr_repository" "sar_processor" {
  name                 = "${var.project_name}-processor"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = local.common_tags
}

resource "aws_ecr_repository" "sar_gateway" {
  name                 = "${var.project_name}-gateway"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = local.common_tags
}

resource "aws_ecr_repository" "sar_dashboard" {
  name                 = "${var.project_name}-dashboard"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = local.common_tags
}

# ECR lifecycle policy - keep last 10 images
resource "aws_ecr_lifecycle_policy" "cleanup" {
  for_each   = toset(["${var.project_name}-processor", "${var.project_name}-gateway", "${var.project_name}-dashboard"])
  repository = each.key

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 10 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = {
        type = "expire"
      }
    }]
  })

  depends_on = [
    aws_ecr_repository.sar_processor,
    aws_ecr_repository.sar_gateway,
    aws_ecr_repository.sar_dashboard
  ]
}

# =============================================================================
# Kubernetes Resources (deployed via Helm/kubectl)
# =============================================================================

# Configure kubernetes provider after cluster is created
provider "kubernetes" {
  host                   = module.k8s_cluster.cluster_endpoint
  cluster_ca_certificate = base64decode(module.k8s_cluster.cluster_ca_certificate)
  
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", local.cluster_name]
  }
}

provider "helm" {
  kubernetes {
    host                   = module.k8s_cluster.cluster_endpoint
    cluster_ca_certificate = base64decode(module.k8s_cluster.cluster_ca_certificate)
    
    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args        = ["eks", "get-token", "--cluster-name", local.cluster_name]
    }
  }
}

# Namespace for SAR processor
resource "kubernetes_namespace" "sar_processor" {
  metadata {
    name = "sar-processor"
    
    labels = {
      "app.kubernetes.io/managed-by" = "terraform"
    }
  }

  depends_on = [module.k8s_cluster]
}

# FluxCD for GitOps (optional)
resource "helm_release" "flux" {
  count = var.enable_gitops ? 1 : 0

  name       = "flux"
  repository = "https://fluxcd-community.github.io/helm-charts"
  chart      = "flux2"
  namespace  = "flux-system"
  
  create_namespace = true

  depends_on = [module.k8s_cluster]
}
