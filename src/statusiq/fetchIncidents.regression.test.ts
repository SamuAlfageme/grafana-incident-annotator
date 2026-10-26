import { fetchIncidentWindows, resolveEncodedStatusPageId } from './fetchIncidents';
import { defaultStatusiqResolveUrl } from './urls';

describe('fetchIncidents (regression - core public API functionality)', () => {
  const resolveDemo = (p: string) => defaultStatusiqResolveUrl('https://status.example.com', p);

  it('resolves encoded status page ID from configured value', async () => {
    const result = await resolveEncodedStatusPageId({
      configuredEncodedId: '  my-configured-id=  ',
      fetchText: async () => {
        throw new Error('should not fetch HTML');
      },
      resolveUrl: () => {
        throw new Error('should not call resolveUrl');
      },
    });

    expect(result).toBe('my-configured-id=');
  });

  it('resolves encoded status page ID from HTML when not configured', async () => {
    const html = '<script>"enc_statuspage_id":"parsed-from-html="</script>';

    const result = await resolveEncodedStatusPageId({
      fetchText: async (url) => {
        expect(url).toBe('https://status.example.com/');
        return html;
      },
      resolveUrl: (p) => defaultStatusiqResolveUrl('https://status.example.com', p),
    });

    expect(result).toBe('parsed-from-html=');
  });

  it('fetches incidents from public API without authentication', async () => {
    const mockBody = {
      code: 0,
      message: 'success',
      data: {
        resource_list: [
          {
            display_name: 'Service',
            status_history: {
              day_wise_status_history: [
                {
                  date: '2026-06-01',
                  outage_list: [
                    {
                      start_time: '2026-06-01T10:00:00+0000',
                      end_time: '2026-06-01T11:00:00+0000',
                      ongoing: false,
                      status: 6,
                      associated_incident_info: {
                        enc_inc_id: 'public-inc-1',
                        inc_title: 'Public API Test',
                      },
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    };

    const fetchText = jest.fn(async () => '<html></html>');
    const fetchJson = jest.fn(async (url: string) => {
      expect(url).toContain('/sp/api/public/status_history/');
      return mockBody;
    });

    const windows = await fetchIncidentWindows({
      resolveUrl: resolveDemo,
      configuredEncodedId: 'public-id=',
      timezone: 'UTC',
      maxPages: 1,
      fromMs: new Date('2026-06-01T00:00:00Z').getTime(),
      toMs: new Date('2026-06-02T00:00:00Z').getTime(),
      includeResolved: true,
      nowMs: new Date('2026-06-01T12:00:00Z').getTime(),
      fetchText,
      fetchJson,
    });

    expect(windows).toHaveLength(1);
    expect(windows[0].title).toBe('Public API Test');
    expect(windows[0].component).toBe('Service');
    expect(windows[0].statusLabel).toBe('major_outage');

    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(fetchText).not.toHaveBeenCalled();
  });

  it('respects includeResolved filter in public API', async () => {
    const mockBody = {
      code: 0,
      message: 'success',
      data: {
        resource_list: [
          {
            display_name: 'Service',
            status_history: {
              day_wise_status_history: [
                {
                  date: '2026-06-01',
                  outage_list: [
                    {
                      start_time: '2026-06-01T10:00:00+0000',
                      end_time: '2026-06-01T11:00:00+0000',
                      ongoing: false,
                      status: 6,
                      associated_incident_info: {
                        enc_inc_id: 'resolved-1',
                        inc_title: 'Resolved incident',
                      },
                    },
                    {
                      start_time: '2026-06-01T12:00:00+0000',
                      ongoing: true,
                      status: 6,
                      associated_incident_info: {
                        enc_inc_id: 'ongoing-1',
                        inc_title: 'Ongoing incident',
                      },
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    };

    const fetchText = jest.fn(async () => '<html></html>');
    const fetchJson = jest.fn(async () => mockBody);

    const windows = await fetchIncidentWindows({
      resolveUrl: resolveDemo,
      configuredEncodedId: 'test-id=',
      timezone: 'UTC',
      maxPages: 1,
      fromMs: new Date('2026-06-01T00:00:00Z').getTime(),
      toMs: new Date('2026-06-02T00:00:00Z').getTime(),
      includeResolved: false,
      nowMs: new Date('2026-06-01T13:00:00Z').getTime(),
      fetchText,
      fetchJson,
    });

    expect(windows).toHaveLength(1);
    expect(windows[0].title).toBe('Ongoing incident');
    expect(windows[0].ongoing).toBe(true);
  });

  it('respects limit parameter in public API', async () => {
    const makeResponse = (incId: string) => ({
      code: 0,
      message: 'success',
      data: {
        resource_list: [
          {
            display_name: 'Service',
            status_history: {
              day_wise_status_history: [
                {
                  date: '2026-06-01',
                  outage_list: [
                    {
                      start_time: '2026-06-01T10:00:00+0000',
                      end_time: '2026-06-01T11:00:00+0000',
                      ongoing: false,
                      status: 1,
                      associated_incident_info: {
                        enc_inc_id: incId,
                        inc_title: `Incident ${incId}`,
                      },
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    });

    let callCount = 0;
    const fetchJson = jest.fn(async () => {
      callCount += 1;
      return makeResponse(`inc-${callCount}`);
    });

    const windows = await fetchIncidentWindows({
      resolveUrl: resolveDemo,
      configuredEncodedId: 'test-id=',
      timezone: 'UTC',
      maxPages: 5,
      fromMs: 0,
      toMs: Date.UTC(2099, 0, 1),
      includeResolved: true,
      limit: 3,
      nowMs: Date.UTC(2099, 0, 1),
      fetchText: async () => '',
      fetchJson,
    });

    expect(windows).toHaveLength(3);
    expect(fetchJson).toHaveBeenCalledTimes(3);
  });

  it('filters incidents by queryText in public API', async () => {
    const mockBody = {
      code: 0,
      message: 'success',
      data: {
        resource_list: [
          {
            display_name: 'Database',
            status_history: {
              day_wise_status_history: [
                {
                  date: '2026-06-01',
                  outage_list: [
                    {
                      start_time: '2026-06-01T10:00:00+0000',
                      end_time: '2026-06-01T11:00:00+0000',
                      ongoing: false,
                      status: 6,
                      associated_incident_info: {
                        enc_inc_id: 'inc-1',
                        inc_title: 'Database connection timeout',
                      },
                    },
                  ],
                },
              ],
            },
          },
          {
            display_name: 'API',
            status_history: {
              day_wise_status_history: [
                {
                  date: '2026-06-01',
                  outage_list: [
                    {
                      start_time: '2026-06-01T12:00:00+0000',
                      end_time: '2026-06-01T13:00:00+0000',
                      ongoing: false,
                      status: 6,
                      associated_incident_info: {
                        enc_inc_id: 'inc-2',
                        inc_title: 'API rate limiting',
                      },
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    };

    const fetchJson = jest.fn(async () => mockBody);

    const windows = await fetchIncidentWindows({
      resolveUrl: resolveDemo,
      configuredEncodedId: 'test-id=',
      timezone: 'UTC',
      maxPages: 1,
      fromMs: new Date('2026-06-01T00:00:00Z').getTime(),
      toMs: new Date('2026-06-02T00:00:00Z').getTime(),
      queryText: 'database',
      includeResolved: true,
      nowMs: new Date('2026-06-01T14:00:00Z').getTime(),
      fetchText: async () => '',
      fetchJson,
    });

    expect(windows).toHaveLength(1);
    expect(windows[0].component).toBe('Database');
    expect(windows[0].title).toBe('Database connection timeout');
  });

  it('handles multiple pages in public API', async () => {
    const makePage = (pageNum: number) => ({
      code: 0,
      message: 'success',
      data: {
        resource_list: [
          {
            display_name: 'Service',
            status_history: {
              day_wise_status_history: [
                {
                  date: '2026-06-01',
                  outage_list: [
                    {
                      start_time: '2026-06-01T10:00:00+0000',
                      end_time: '2026-06-01T11:00:00+0000',
                      ongoing: false,
                      status: 1,
                      associated_incident_info: {
                        enc_inc_id: `page-${pageNum}-inc`,
                        inc_title: `Page ${pageNum} incident`,
                      },
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    });

    let pageNum = 0;
    const fetchJson = jest.fn(async (url: string) => {
      pageNum += 1;
      expect(url).toContain(`page=${pageNum}`);
      return makePage(pageNum);
    });

    const windows = await fetchIncidentWindows({
      resolveUrl: resolveDemo,
      configuredEncodedId: 'test-id=',
      timezone: 'UTC',
      maxPages: 3,
      fromMs: 0,
      toMs: Date.UTC(2099, 0, 1),
      includeResolved: true,
      nowMs: Date.UTC(2099, 0, 1),
      fetchText: async () => '',
      fetchJson,
    });

    expect(windows).toHaveLength(3);
    expect(fetchJson).toHaveBeenCalledTimes(3);
    expect(windows.map((w) => w.title)).toEqual([
      'Page 1 incident',
      'Page 2 incident',
      'Page 3 incident',
    ]);
  });
});
