# Storage Module - S3 Buckets for SAR Data

variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "region" {
  type = string
}

variable "raw_data_retention_days" {
  type = number
}

variable "processed_data_retention_days" {
  type = number
}

variable "enable_versioning" {
  type    = bool
  default = false
}

variable "tags" {
  type = map(string)
}

# =============================================================================
# Raw SAR Data Bucket
# =============================================================================

resource "aws_s3_bucket" "raw_data" {
  bucket = "${var.project_name}-${var.environment}-raw-data-${var.region}"

  tags = merge(var.tags, {
    Name    = "${var.project_name}-raw-data"
    Purpose = "Raw SAR satellite data storage"
  })
}

resource "aws_s3_bucket_versioning" "raw_data" {
  bucket = aws_s3_bucket.raw_data.id
  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Disabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "raw_data" {
  bucket = aws_s3_bucket.raw_data.id

  rule {
    id     = "expire-raw-data"
    status = "Enabled"

    expiration {
      days = var.raw_data_retention_days
    }

    transition {
      days          = 7
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 30
      storage_class = "GLACIER"
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "raw_data" {
  bucket = aws_s3_bucket.raw_data.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "raw_data" {
  bucket = aws_s3_bucket.raw_data.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# =============================================================================
# Processed Data Bucket
# =============================================================================

resource "aws_s3_bucket" "processed_data" {
  bucket = "${var.project_name}-${var.environment}-processed-data-${var.region}"

  tags = merge(var.tags, {
    Name    = "${var.project_name}-processed-data"
    Purpose = "Processed SAR imagery storage"
  })
}

resource "aws_s3_bucket_versioning" "processed_data" {
  bucket = aws_s3_bucket.processed_data.id
  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Disabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "processed_data" {
  bucket = aws_s3_bucket.processed_data.id

  rule {
    id     = "expire-processed-data"
    status = "Enabled"

    expiration {
      days = var.processed_data_retention_days
    }

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "processed_data" {
  bucket = aws_s3_bucket.processed_data.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "processed_data" {
  bucket = aws_s3_bucket.processed_data.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# =============================================================================
# CORS Configuration (for dashboard access)
# =============================================================================

resource "aws_s3_bucket_cors_configuration" "processed_data" {
  bucket = aws_s3_bucket.processed_data.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"]  # Restrict in production
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# =============================================================================
# Outputs
# =============================================================================

output "raw_data_bucket" {
  value = {
    id   = aws_s3_bucket.raw_data.id
    arn  = aws_s3_bucket.raw_data.arn
    name = aws_s3_bucket.raw_data.bucket
  }
}

output "processed_data_bucket" {
  value = {
    id   = aws_s3_bucket.processed_data.id
    arn  = aws_s3_bucket.processed_data.arn
    name = aws_s3_bucket.processed_data.bucket
  }
}
