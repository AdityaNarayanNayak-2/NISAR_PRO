#!/bin/bash

echo "=========================================="
echo "   SAR Analyzer - Secret Setup Helper"
echo "=========================================="
echo ""
echo "This script will help you configure the 'regcred' secret"
echo "so your cluster can pull images from GitLab."
echo ""

read -p "Enter your GitLab Username: " GITLAB_USER
read -s -p "Enter your GitLab Password (or Access Token): " GITLAB_PASS
echo ""
read -p "Enter your Email: " GITLAB_EMAIL

echo ""
echo "Creating secret..."

kubectl create secret docker-registry regcred \
  --docker-server=registry.gitlab.com \
  --docker-username="$GITLAB_USER" \
  --docker-password="$GITLAB_PASS" \
  --docker-email="$GITLAB_EMAIL" \
  --dry-run=client -o yaml | kubectl apply -f -

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Secret 'regcred' created successfully!"
else
    echo ""
    echo "❌ Failed to create secret. Please check your inputs."
fi
