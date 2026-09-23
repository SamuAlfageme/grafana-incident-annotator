import { fetchIncidentWindowsWithZoho } from './fetchIncidentsWithZoho';

global.fetch = jest.fn();

describe('fetchIncidentWindowsWithZoho', () => {
  const baseParams = {
    configuredEncodedId: 'test-id=',
    timezone: 'UTC',
    maxPages: 1,
    fromMs: new Date('2026-06-01T00:00:00Z').getTime(),
    toMs: new Date('2026-06-02T00:00:00Z').getTime(),
    includeResolved: true,
    zohoAccountsBaseUrl: 'https://accounts.zoho.eu',
    zohoClientId: 'test-client-id',
    zohoClientSecret: 'test-client-secret',
    zohoRefreshToken: 'test-refresh-token',
    fetchText: jest.fn().mockResolvedValue('<html></html>'),
    resolveUrl: (p: string) => `https://status.example.com${p}`,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  it('fetches incidents using Zoho OAuth API', async () => {
    const tokenResponse = {
      access_token: 'zoho-access-token',
      expires_in: 3600,
      token_type: 'Bearer',
    };

    const statusHistoryResponse = {
      code: 0,
      message: 'success',
      data: {
        resource_list: [
          {
            display_name: 'API',
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
                        inc_title: 'Service Down',
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

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => tokenResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => statusHistoryResponse,
      });

    const windows = await fetchIncidentWindowsWithZoho(baseParams);

    expect(windows).toHaveLength(1);
    expect(windows[0].title).toBe('Service Down');
    expect(windows[0].component).toBe('API');
    expect(windows[0].statusLabel).toBe('major_outage');

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'https://accounts.zoho.eu/oauth/v2/token',
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'https://www.site24x7.com/sp/api/status_history/test-id=?timezone=UTC&period=27&page=1',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Zoho-oauthtoken zoho-access-token',
        }),
      })
    );
  });

  it('discovers encoded status page ID when not configured', async () => {
    const htmlWithId = '<script>"enc_statuspage_id":"discovered-id="</script>';
    const fetchText = jest.fn().mockResolvedValue(htmlWithId);

    const tokenResponse = {
      access_token: 'zoho-access-token',
      expires_in: 3600,
      token_type: 'Bearer',
    };

    const statusHistoryResponse = {
      code: 0,
      message: 'success',
      data: { resource_list: [] },
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => tokenResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => statusHistoryResponse,
      });

    await fetchIncidentWindowsWithZoho({
      ...baseParams,
      configuredEncodedId: undefined,
      fetchText,
    });

    expect(fetchText).toHaveBeenCalledWith('https://status.example.com/');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://www.site24x7.com/sp/api/status_history/discovered-id=?timezone=UTC&period=27&page=1',
      expect.any(Object)
    );
  });

  it('respects limit parameter', async () => {
    const tokenResponse = {
      access_token: 'zoho-access-token',
      expires_in: 3600,
      token_type: 'Bearer',
    };

    let callNum = 0;
    const makeIncident = () => {
      callNum++;
      return {
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
                          enc_inc_id: `inc-${callNum}`,
                          inc_title: `Incident ${callNum}`,
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
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => tokenResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makeIncident(),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makeIncident(),
      });

    const windows = await fetchIncidentWindowsWithZoho({
      ...baseParams,
      maxPages: 3,
      limit: 2,
    });

    expect(windows).toHaveLength(2);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('filters incidents by query text', async () => {
    const mockOAuthResponse = {
      access_token: 'zoho-access-token',
      expires_in: 3600,
      token_type: 'Bearer',
    };

    const statusHistoryResponse = {
      code: 0,
      message: 'success',
      data: {
        resource_list: [
          {
            display_name: 'API',
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
                        inc_title: 'Database failure',
                      },
                    },
                    {
                      start_time: '2026-06-01T12:00:00+0000',
                      end_time: '2026-06-01T13:00:00+0000',
                      ongoing: false,
                      status: 6,
                      associated_incident_info: {
                        enc_inc_id: 'inc-2',
                        inc_title: 'Network timeout',
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

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockOAuthResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => statusHistoryResponse,
      });

    const windows = await fetchIncidentWindowsWithZoho({
      ...baseParams,
      queryText: 'database',
    });

    expect(windows).toHaveLength(1);
    expect(windows[0].title).toBe('Database failure');
  });

  it('throws error when OAuth token request fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        access_token: '',
        expires_in: 0,
        token_type: '',
        error: 'invalid_grant',
        error_description: 'Invalid refresh token',
      }),
    });

    await expect(fetchIncidentWindowsWithZoho(baseParams)).rejects.toThrow(
      'Zoho OAuth error: Invalid refresh token'
    );
  });
});
