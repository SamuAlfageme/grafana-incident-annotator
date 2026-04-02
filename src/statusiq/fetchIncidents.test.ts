import { fetchIncidentWindows, resolveEncodedStatusPageId } from './fetchIncidents';
import { defaultStatusiqResolveUrl } from './urls';

describe('resolveEncodedStatusPageId', () => {
  it('uses configured id when set', async () => {
    await expect(
      resolveEncodedStatusPageId({
        configuredEncodedId: '  my-id=  ',
        fetchText: async () => {
          throw new Error('should not fetch');
        },
        resolveUrl: () => {
          throw new Error('should not resolve');
        },
      })
    ).resolves.toBe('my-id=');
  });

  it('parses HTML when not configured', async () => {
    await expect(
      resolveEncodedStatusPageId({
        fetchText: async (url) => {
          expect(url).toBe('https://example.com/');
          return '<script>"enc_statuspage_id":"parsed="</script>';
        },
        resolveUrl: (p) => defaultStatusiqResolveUrl('https://example.com', p),
      })
    ).resolves.toBe('parsed=');
  });
});

describe('fetchIncidentWindows', () => {
  const resolveDemo = (p: string) => defaultStatusiqResolveUrl('https://status.example.com', p);

  it('fetches pages and extracts incidents with mocked HTTP', async () => {
    const body = {
      code: 0,
      message: 'success',
      data: {
        resource_list: [
          {
            display_name: 'Svc',
            status_history: {
              day_wise_status_history: [
                {
                  outage_list: [
                    {
                      start_time: '2026-06-01T12:00:00+0000',
                      end_time: '2026-06-01T13:00:00+0000',
                      ongoing: false,
                      status: 6,
                      associated_incident_info: { enc_inc_id: 'x', inc_title: 'Down' },
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    };

    const fetchText = jest.fn(async () => {
      throw new Error('no HTML needed when id configured');
    });
    const fetchJson = jest.fn(async (url: string) => {
      expect(url).toContain('/sp/api/public/status_history/myEnc=');
      expect(url).not.toContain('%3D');
      return body;
    });

    const windows = await fetchIncidentWindows({
      resolveUrl: resolveDemo,
      configuredEncodedId: 'myEnc=',
      timezone: 'UTC',
      maxPages: 1,
      fromMs: new Date('2026-06-01T11:00:00Z').getTime(),
      toMs: new Date('2026-06-01T14:00:00Z').getTime(),
      includeResolved: true,
      nowMs: new Date('2026-06-01T14:00:00Z').getTime(),
      fetchText,
      fetchJson,
    });

    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(windows).toHaveLength(1);
    expect(windows[0].title).toBe('Down');
    expect(windows[0].statusLabel).toBe('major_outage');
  });

  it('requests status_history at host origin when the configured URL includes a path', async () => {
    const body = { code: 0, message: 'success', data: { resource_list: [] } };
    const fetchJson = jest.fn(async (url: string) => {
      expect(url).toMatch(/^https:\/\/status\.example\.com\/sp\/api\/public\/status_history\//);
      expect(url).not.toContain('/deep/path');
      return body;
    });

    await fetchIncidentWindows({
      resolveUrl: (p) => defaultStatusiqResolveUrl('https://status.example.com/deep/path', p),
      configuredEncodedId: 'id=',
      timezone: 'UTC',
      maxPages: 1,
      fromMs: 0,
      toMs: Date.now(),
      includeResolved: true,
      fetchText: async () => {
        throw new Error('no HTML when id configured');
      },
      fetchJson,
    });

    expect(fetchJson).toHaveBeenCalled();
  });

  it('supports Grafana data-proxy style prefixes (Server access)', async () => {
    const body = { code: 0, message: 'success', data: { resource_list: [] } };
    const fetchJson = jest.fn(async (url: string) => {
      expect(url).toBe(
        '/api/datasources/proxy/uid-demo/sp/api/public/status_history/id=?timezone=UTC&period=27&page=1'
      );
      return body;
    });

    await fetchIncidentWindows({
      resolveUrl: (p) => '/api/datasources/proxy/uid-demo' + p,
      configuredEncodedId: 'id=',
      timezone: 'UTC',
      maxPages: 1,
      fromMs: 0,
      toMs: Date.now(),
      includeResolved: true,
      fetchText: async () => {
        throw new Error('no HTML when id configured');
      },
      fetchJson,
    });

    expect(fetchJson).toHaveBeenCalled();
  });

  it('respects limit across pages', async () => {
    const mk = (title: string, incId: string) => ({
      code: 0,
      data: {
        resource_list: [
          {
            display_name: 'A',
            status_history: {
              day_wise_status_history: [
                {
                  outage_list: [
                    {
                      start_time: '2026-06-01T12:00:00+0000',
                      end_time: '2026-06-01T13:00:00+0000',
                      ongoing: false,
                      status: 1,
                      associated_incident_info: { enc_inc_id: incId, inc_title: title },
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    });

    let calls = 0;
    const fetchJson = jest.fn(async () => {
      calls += 1;
      return calls === 1 ? mk('One', '1') : mk('Two', '2');
    });

    const windows = await fetchIncidentWindows({
      resolveUrl: resolveDemo,
      configuredEncodedId: 'id=',
      timezone: 'UTC',
      maxPages: 5,
      fromMs: 0,
      toMs: Date.UTC(2099, 0, 1),
      includeResolved: true,
      limit: 2,
      nowMs: Date.UTC(2099, 0, 1),
      fetchText: async () => '',
      fetchJson,
    });

    expect(windows).toHaveLength(2);
    expect(calls).toBe(2);
  });
});
