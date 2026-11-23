variable "project" {
  description = "Google Cloud project id."
  type        = string
}

variable "region" {
  description = "Region. asia-south1 (Mumbai) keeps data in India."
  type        = string
  default     = "asia-south1"
}

variable "zone" {
  description = "One zone keeps the cluster free of the regional control-plane fee and Filestore zonal."
  type        = string
  default     = "asia-south1-a"
}

variable "name" {
  type    = string
  default = "nisar-pro"
}

variable "engine_machine_type" {
  description = "Spot machine type for engine workers (4 vCPU, 8+ GB)."
  type        = string
  default     = "c2d-standard-4"
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
  type      = string
  default   = ""
  sensitive = true
}
