import { extractIncidentWindows } from './extractIncidents';
import { parseEncodedStatusPageIdFromHtml } from './parseHtml';
import { buildStatusHistoryPath } from './urls';
import type { IncidentWindow, StatusHistoryResponse } from './types';
import { assertStatusHistoryOk, rejectIfHtmlPayload } from './validateResponse';

export type StatusIQFetchText = (url: string) => Promise<string>;
export type StatusIQFetchJson = (url: string) => Promise<unknown>;

export async function resolveEncodedStatusPageId(options: {
  configuredEncodedId?: string;
  fetchText: StatusIQFetchText;
  resolveUrl: (path: string) => string;
}): Promise<string> {
  const configured = options.configuredEncodedId?.trim();
  if (configured) {
    return configured;
  }

  const html = await options.fetchText(options.resolveUrl('/'));
  const matched = parseEncodedStatusPageIdFromHtml(html);
  if (!matched) {
    throw new Error(
      'Unable to discover encoded status page ID from the status home page HTML. View page source for enc_statuspage_id / encodedStatuspageId, or copy the id from a /sp/api/public/statuspages/logo/… or favicon/… URL, then paste it into Encoded Status Page ID in datasource settings.'
    );
  }
  return matched;
}

export interface FetchIncidentWindowsParams {
  configuredEncodedId?: string;
  timezone: string;
  maxPages: number;
  fromMs: number;
  toMs: number;
  queryText?: string;
  includeResolved: boolean;
  /** Stop after this many incidents (optional). */
  limit?: number;
  /** Defaults to Date.now() */
  nowMs?: number;
  /** Path always starts with `/` (e.g. `/`, `/sp/api/public/status_history/...`). */
  resolveUrl: (path: string) => string;
  fetchText: StatusIQFetchText;
  fetchJson: StatusIQFetchJson;
}

/**
 * Full pipeline: resolve id (optional), page status_history API, extract incidents.
 * Decoupled from Grafana — pass `fetch` implementations (e.g. global fetch or mocks).
 */
export async function fetchIncidentWindows(params: FetchIncidentWindowsParams): Promise<IncidentWindow[]> {
  const {
    configuredEncodedId,
    timezone,
    maxPages,
    fromMs,
    toMs,
    queryText,
    includeResolved,
    resolveUrl,
    fetchText,
    fetchJson,
  } = params;
  const nowMs = params.nowMs ?? Date.now();

  const encodedId = await resolveEncodedStatusPageId({
    configuredEncodedId,
    fetchText,
    resolveUrl,
  });

  const seen = new Set<string>();
  const all: IncidentWindow[] = [];
  const limit = params.limit;

  for (let page = 1; page <= maxPages; page++) {
    const path = buildStatusHistoryPath(encodedId, timezone, page);
    const url = resolveUrl(path);
    const raw = await fetchJson(url);
    rejectIfHtmlPayload(raw);
    assertStatusHistoryOk(raw);
    const body = raw as StatusHistoryResponse;
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
