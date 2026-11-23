terraform {
  required_version = ">= 1.6"
  required_providers {
    google = { source = "hashicorp/google", version = "~> 6.14" }
    helm   = { source = "hashicorp/helm", version = "~> 2.16" }
  }
}

provider "google" {
  project = var.project
  region  = var.region
}

data "google_client_config" "current" {}

provider "helm" {
  kubernetes {
    host                   = "https://${google_container_cluster.this.endpoint}"
    token                  = data.google_client_config.current.access_token
    cluster_ca_certificate = base64decode(google_container_cluster.this.master_auth[0].cluster_ca_certificate)
  }
}
