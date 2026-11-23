# NISAR Pro on AKS: gateway (2 copies) + Redis queue + KEDA engine workers on a Spot node pool
# that scales to 0, files on Azure Files (ReadWriteMany). AKS runs KEDA as a managed add-on.

resource "azurerm_resource_group" "this" {
  name     = "${var.name}-rg"
  location = var.location
  tags     = { project = "nisar-pro", managed-by = "terraform" }
}

resource "azurerm_kubernetes_cluster" "this" {
  name                = var.name
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  dns_prefix          = var.name
  sku_tier            = "Free"

  default_node_pool {
    name                        = "system"
    vm_size                     = "Standard_B2s"
    node_count                  = 1
    temporary_name_for_rotation = "systemtmp"
    upgrade_settings {
      max_surge = "10%"
    }
  }

  identity {
    type = "SystemAssigned"
  }

  # Managed KEDA: no Helm release needed.
  workload_autoscaler_profile {
    keda_enabled = true
  }

  storage_profile {
    file_driver_enabled = true # Azure Files CSI: storage class azurefile-csi (ReadWriteMany)
  }

  tags = azurerm_resource_group.this.tags
}

# Engine workers only (taint), on Spot, 0 nodes when nothing is queued.
resource "azurerm_kubernetes_cluster_node_pool" "engine" {
  name                  = "engine"
  kubernetes_cluster_id = azurerm_kubernetes_cluster.this.id
  vm_size               = var.engine_vm_size
  priority              = "Spot"
  eviction_policy       = "Delete"
  spot_max_price        = -1 # pay up to the on-demand price, never more
  auto_scaling_enabled  = true
  min_count             = 0
  max_count             = var.engine_max_nodes
  node_labels = {
    "nisar-pro/pool"                        = "engine"
    "kubernetes.azure.com/scalesetpriority" = "spot"
  }
  node_taints = [
    "nisar-pro/engine=true:NoSchedule",
    "kubernetes.azure.com/scalesetpriority=spot:NoSchedule",
  ]
  tags = azurerm_resource_group.this.tags
}

resource "helm_release" "nisar" {
  name             = "nisar-pro"
  chart            = "${path.module}/../../helm/nisar-pro"
  namespace        = "nisar-pro"
  create_namespace = true
  values = [yamlencode({
    image       = { tag = var.image_tag, pullPolicy = "Always" }
    gateway     = { replicas = 2 }
    queue       = { enabled = true, kedaNamespace = "kube-system" } # the AKS add-on runs KEDA there
    earthdata   = { token = var.earthdata_token }
    persistence = { accessModes = ["ReadWriteMany"], storageClass = "azurefile-csi", size = "200Gi" }
    worker = {
      mode         = "keda"
      maxReplicas  = var.engine_max_nodes
      nodeSelector = { "nisar-pro/pool" = "engine" }
      tolerations = [
        { key = "nisar-pro/engine", operator = "Equal", value = "true", effect = "NoSchedule" },
        { key = "kubernetes.azure.com/scalesetpriority", operator = "Equal", value = "spot", effect = "NoSchedule" },
      ]
    }
  })]
  depends_on = [azurerm_kubernetes_cluster_node_pool.engine]
}
