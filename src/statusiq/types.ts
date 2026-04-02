export interface StatusIQIncidentOutage {
  start_time?: string;
  end_time?: string;
  ongoing?: boolean;
  status?: number;
  severity?: number;
  associated_incident_info?: {
    enc_inc_id?: string;
    inc_title?: string;
  };
}

export interface StatusHistoryDay {
  date?: string;
  outage_list?: StatusIQIncidentOutage[];
}

export interface StatusHistoryComponent {
  display_name?: string;
  componentgroup_display_name?: string;
  status_history?: {
    day_wise_status_history?: StatusHistoryDay[];
  };
  componentgroup_components?: StatusHistoryComponent[];
}

export interface StatusHistoryResponse {
  code?: number;
  message?: string;
  data?: {
    resource_list?: StatusHistoryComponent[];
  };
}

/** Neutral incident window — no Grafana types */
export interface IncidentWindow {
  startMs: number;
  endMs: number;
  ongoing: boolean;
  component: string;
  title: string;
  statusCode: number;
  statusLabel: string;
  incidentEncId: string;
}
