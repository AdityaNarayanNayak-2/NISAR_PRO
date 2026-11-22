variable "region" {
  description = "AWS region. ap-south-1 (Mumbai) keeps data in India."
  type        = string
  default     = "ap-south-1"
}

variable "name" {
  description = "Name prefix for every resource."
  type        = string
  default     = "nisar-pro"
}

variable "instance_type" {
  description = "4 vCPU / 8 GB runs one full L-band scene pair in about a minute."
  type        = string
  default     = "c6i.xlarge"
}

variable "data_volume_gb" {
  description = "Scenes (L ~7 GB, S ~12.6 GB each) and results. Kept when the instance is replaced."
  type        = number
  default     = 200
}

variable "image" {
  description = "Container image to run."
  type        = string
  default     = "ghcr.io/adityanarayannayak-2/nisar-pro:main"
}

variable "allowed_cidrs" {
  description = "CIDRs allowed to reach the app on port 80. Empty: no public access, use the SSM port forward."
  type        = list(string)
  default     = []
}

variable "earthdata_token" {
  description = "NASA Earthdata token for downloads. Stored as an SSM SecureString, never in user data."
  type        = string
  default     = ""
  sensitive   = true
}
