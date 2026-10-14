import { DataQuery, DataSourceJsonData } from '@grafana/data';

export interface StatusIQQuery extends DataQuery {
  queryText?: string;
  includeResolved?: boolean;
  limit?: number;
}

export interface StatusIQDataSourceOptions extends DataSourceJsonData {
  pageUrl?: string;
  encodedStatusPageId?: string;
  timezone?: string;
  maxPages?: number;
  useZohoApi?: boolean;
  zohoAccountsBaseUrl?: string;
  zohoClientId?: string;
}

export interface StatusIQSecureOptions {
  zohoClientSecret?: string;
  zohoRefreshToken?: string;
}

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
