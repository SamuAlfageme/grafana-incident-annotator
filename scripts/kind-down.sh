#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME="grafana-statusiq"

if ! command -v kind >/dev/null 2>&1; then
  echo "kind is required."
  exit 1
fi

if kind get clusters | grep -q "^${CLUSTER_NAME}$"; then
  kind delete cluster --name "${CLUSTER_NAME}"
  echo "Deleted cluster ${CLUSTER_NAME}"
else
  echo "Cluster ${CLUSTER_NAME} does not exist."
fi
