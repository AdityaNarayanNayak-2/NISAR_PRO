variable "subscription_id" {
  description = "Azure subscription id."
  type        = string
}

variable "location" {
  description = "Azure region. centralindia (Pune) keeps data in India."
  type        = string
  default     = "centralindia"
}

variable "name" {
  type    = string
  default = "nisar-pro"
}

variable "engine_vm_size" {
  description = "Spot VM size for engine workers (4 vCPU, 8 GB)."
  type        = string
  default     = "Standard_F4s_v2"
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
