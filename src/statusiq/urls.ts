export function normalizeStatusPageBaseUrl(url: string): string {
  const t = url.trim();
  if (!t) {
    throw new Error('Status page base URL is required.');
  }
  return t.replace(/\/+$/, '');
}

/**
 * StatusIQ serves `/sp/api/public/...` at the site origin. The status page HTML may live under a
 * path (e.g. a bookmarked URL), but the public API path must not inherit that prefix or requests
 * 404 with an HTML error page.
 */
export function statusHistoryApiBaseUrl(pageBaseUrl: string): string {
  const normalized = normalizeStatusPageBaseUrl(pageBaseUrl);
  let u: URL;
  try {
    u = new URL(normalized);
  } catch {
    throw new Error(`Invalid status page URL: "${pageBaseUrl}". Use a full URL (https://…).`);
  }
  if (!u.hostname) {
    throw new Error(`Invalid status page URL: "${pageBaseUrl}". Hostname is missing.`);
  }
  return u.origin;
}

export function toAbsoluteUrl(baseUrl: string, path: string): string {
  const base = normalizeStatusPageBaseUrl(baseUrl);
  const trimmed = path.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const p = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${base}${p}`;
}

/**
 * Path must use the raw encoded id (trailing `=` must not be encoded as %3D).
 */
export function buildStatusHistoryPath(encodedStatusPageId: string, timezone: string, page: number): string {
  const id = encodedStatusPageId.trim();
  if (!id || /[?#]/.test(id)) {
    throw new Error('Invalid encoded status page ID (must be non-empty and not contain ? or #).');
  }
  const tz = encodeURIComponent(timezone);
  return `/sp/api/public/status_history/${id}?timezone=${tz}&period=27&page=${page}`;
}

export function buildStatusHistoryUrl(baseUrl: string, encodedStatusPageId: string, timezone: string, page: number): string {
  return toAbsoluteUrl(baseUrl, buildStatusHistoryPath(encodedStatusPageId, timezone, page));
}

/**
 * Resolve a path for tests and non-Grafana callers: `/` = status home, `/sp/...` = API at host origin.
 */
export function defaultStatusiqResolveUrl(pageBaseUrl: string, path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  const prefix = normalizeStatusPageBaseUrl(pageBaseUrl);
  if (p === '/') {
    return toAbsoluteUrl(prefix, '/');
  }
  if (p.startsWith('/sp/')) {
    return statusHistoryApiBaseUrl(prefix) + p;
  }
  return toAbsoluteUrl(prefix, p);
}
