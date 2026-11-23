output "kubeconfig_command" {
  value = "gcloud container clusters get-credentials ${google_container_cluster.this.name} --zone ${var.zone} --project ${var.project}"
}

output "open_app" {
  value = "kubectl -n nisar-pro port-forward svc/nisar-pro 3000:80   # then http://localhost:3000/app"
}
