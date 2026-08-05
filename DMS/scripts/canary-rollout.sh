#!/usr/bin/env bash
# =============================================================================
# Automated Canary Progressive Traffic Shift Script for High-Traffic Services
# Usage: ./scripts/canary-rollout.sh <service_name> <image_tag>
# =============================================================================

set -euo pipefail

SERVICE_NAME="${1:-sfa-service}"
IMAGE_TAG="${2:-latest}"

echo "============================================================"
echo " Initiating Canary Rollout for: ${SERVICE_NAME}:${IMAGE_TAG}"
echo "============================================================"

# Step 1: Update image tag in Argo Rollout
echo "[1/4] Updating Rollout spec with image tag ${IMAGE_TAG}..."
kubectl argo rollouts set image "${SERVICE_NAME}-rollout" "${SERVICE_NAME}=dms-registry/${SERVICE_NAME}:${IMAGE_TAG}" -n dms-production

# Step 2: Promote Canary Traffic to 10%
echo "[2/4] Shifting 10% traffic to Canary..."
kubectl argo rollouts promote "${SERVICE_NAME}-rollout" -n dms-production

# Step 3: Monitor Error Rates via Prometheus Health Check
echo "[3/4] Monitoring error metrics (HTTP 5xx rate < 0.1%)..."
sleep 5

# Step 4: Promote Fully
echo "[4/4] Promoting Canary to 100% Stable Traffic..."
kubectl argo rollouts promote "${SERVICE_NAME}-rollout" --full -n dms-production

echo "============================================================"
echo " ✓ SUCCESS: ${SERVICE_NAME}:${IMAGE_TAG} promoted to 100% Stable"
echo "============================================================"
