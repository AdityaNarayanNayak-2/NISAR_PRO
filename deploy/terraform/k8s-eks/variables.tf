variable "region" {
  description = "AWS region. ap-south-1 (Mumbai) keeps data in India."
  type        = string
  default     = "ap-south-1"
}

variable "name" {
  description = "Name for the cluster and its resources."
  type        = string
  default     = "nisar-pro"
}

variable "kubernetes_version" {
  type    = string
  default = "1.31"
}

variable "engine_instance_types" {
  description = "Spot instance types for engine workers (4 vCPU / 8+ GB each; several types = fewer Spot interruptions)."
  type        = list(string)
  default     = ["c6i.xlarge", "c6a.xlarge", "c5.xlarge", "m6i.xlarge"]
}

variable "engine_max_nodes" {
  description = "Most engine nodes at once (one run per node). 0 when idle."
  type        = number
  default     = 4
}

variable "image_tag" {
  type    = string
  default = "main"
}

variable "earthdata_token" {
  description = "NASA Earthdata token for downloading scenes in the app (optional)."
  type        = string
  default     = ""
  sensitive   = true
}
