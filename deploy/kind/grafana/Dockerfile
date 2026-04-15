FROM grafana/grafana-oss:13.0.0

# Bundle the locally-built plugin into Grafana image
COPY dist /var/lib/grafana/plugins/statusiq-incident-annotations-datasource
COPY img /var/lib/grafana/plugins/statusiq-incident-annotations-datasource/img

# File-provisioned dashboards (see deploy/kind/grafana/dashboards/jsonnet/)
COPY deploy/kind/grafana/provisioning/dashboards/dashboards.yaml /etc/grafana/provisioning/dashboards/dashboards.yaml
COPY deploy/kind/grafana/dashboards/generated /var/lib/grafana/dashboards/statusiq
