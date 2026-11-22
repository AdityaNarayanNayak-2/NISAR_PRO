output "instance_id" {
  value = aws_instance.node.id
}

output "public_ip" {
  value = aws_instance.node.public_ip
}

output "url" {
  description = "Reachable only from allowed_cidrs."
  value       = length(var.allowed_cidrs) > 0 ? "http://${aws_instance.node.public_ip}/app" : "(no public access; use port_forward)"
}

output "port_forward" {
  description = "Open the app at http://localhost:3000/app through SSM, no open ports needed."
  value       = "aws ssm start-session --region ${var.region} --target ${aws_instance.node.id} --document-name AWS-StartPortForwardingSession --parameters portNumber=80,localPortNumber=3000"
}
