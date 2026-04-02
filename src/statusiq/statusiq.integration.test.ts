/**
 * Live HTTP checks against a real StatusIQ host.
 *
 * Run locally:
 *   STATUSIQ_INTEGRATION_URL=https://status.cloud.switch.ch \
 *   STATUSIQ_INTEGRATION_ENCODED_ID=-fIX8sNu-ilFX5UtJzmCzRoWA9Mb89Oct4U5DiVXdUw= \
 *   STATUSIQ_INTEGRATION_TIMEZONE=Europe/Zurich \
 *   npm run test:statusiq
 *
 * Omit env vars to skip (CI-safe).
 */

import { fetchIncidentWindows, resolveEncodedStatusPageId } from './fetchIncidents';
import { parseEncodedStatusPageIdFromHtml } from './parseHtml';
import { defaultStatusiqResolveUrl } from './urls';

const baseUrl = process.env.STATUSIQ_INTEGRATION_URL?.trim();
const configuredId = process.env.STATUSIQ_INTEGRATION_ENCODED_ID?.trim();
const timezone = process.env.STATUSIQ_INTEGRATION_TIMEZONE?.trim() || 'UTC';

const runIntegration = Boolean(baseUrl);

(runIntegration ? describe : describe.skip)('StatusIQ integration (STATUSIQ_INTEGRATION_URL)', () => {
  const fetchText = (url: string) =>
    fetch(url, { headers: { Accept: 'text/html' } }).then((r) => {
      if (!r.ok) {
        throw new Error(`GET ${url} -> ${r.status} ${r.statusText}`);
      }
      return r.text();
    });

  const fetchJson = (url: string) =>
    fetch(url, { headers: { Accept: 'application/json' } }).then((r) => {
      if (!r.ok) {
        throw new Error(`GET ${url} -> ${r.status} ${r.statusText}`);
      }
      return r.json() as Promise<unknown>;
    });

  it('home HTML contains enc_statuspage_id or legacy encodedStatuspageId', async () => {
    const html = await fetchText(`${baseUrl!.replace(/\/+$/, '')}/`);
    const id = parseEncodedStatusPageIdFromHtml(html);
    expect(id).toBeTruthy();
    expect(id!.length).toBeGreaterThan(10);
  });

  it('resolveEncodedStatusPageId discovers id from home HTML', async () => {
    const discovered = await resolveEncodedStatusPageId({
      fetchText,
      resolveUrl: (p) => defaultStatusiqResolveUrl(baseUrl!, p),
    });
    expect(discovered).toBeTruthy();
    expect(discovered!.length).toBeGreaterThan(10);
  });

  it('status_history returns code 0 and resource_list array', async () => {
    const id =
      configuredId ||
      (await resolveEncodedStatusPageId({
        fetchText,
        resolveUrl: (p) => defaultStatusiqResolveUrl(baseUrl!, p),
      }));

    const windows = await fetchIncidentWindows({
      resolveUrl: (p) => defaultStatusiqResolveUrl(baseUrl!, p),
      configuredEncodedId: id,
      timezone,
      maxPages: 1,
      fromMs: 0,
      toMs: Date.now(),
      includeResolved: true,
      limit: 50,
      fetchText,
      fetchJson,
    });

    expect(Array.isArray(windows)).toBe(true);
  }, 30_000);
});
