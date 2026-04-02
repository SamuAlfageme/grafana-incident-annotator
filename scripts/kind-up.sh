#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME="grafana-statusiq"
KIND_CONFIG="deploy/kind/kind-config.yaml"
GRAFANA_IMAGE="grafana-statusiq:local"
GRAFANA_MANIFEST="deploy/kind/grafana/grafana.yaml"

if ! command -v kind >/dev/null 2>&1; then
  echo "kind is required. Install: https://kind.sigs.k8s.io/"
  exit 1
fi

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl is required."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required."
  exit 1
fi

echo "Building plugin bundle..."
npm run build

echo "Building Grafana image with plugin..."
docker buildx build --load -t "${GRAFANA_IMAGE}" -f deploy/kind/grafana/Dockerfile .

if ! docker image inspect "${GRAFANA_IMAGE}" >/dev/null 2>&1; then
  echo "Failed to load ${GRAFANA_IMAGE} into local Docker image store."
  echo "If you use Buildx, ensure --load is supported by your builder."
  exit 1
fi

if ! kind get clusters | grep -q "^${CLUSTER_NAME}$"; then
  echo "Creating kind cluster: ${CLUSTER_NAME}"
  kind create cluster --name "${CLUSTER_NAME}" --config "${KIND_CONFIG}"
else
  echo "Reusing existing kind cluster: ${CLUSTER_NAME}"
fi

echo "Loading image into kind..."
kind load docker-image "${GRAFANA_IMAGE}" --name "${CLUSTER_NAME}"

echo "Applying Grafana manifests..."
kubectl apply -f "${GRAFANA_MANIFEST}"

echo "Waiting for Grafana rollout..."
kubectl -n observability rollout status deployment/grafana --timeout=180s

echo ""
echo "Grafana is ready:"
echo "  URL:      http://localhost:3000"
echo "  User:     admin"
echo "  Password: admin"
echo ""
echo "Start local mock datasource API in another shell if needed:"
echo "  npm run mock:statusiq"
