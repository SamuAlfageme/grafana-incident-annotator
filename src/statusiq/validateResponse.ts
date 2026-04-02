import type { StatusHistoryResponse } from './types';

export function isStatusHistoryResponse(body: unknown): body is StatusHistoryResponse {
  return typeof body === 'object' && body !== null;
}

export function assertStatusHistoryOk(body: unknown): asserts body is StatusHistoryResponse {
  if (!isStatusHistoryResponse(body)) {
    throw new Error('Status history response is not a JSON object.');
  }
  if (typeof body.code === 'number' && body.code !== 0) {
    throw new Error(body.message || `StatusIQ API returned code ${body.code}`);
  }
}

export function looksLikeHtmlDocument(s: string): boolean {
  return (
    /<\s*!DOCTYPE\b/i.test(s) ||
    /<\s*html\b/i.test(s) ||
    (/<\s*head\b/i.test(s) && /<\s*title\b/i.test(s))
  );
}

export function rejectIfHtmlPayload(data: unknown): void {
  if (typeof data === 'string' && looksLikeHtmlDocument(data)) {
    throw new Error(
      'Received HTML instead of JSON (wrong API URL, proxy, or HTTP error page). Use the status site origin for the datasource URL if the page URL includes a path; verify Encoded Status Page ID and access mode.'
    );
  }
}
