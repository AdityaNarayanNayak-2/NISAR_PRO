# SAR Processor Infrastructure - Kind + Azure Hybrid
#
# This configuration deploys:
# - Local Kubernetes cluster using `tehcyx/kind` over Podman/Docker.
# - Azure Container Registry (ACR) for NISAR microservices.
# - Azure Blob Storage for raw and processed SAR data telemetry.

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    kind = {
      source  = "tehcyx/kind"
      version = "~> 0.6.0"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "kind" {}

provider "azurerm" {
  features {}
}

locals {
  safe_name = replace("${var.project_name}${var.environment}", "-", "")
}

# =============================================================================
# Local Compute: Kind (Kubernetes IN Docker/Podman)
# =============================================================================

resource "kind_cluster" "sar_local" {
  name           = var.kind_cluster_name
  node_image     = "kindest/node:v1.31.0"
  wait_for_ready = true

  kind_config {
    kind        = "Cluster"
    api_version = "kind.x-k8s.io/v1alpha4"

    node {
      role = "control-plane"
      
      kubeadm_config_patches = [
        "kind: InitConfiguration\nnodeRegistration:\n  kubeletExtraArgs:\n    node-labels: \"ingress-ready=true\"\n"
      ]
      
      extra_port_mappings {
        container_port = 80
        host_port      = 80
        protocol       = "TCP"
      }
      extra_port_mappings {
        container_port = 443
        host_port      = 443
        protocol       = "TCP"
      }
    }

    # Add 2 worker nodes for processing heavy SAR payloads
    node {
      role = "worker"
    }
    node {
      role = "worker"
    }
  }
}

# =============================================================================
# Cloud Components: Azure Resource Group
# =============================================================================

resource "azurerm_resource_group" "sar_rg" {
  name     = "${var.project_name}-rg-${var.environment}"
  location = var.azure_region
}

# =============================================================================
# Cloud Components: Azure Container Registry (ACR)
# =============================================================================

resource "azurerm_container_registry" "acr" {
  name                = "${local.safe_name}acr"
  resource_group_name = azurerm_resource_group.sar_rg.name
  location            = azurerm_resource_group.sar_rg.location
  sku                 = "Standard"
  admin_enabled       = true
}

# =============================================================================
# Cloud Components: Azure Storage Account & Containers
# =============================================================================

resource "azurerm_storage_account" "sar_storage" {
  name                     = "${local.safe_name}storage"
  resource_group_name      = azurerm_resource_group.sar_rg.name
  location                 = azurerm_resource_group.sar_rg.location
  account_tier             = "Standard"
  account_replication_type = "LRS"

  blob_properties {
    versioning_enabled = var.environment == "prod"
  }
}

resource "azurerm_storage_container" "raw_data" {
  name                  = "raw-data"
  storage_account_name  = azurerm_storage_account.sar_storage.name
  container_access_type = "private"
}

resource "azurerm_storage_container" "processed_tiles" {
  name                  = "processed-xyz-tiles"
  storage_account_name  = azurerm_storage_account.sar_storage.name
  container_access_type = "blob" # Allow read-only public access to XYZ tiles for the dashboard
}
