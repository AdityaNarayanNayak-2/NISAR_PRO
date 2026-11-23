output "kubeconfig_command" {
  value = "aws eks update-kubeconfig --region ${var.region} --name ${module.eks.cluster_name}"
}

output "open_app" {
  description = "Open the dashboard through a port-forward (add an Ingress for a public address)."
  value       = "kubectl -n nisar-pro port-forward svc/nisar-pro 3000:80   # then http://localhost:3000/app"
}

output "efs_id" {
  value = aws_efs_file_system.data.id
}
