#!/usr/bin/env bash
# Rebuild Grafonnet dashboards into deploy/kind/grafana/dashboards/generated/
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JSONNET_DIR="${ROOT}/deploy/kind/grafana/dashboards/jsonnet"
OUT_DIR="${ROOT}/deploy/kind/grafana/dashboards/generated"
VENDOR="${JSONNET_DIR}/vendor"

if ! command -v jb >/dev/null 2>&1; then
  echo "jsonnet-bundler (jb) not found; skipping dashboard render. Install: https://github.com/jsonnet-bundler/jsonnet-bundler"
  echo "Using committed JSON under ${OUT_DIR} if present."
  exit 0
fi

if ! command -v jsonnet >/dev/null 2>&1; then
  echo "jsonnet not found; skipping dashboard render. Install go-jsonnet: go install github.com/google/go-jsonnet/cmd/jsonnet@latest"
  echo "Using committed JSON under ${OUT_DIR} if present."
  exit 0
fi

mkdir -p "${OUT_DIR}"
(cd "${JSONNET_DIR}" && jb install)

jsonnet -J "${VENDOR}" "${JSONNET_DIR}/statusiq-demo.jsonnet" > "${OUT_DIR}/statusiq-demo.json"
echo "Wrote ${OUT_DIR}/statusiq-demo.json"
