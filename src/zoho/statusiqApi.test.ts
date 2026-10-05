import { StatusIQApiClient } from './statusiqApi';
import { ZohoOAuthClient } from './oauth';
import type { StatusHistoryResponse } from '../statusiq/types';

global.fetch = jest.fn();

describe('StatusIQApiClient', () => {
  let mockOAuthClient: jest.Mocked<ZohoOAuthClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();

    mockOAuthClient = {
      getAccessToken: jest.fn().mockResolvedValue('test-access-token'),
      clearCache: jest.fn(),
    } as unknown as jest.Mocked<ZohoOAuthClient>;
  });

  describe('getStatusHistory', () => {
    it('fetches status history with correct Zoho OAuth token header', async () => {
      const mockResponse: StatusHistoryResponse = {
        code: 0,
        message: 'success',
        data: {
          resource_list: [],
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const client = new StatusIQApiClient({ oauthClient: mockOAuthClient });
      const result = await client.getStatusHistory('test-id=', 'UTC', 1);

      expect(result).toEqual(mockResponse);
      expect(mockOAuthClient.getAccessToken).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.site24x7.com/sp/api/status_history/test-id=?timezone=UTC&period=27&page=1',
        expect.objectContaining({
          method: 'GET',
          headers: {
            Authorization: 'Zoho-oauthtoken test-access-token',
            Accept: 'application/json; version=2.0',
          },
        })
      );
    });

    it('encodes timezone parameter in URL', async () => {
      const mockResponse: StatusHistoryResponse = {
        code: 0,
        message: 'success',
        data: { resource_list: [] },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const client = new StatusIQApiClient({ oauthClient: mockOAuthClient });
      await client.getStatusHistory('test-id=', 'Europe/Zurich', 2);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.site24x7.com/sp/api/status_history/test-id=?timezone=Europe%2FZurich&period=27&page=2',
        expect.any(Object)
      );
    });

    it('retries once on 401 and clears OAuth cache', async () => {
      const mockResponse: StatusHistoryResponse = {
        code: 0,
        message: 'success',
        data: { resource_list: [] },
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          text: async () => 'Invalid token',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockResponse,
        });

      mockOAuthClient.getAccessToken
        .mockResolvedValueOnce('expired-token')
        .mockResolvedValueOnce('refreshed-token');

      const client = new StatusIQApiClient({ oauthClient: mockOAuthClient });
      const result = await client.getStatusHistory('test-id=', 'UTC', 1);

      expect(result).toEqual(mockResponse);
      expect(mockOAuthClient.clearCache).toHaveBeenCalledTimes(1);
      expect(mockOAuthClient.getAccessToken).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('does not retry more than once on 401', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid token',
      });

      const client = new StatusIQApiClient({ oauthClient: mockOAuthClient });

      await expect(client.getStatusHistory('test-id=', 'UTC', 1)).rejects.toThrow(
        'StatusIQ API request failed: HTTP 401 Unauthorized: Invalid token'
      );

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('throws error on non-OK response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error',
      });

      const client = new StatusIQApiClient({ oauthClient: mockOAuthClient });

      await expect(client.getStatusHistory('test-id=', 'UTC', 1)).rejects.toThrow(
        'StatusIQ API request failed: HTTP 500 Internal Server Error: Server error'
      );
    });

    it('handles request timeout', async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => {
              const error = new Error('The operation was aborted');
              error.name = 'AbortError';
              reject(error);
            }, 10);
          })
      );

      const client = new StatusIQApiClient({ oauthClient: mockOAuthClient });

      await expect(client.getStatusHistory('test-id=', 'UTC', 1)).rejects.toThrow(
        'StatusIQ API request timed out after 30000ms'
      );
    });

    it('propagates network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const client = new StatusIQApiClient({ oauthClient: mockOAuthClient });

      await expect(client.getStatusHistory('test-id=', 'UTC', 1)).rejects.toThrow('Network error');
    });
  });
});
