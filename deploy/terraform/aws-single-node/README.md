# NISAR Pro on AWS (single node)

One EC2 instance (default `c6i.xlarge`, Mumbai) runs the NISAR Pro container under systemd with
Podman Quadlet. Scenes and results live on a separate encrypted gp3 volume. No SSH key and, by
default, no open ports: you reach the app through an AWS Systems Manager port forward.

```bash
terraform init
terraform apply -var 'earthdata_token=...'          # token optional, stored as SSM SecureString
$(terraform output -raw port_forward)               # then open http://localhost:3000/app
```

| Choice | Why |
|---|---|
| Single node, not EKS | One district's monitoring needs one engine slot; EKS adds ~USD 73/month for the control plane alone. Use the Helm chart when a cluster already exists. |
| Separate data volume | Replacing the instance (new AMI, new image) keeps scenes and runs. |
| SSM, IMDSv2, encrypted volumes, no SSH | Smaller attack surface for a government network review. |
| `AutoUpdate=registry` | `podman-auto-update.timer` pulls a new image tag pushed by CI. |
| ap-south-1 | Data stays in India. |

Destroy: `terraform destroy` (the data volume is deleted too; snapshot it first if needed).
