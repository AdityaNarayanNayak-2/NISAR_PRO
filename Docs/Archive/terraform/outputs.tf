# SAR Processor Infrastructure - Outputs

output "kind_kubeconfig" {
  description = "Kubeconfig content for the local Kind cluster"
  value       = kind_cluster.sar_local.kubeconfig
  sensitive   = true
}

output "acr_login_server" {
  description = "The URL of the Azure Container Registry"
  value       = azurerm_container_registry.acr.login_server
}

output "storage_account_name" {
  description = "The name of the Azure Storage Account"
  value       = azurerm_storage_account.sar_storage.name
}

output "storage_account_primary_connection_string" {
  description = "Connection string for the SAR processing nodes to write data to Azure"
  value       = azurerm_storage_account.sar_storage.primary_connection_string
  sensitive   = true
}
