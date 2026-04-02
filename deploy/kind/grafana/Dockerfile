FROM grafana/grafana-oss:11.1.0

# Bundle the locally-built plugin into Grafana image
COPY dist /var/lib/grafana/plugins/statusiq-incident-annotations-datasource
COPY img /var/lib/grafana/plugins/statusiq-incident-annotations-datasource/img
