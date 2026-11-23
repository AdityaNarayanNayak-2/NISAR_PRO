# NISAR Pro on EKS: gateway (2 copies) + Redis queue + KEDA engine workers on Spot nodes, files
# on EFS (ReadWriteMany, shared by gateway and workers). See README.md for costs and use.

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  azs = slice(data.aws_availability_zones.available.names, 0, 2)
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.16"

  name            = var.name
  cidr            = "10.50.0.0/16"
  azs             = local.azs
  private_subnets = ["10.50.1.0/24", "10.50.2.0/24"]
  public_subnets  = ["10.50.101.0/24", "10.50.102.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = true # one NAT for the whole VPC keeps the bill down

  public_subnet_tags  = { "kubernetes.io/role/elb" = 1 }
  private_subnet_tags = { "kubernetes.io/role/internal-elb" = 1 }
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.31"

  cluster_name    = var.name
  cluster_version = var.kubernetes_version
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnets

  cluster_endpoint_public_access           = true
  enable_cluster_creator_admin_permissions = true

  cluster_addons = {
    coredns                = {}
    kube-proxy             = {}
    vpc-cni                = {}
    eks-pod-identity-agent = {}
    aws-efs-csi-driver = {
      pod_identity_association = [{
        role_arn        = aws_iam_role.efs_csi.arn
        service_account = "efs-csi-controller-sa"
      }]
    }
  }

  eks_managed_node_groups = {
    # Gateway, Redis, KEDA and system pods.
    system = {
      instance_types = ["t3.medium"]
      min_size       = 1
      max_size       = 2
      desired_size   = 1
    }
    # Engine workers only (taint), on Spot. Scales to 0 with the cluster autoscaler or Karpenter.
    engine = {
      instance_types = var.engine_instance_types
      capacity_type  = "SPOT"
      min_size       = 0
      max_size       = var.engine_max_nodes
      desired_size   = 0
      labels         = { "nisar-pro/pool" = "engine" }
      taints = {
        engine = { key = "nisar-pro/engine", value = "true", effect = "NO_SCHEDULE" }
      }
    }
  }
}

# ── EFS: ReadWriteMany storage for scenes and runs ──────────────────────────
resource "aws_iam_role" "efs_csi" {
  name = "${var.name}-efs-csi"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "pods.eks.amazonaws.com" }
      Action    = ["sts:AssumeRole", "sts:TagSession"]
    }]
  })
}

resource "aws_iam_role_policy_attachment" "efs_csi" {
  role       = aws_iam_role.efs_csi.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEFSCSIDriverPolicy"
}

resource "aws_security_group" "efs" {
  name_prefix = "${var.name}-efs-"
  vpc_id      = module.vpc.vpc_id
  ingress {
    description = "NFS from the cluster"
    from_port   = 2049
    to_port     = 2049
    protocol    = "tcp"
    cidr_blocks = [module.vpc.vpc_cidr_block]
  }
}

resource "aws_efs_file_system" "data" {
  creation_token   = "${var.name}-data"
  encrypted        = true
  performance_mode = "generalPurpose"
  throughput_mode  = "elastic" # scene reads are bursty; pay per GB moved, not provisioned
  lifecycle_policy {
    transition_to_ia = "AFTER_30_DAYS"
  }
  tags = { Name = "${var.name}-data" }
}

resource "aws_efs_mount_target" "data" {
  count           = length(local.azs)
  file_system_id  = aws_efs_file_system.data.id
  subnet_id       = module.vpc.private_subnets[count.index]
  security_groups = [aws_security_group.efs.id]
}

# ── KEDA and NISAR Pro ──────────────────────────────────────────────────────
resource "helm_release" "keda" {
  name             = "keda"
  repository       = "https://kedacore.github.io/charts"
  chart            = "keda"
  version          = "2.16.1"
  namespace        = "keda"
  create_namespace = true
  depends_on       = [module.eks]
}

resource "helm_release" "efs_storage_class" {
  name      = "efs-sc"
  chart     = "${path.module}/../storage-class"
  namespace = "kube-system"
  values = [yamlencode({
    name        = "efs-sc"
    provisioner = "efs.csi.aws.com"
    parameters = {
      provisioningMode = "efs-ap"
      fileSystemId     = aws_efs_file_system.data.id
      directoryPerms   = "700"
      uid              = "10001"
      gid              = "10001"
    }
  })]
  depends_on = [module.eks, aws_efs_mount_target.data]
}

resource "helm_release" "nisar" {
  name             = "nisar-pro"
  chart            = "${path.module}/../../helm/nisar-pro"
  namespace        = "nisar-pro"
  create_namespace = true
  values = [yamlencode({
    image       = { tag = var.image_tag, pullPolicy = "Always" }
    gateway     = { replicas = 2 }
    queue       = { enabled = true }
    earthdata   = { token = var.earthdata_token }
    persistence = { accessModes = ["ReadWriteMany"], storageClass = "efs-sc", size = "200Gi" }
    worker = {
      mode         = "keda"
      maxReplicas  = var.engine_max_nodes
      nodeSelector = { "nisar-pro/pool" = "engine" }
      tolerations  = [{ key = "nisar-pro/engine", operator = "Equal", value = "true", effect = "NoSchedule" }]
    }
  })]
  depends_on = [helm_release.keda, helm_release.efs_storage_class]
}

# ── Cluster Autoscaler: adds engine nodes when KEDA starts worker Jobs, removes them after ──
resource "aws_iam_role" "autoscaler" {
  name = "${var.name}-cluster-autoscaler"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "pods.eks.amazonaws.com" }
      Action    = ["sts:AssumeRole", "sts:TagSession"]
    }]
  })
}

resource "aws_iam_role_policy" "autoscaler" {
  role = aws_iam_role.autoscaler.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "autoscaling:DescribeAutoScalingGroups", "autoscaling:DescribeAutoScalingInstances",
          "autoscaling:DescribeLaunchConfigurations", "autoscaling:DescribeScalingActivities",
          "autoscaling:DescribeTags", "ec2:DescribeImages", "ec2:DescribeInstanceTypes",
          "ec2:DescribeLaunchTemplateVersions", "ec2:GetInstanceTypesFromInstanceRequirements",
          "eks:DescribeNodegroup",
        ]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["autoscaling:SetDesiredCapacity", "autoscaling:TerminateInstanceInAutoScalingGroup"]
        Resource = "*"
        Condition = {
          StringEquals = { "aws:ResourceTag/k8s.io/cluster-autoscaler/${var.name}" = "owned" }
        }
      },
    ]
  })
}

resource "aws_eks_pod_identity_association" "autoscaler" {
  cluster_name    = module.eks.cluster_name
  namespace       = "kube-system"
  service_account = "cluster-autoscaler"
  role_arn        = aws_iam_role.autoscaler.arn
}

resource "helm_release" "cluster_autoscaler" {
  name       = "cluster-autoscaler"
  repository = "https://kubernetes.github.io/autoscaler"
  chart      = "cluster-autoscaler"
  version    = "9.43.2"
  namespace  = "kube-system"
  values = [yamlencode({
    awsRegion     = var.region
    autoDiscovery = { clusterName = module.eks.cluster_name }
    rbac          = { serviceAccount = { name = "cluster-autoscaler" } }
    extraArgs     = { "scale-down-unneeded-time" = "5m", "balance-similar-node-groups" = true }
  })]
  depends_on = [aws_eks_pod_identity_association.autoscaler]
}
