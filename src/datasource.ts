import {
  AnnotationQuery,
  AnnotationEvent,
  AnnotationQueryRequest,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  FieldType,
  MutableDataFrame,
} from '@grafana/data';
import { getBackendSrv, isFetchError } from '@grafana/runtime';
import { StatusIQDataSourceOptions, StatusIQQuery, StatusIQSecureOptions } from './types';
import { AnnotationQueryEditor } from './components/AnnotationQueryEditor';
import { fetchIncidentWindows } from './statusiq/fetchIncidents';
import { fetchIncidentWindowsWithZoho } from './zoho/fetchIncidentsWithZoho';
import type { IncidentWindow } from './statusiq/types';
import { statusHistoryApiBaseUrl, toAbsoluteUrl } from './statusiq/urls';
import { looksLikeHtmlDocument, rejectIfHtmlPayload } from './statusiq/validateResponse';

function incidentToAnnotation(w: IncidentWindow): AnnotationEvent {
  return {
    time: w.startMs,
    timeEnd: w.endMs,
    isRegion: true,
    text: `${w.title} (${w.component})`,
    tags: ['statusiq', w.statusLabel, w.component, w.ongoing ? 'ongoing' : 'resolved'],
  };
}

export class DataSource extends DataSourceApi<StatusIQQuery, StatusIQDataSourceOptions> {
  private readonly instanceSettings: DataSourceInstanceSettings<StatusIQDataSourceOptions, StatusIQSecureOptions>;
  annotations = {
    QueryEditor: AnnotationQueryEditor,
    getDefaultQuery: (): Partial<StatusIQQuery> => ({
      refId: 'AnnoA',
      includeResolved: true,
      queryText: '',
    }),
    prepareQuery: (anno: AnnotationQuery<StatusIQQuery>): StatusIQQuery => {
      const target = (anno.target ?? {}) as StatusIQQuery;
      return {
        refId: target.refId ?? 'AnnoA',
        includeResolved: target.includeResolved ?? true,
        queryText: target.queryText ?? '',
      };
    },
  };

  constructor(instanceSettings: DataSourceInstanceSettings<StatusIQDataSourceOptions, StatusIQSecureOptions>) {
    super(instanceSettings);
    this.instanceSettings = instanceSettings;
  }

  async query(_request: DataQueryRequest<StatusIQQuery>): Promise<DataQueryResponse> {
    const data: MutableDataFrame[] = [];
    const timezone = this.instanceSettings.jsonData.timezone || 'UTC';
    const maxPages = this.instanceSettings.jsonData.maxPages || 5;

    for (const target of _request.targets) {
      const queryText = (target.queryText ?? '').trim().toLowerCase();
      const includeResolved = target.includeResolved ?? true;
      const limit =
        target.limit !== undefined ? Math.max(1, Math.min(target.limit, 5000)) : undefined;

      const windows = await this.fetchIncidents({
        fromMs: _request.range.from.valueOf(),
        toMs: _request.range.to.valueOf(),
        queryText,
        includeResolved,
        limit,
        timezone,
        maxPages,
      });

      // Same frame shape for panel queries and for dashboard annotations (prepareQuery → query).
      const frame = new MutableDataFrame({
        refId: target.refId,
        name: 'statusiq_incidents',
        fields: [
          { name: 'time', type: FieldType.time },
          { name: 'timeEnd', type: FieldType.time },
          { name: 'text', type: FieldType.string },
          { name: 'tags', type: FieldType.string },
        ],
      });

      for (const w of windows) {
        const tags = ['statusiq', w.statusLabel, w.component, w.ongoing ? 'ongoing' : 'resolved'];
        frame.add({
          time: w.startMs,
          timeEnd: w.endMs,
          text: `${w.title} (${w.component})`,
          tags: tags.join(','),
        });
      }

      data.push(frame);
    }

    return { data };
  }

  async testDatasource() {
    const tz = this.instanceSettings.jsonData.timezone || 'UTC';

    try {
      await this.fetchIncidents({
        fromMs: 0,
        toMs: Date.now(),
        includeResolved: true,
        timezone: tz,
        maxPages: 1,
      });

      const apiType = this.instanceSettings.jsonData.useZohoApi ? 'Zoho OAuth API' : 'public API';
      return {
        status: 'success',
        message: `StatusIQ ${apiType} reached successfully.`,
      };
    } catch (error) {
      const msg = this.errorMessage(error);
      const discoverHint =
        /discover|encoded status page|Unable to discover|status page HTML/i.test(msg) ||
        /Could not load status page/i.test(msg);
      if (discoverHint) {
        return { status: 'error', message: `Could not load status page or discover ID: ${msg}` };
      }
      return { status: 'error', message: `Status history API failed: ${msg}` };
    }
  }

  async annotationQuery(options: AnnotationQueryRequest<StatusIQQuery>): Promise<AnnotationEvent[]> {
    const target = (options.annotation.target ?? {}) as StatusIQQuery;
    const queryText = (target.queryText ?? options.annotation.query ?? '').trim().toLowerCase();
    const includeResolved = target.includeResolved ?? true;
    const timezone = this.instanceSettings.jsonData.timezone || 'UTC';
    const maxPages = this.instanceSettings.jsonData.maxPages || 5;

    const windows = await this.fetchIncidents({
      fromMs: options.range.from.valueOf(),
      toMs: options.range.to.valueOf(),
      queryText,
      includeResolved,
      timezone,
      maxPages,
    });

    return windows.map(incidentToAnnotation);
  }

  private async fetchIncidents(params: {
    fromMs: number;
    toMs: number;
    queryText?: string;
    includeResolved: boolean;
    limit?: number;
    timezone: string;
    maxPages: number;
    nowMs?: number;
  }): Promise<IncidentWindow[]> {
    const useZohoApi = this.instanceSettings.jsonData.useZohoApi || false;

    if (useZohoApi) {
      const secureData = this.instanceSettings.secureJsonData;
      const zohoAccountsBaseUrl = this.instanceSettings.jsonData.zohoAccountsBaseUrl;
      const zohoClientId = this.instanceSettings.jsonData.zohoClientId;
      const zohoClientSecret = secureData?.zohoClientSecret;
      const zohoRefreshToken = secureData?.zohoRefreshToken;

      if (!zohoAccountsBaseUrl || !zohoClientId || !zohoClientSecret || !zohoRefreshToken) {
        throw new Error(
          'Zoho API enabled but credentials incomplete. Please configure Zoho Accounts Base URL, Client ID, Client Secret, and Refresh Token.'
        );
      }

      return await fetchIncidentWindowsWithZoho({
        configuredEncodedId: this.instanceSettings.jsonData.encodedStatusPageId,
        timezone: params.timezone,
        maxPages: params.maxPages,
        fromMs: params.fromMs,
        toMs: params.toMs,
        queryText: params.queryText,
        includeResolved: params.includeResolved,
        limit: params.limit,
        nowMs: params.nowMs,
        zohoAccountsBaseUrl,
        zohoClientId,
        zohoClientSecret,
        zohoRefreshToken,
        fetchText: (u) => this.getText(u),
        resolveUrl: (p) => this.resolveOutgoingUrl(p),
      });
    }

    return await fetchIncidentWindows({
      configuredEncodedId: this.instanceSettings.jsonData.encodedStatusPageId,
      timezone: params.timezone,
      maxPages: params.maxPages,
      fromMs: params.fromMs,
      toMs: params.toMs,
      queryText: params.queryText,
      includeResolved: params.includeResolved,
      limit: params.limit,
      nowMs: params.nowMs,
      resolveUrl: (p) => this.resolveOutgoingUrl(p),
      fetchText: (u) => this.getText(u),
      fetchJson: (u) => this.getJsonUnknown(u),
    });
  }

  /**
   * Grafana stores either the real status URL (Browser access) or the data-proxy prefix (Server access).
   * StatusIQ HTML and `/sp/api/...` must be requested through that prefix so the proxy can forward them.
   */
  private getRequestUrlPrefix(): string {
    const url = this.instanceSettings.url || this.instanceSettings.jsonData.pageUrl;
    if (!url?.trim()) {
      throw new Error('Datasource URL is required (set it to your public StatusIQ page URL).');
    }
    return url.trim().replace(/\/+$/, '');
  }

  private resolveOutgoingUrl(path: string): string {
    const p = path.startsWith('/') ? path : `/${path}`;
    const prefix = this.getRequestUrlPrefix();
    const viaGrafanaProxy =
      this.instanceSettings.access === 'proxy' || /\/api\/datasources\/proxy\//.test(prefix);

    if (viaGrafanaProxy) {
      return `${prefix}${p}`;
    }

    if (p === '/') {
      return toAbsoluteUrl(prefix, '/');
    }
    if (p.startsWith('/sp/')) {
      return statusHistoryApiBaseUrl(prefix) + p;
    }
    return toAbsoluteUrl(prefix, p);
  }

  private defaultRequestHeaders(): Record<string, string> {
    return {
      Accept: 'application/json, text/html;q=0.9, */*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (compatible; GrafanaStatusIQAnnotations/0.1)',
    };
  }

  private async getJsonUnknown(url: string): Promise<unknown> {
    return await new Promise<unknown>((resolve, reject) => {
      let settled = false;
      const subscription = getBackendSrv()
        .fetch<unknown>({
          url,
          method: 'GET',
          headers: this.defaultRequestHeaders(),
          showErrorAlert: false,
        })
        .subscribe({
          next: (response) => {
            if (!settled) {
              settled = true;
              try {
                rejectIfHtmlPayload(response.data);
                resolve(response.data);
              } catch (e) {
                reject(e);
              }
              subscription.unsubscribe();
            }
          },
          error: (error) => {
            if (!settled) {
              settled = true;
              reject(error);
            }
          },
        });
    });
  }

  private async getText(url: string): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
      let settled = false;
      const subscription = getBackendSrv()
        .fetch<string>({
          url,
          method: 'GET',
          responseType: 'text',
          headers: this.defaultRequestHeaders(),
          showErrorAlert: false,
        })
        .subscribe({
          next: (response) => {
            if (!settled) {
              settled = true;
              resolve(response.data);
              subscription.unsubscribe();
            }
          },
          error: (error) => {
            if (!settled) {
              settled = true;
              reject(error);
            }
          },
        });
    });
  }

  private errorMessage(error: unknown): string {
    if (isFetchError(error)) {
      const rawData = error.data;
      if (typeof rawData === 'string' && looksLikeHtmlDocument(rawData)) {
        const hint =
          error.status === 404
            ? ' Often caused by a wrong Encoded Status Page ID, or (Browser access) a status URL with a path—API calls use the host origin only. With Server access, the data source URL must be the Grafana proxy path; save and test again after upgrading the plugin.'
            : '';
        return `HTTP ${error.status}: StatusIQ returned an HTML error page instead of JSON (not the public API response).${hint} ${error.message ?? ''}`.trim();
      }
      const data = rawData as Record<string, unknown> | undefined;
      const fromData =
        (typeof data?.message === 'string' && data.message) ||
        (typeof data?.error === 'string' && data.error) ||
        (data?.error &&
          typeof data.error === 'object' &&
          data.error !== null &&
          'message' in data.error &&
          typeof (data.error as { message?: string }).message === 'string' &&
          (data.error as { message: string }).message);
      const statusPart =
        typeof error.status === 'number'
          ? `HTTP ${error.status}${error.statusText ? ` ${error.statusText}` : ''}`
          : undefined;
      return [error.message, fromData, statusPart].filter(Boolean).join(' — ') || 'Request failed';
    }
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return 'unknown error';
    }
  }
}
