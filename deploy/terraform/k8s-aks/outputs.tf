output "kubeconfig_command" {
  value = "az aks get-credentials --resource-group ${azurerm_resource_group.this.name} --name ${azurerm_kubernetes_cluster.this.name}"
}

output "open_app" {
  value = "kubectl -n nisar-pro port-forward svc/nisar-pro 3000:80   # then http://localhost:3000/app"
}
