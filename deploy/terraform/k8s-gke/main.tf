# NISAR Pro on GKE: gateway (2 copies) + Redis queue + KEDA engine workers on a Spot node pool
# that scales to 0, files on Filestore (ReadWriteMany, storage class standard-rwx).
# Filestore's smallest basic share is 1 TiB, the largest fixed cost here: see README.md.

resource "google_project_service" "apis" {
  for_each           = toset(["container.googleapis.com", "file.googleapis.com"])
  service            = each.value
  disable_on_destroy = false
}

resource "google_container_cluster" "this" {
  name     = var.name
  location = var.zone

  remove_default_node_pool = true
  initial_node_count       = 1
  deletion_protection      = false

  release_channel {
    channel = "REGULAR"
  }

  addons_config {
    gcp_filestore_csi_driver_config {
      enabled = true
    }
  }

  workload_identity_config {
    workload_pool = "${var.project}.svc.id.goog"
  }

  depends_on = [google_project_service.apis]
}

# Gateway, Redis, KEDA and system pods.
resource "google_container_node_pool" "system" {
  name       = "system"
  cluster    = google_container_cluster.this.id
  node_count = 1
  node_config {
    machine_type = "e2-standard-2"
    disk_size_gb = 30
    oauth_scopes = ["https://www.googleapis.com/auth/cloud-platform"]
    shielded_instance_config {
      enable_secure_boot = true
    }
  }
}

# Engine workers only (taint), on Spot, 0 nodes when nothing is queued.
resource "google_container_node_pool" "engine" {
  name    = "engine"
  cluster = google_container_cluster.this.id
  autoscaling {
    min_node_count = 0
    max_node_count = var.engine_max_nodes
  }
  node_config {
    machine_type = var.engine_machine_type
    spot         = true
    disk_size_gb = 30
    labels       = { "nisar-pro/pool" = "engine" }
    taint {
      key    = "nisar-pro/engine"
      value  = "true"
      effect = "NO_SCHEDULE"
    }
    oauth_scopes = ["https://www.googleapis.com/auth/cloud-platform"]
    shielded_instance_config {
      enable_secure_boot = true
    }
  }
}

resource "helm_release" "keda" {
  name             = "keda"
  repository       = "https://kedacore.github.io/charts"
  chart            = "keda"
  version          = "2.16.1"
  namespace        = "keda"
  create_namespace = true
  depends_on       = [google_container_node_pool.system]
}

resource "helm_release" "nisar" {
  name             = "nisar-pro"
  chart            = "${path.module}/../../helm/nisar-pro"
  namespace        = "nisar-pro"
  create_namespace = true
  values = [yamlencode({
    image       = { tag = var.image_tag, pullPolicy = "Always" }
    gateway     = { replicas = 2 }
    queue       = { enabled = true }
    earthdata   = { token = var.earthdata_token }
    persistence = { accessModes = ["ReadWriteMany"], storageClass = "standard-rwx", size = "1Ti" }
    worker = {
      mode         = "keda"
      maxReplicas  = var.engine_max_nodes
      nodeSelector = { "nisar-pro/pool" = "engine" }
      tolerations  = [{ key = "nisar-pro/engine", operator = "Equal", value = "true", effect = "NoSchedule" }]
    }
  })]
  depends_on = [helm_release.keda, google_container_node_pool.engine]
}
