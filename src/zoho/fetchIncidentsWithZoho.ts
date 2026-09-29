import { ZohoOAuthClient, StatusIQApiClient } from './index';
import { extractIncidentWindows } from '../statusiq/extractIncidents';
import { parseEncodedStatusPageIdFromHtml } from '../statusiq/parseHtml';
import type { IncidentWindow, StatusHistoryResponse } from '../statusiq/types';
import { assertStatusHistoryOk, rejectIfHtmlPayload } from '../statusiq/validateResponse';
import type { StatusIQFetchText } from '../statusiq/fetchIncidents';

export interface FetchIncidentWindowsWithZohoParams {
  configuredEncodedId?: string;
  timezone: string;
  maxPages: number;
  fromMs: number;
  toMs: number;
  queryText?: string;
  includeResolved: boolean;
  limit?: number;
  nowMs?: number;
  zohoAccountsBaseUrl: string;
  zohoClientId: string;
  zohoClientSecret: string;
  zohoRefreshToken: string;
  fetchText: StatusIQFetchText;
  resolveUrl: (path: string) => string;
}

export async function fetchIncidentWindowsWithZoho(
  params: FetchIncidentWindowsWithZohoParams
): Promise<IncidentWindow[]> {
  const {
    configuredEncodedId,
    timezone,
    maxPages,
    fromMs,
    toMs,
    queryText,
    includeResolved,
    zohoAccountsBaseUrl,
    zohoClientId,
    zohoClientSecret,
    zohoRefreshToken,
    fetchText,
    resolveUrl,
  } = params;
  const nowMs = params.nowMs ?? Date.now();

  let encodedId = configuredEncodedId?.trim();
  if (!encodedId) {
    const html = await fetchText(resolveUrl('/'));
    const matched = parseEncodedStatusPageIdFromHtml(html);
    if (!matched) {
      throw new Error(
        'Unable to discover encoded status page ID from the status page HTML. View page source for enc_statuspage_id / encodedStatuspageId, or copy the id from a /sp/api/public/statuspages/logo/… or favicon/… URL, then paste it into Encoded Status Page ID in datasource settings.'
      );
    }
    encodedId = matched;
  }

  const oauthClient = new ZohoOAuthClient({
    clientId: zohoClientId,
    clientSecret: zohoClientSecret,
    refreshToken: zohoRefreshToken,
    accountsBaseUrl: zohoAccountsBaseUrl,
  });

  const apiClient = new StatusIQApiClient({ oauthClient });

  const seen = new Set<string>();
  const all: IncidentWindow[] = [];
  const limit = params.limit;

  for (let page = 1; page <= maxPages; page++) {
    const body: StatusHistoryResponse = await apiClient.getStatusHistory(encodedId, timezone, page);
    rejectIfHtmlPayload(body);
    assertStatusHistoryOk(body);

    const list = body.data?.resource_list || [];
    const windows = extractIncidentWindows(list, { fromMs, toMs, queryText, includeResolved, nowMs }, seen);

    for (const w of windows) {
      all.push(w);
      if (limit !== undefined && all.length >= limit) {
        return all.sort((a, b) => a.startMs - b.startMs);
      }
    }
  }

  return all.sort((a, b) => a.startMs - b.startMs);
}
