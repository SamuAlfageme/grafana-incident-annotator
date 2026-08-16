import { ZohoOAuthClient } from './oauth';
import type { ZohoOAuthConfig, ZohoTokenResponse } from './types';

global.fetch = jest.fn();

describe('ZohoOAuthClient', () => {
  const baseConfig: ZohoOAuthConfig = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    refreshToken: 'test-refresh-token',
    accountsBaseUrl: 'https://accounts.zoho.eu',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    (global.fetch as jest.Mock).mockClear();
    (global.fetch as jest.Mock).mockReset();
  });

  describe('getAccessToken', () => {
    it('fetches and caches access token on first call', async () => {
      const mockResponse: ZohoTokenResponse = {
        access_token: 'new-access-token',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const client = new ZohoOAuthClient(baseConfig);
      const token = await client.getAccessToken();

      expect(token).toBe('new-access-token');
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://accounts.zoho.eu/oauth/v2/token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      );
    });

    it('returns cached token if not expired', async () => {
      const mockResponse: ZohoTokenResponse = {
        access_token: 'cached-token',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const client = new ZohoOAuthClient(baseConfig);
      const token1 = await client.getAccessToken();
      const token2 = await client.getAccessToken();

      expect(token1).toBe('cached-token');
      expect(token2).toBe('cached-token');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('refreshes token when cache expires', async () => {
      const mockResponse1: ZohoTokenResponse = {
        access_token: 'token-1',
        expires_in: 1,
        token_type: 'Bearer',
      };

      const mockResponse2: ZohoTokenResponse = {
        access_token: 'token-2',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockResponse1,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockResponse2,
        });

      const client = new ZohoOAuthClient(baseConfig);
      const token1 = await client.getAccessToken();

      expect(token1).toBe('token-1');

      await new Promise((resolve) => setTimeout(resolve, 1100));

      const token2 = await client.getAccessToken();

      expect(token2).toBe('token-2');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('handles single-flight refresh for concurrent requests', async () => {
      const mockResponse: ZohoTokenResponse = {
        access_token: 'concurrent-token',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      let callCount = 0;
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            callCount++;
            setTimeout(() => {
              resolve({
                ok: true,
                status: 200,
                json: async () => mockResponse,
              });
            }, 50);
          })
      );

      const client = new ZohoOAuthClient(baseConfig);
      const [token1, token2, token3] = await Promise.all([
        client.getAccessToken(),
        client.getAccessToken(),
        client.getAccessToken(),
      ]);

      expect(token1).toBe('concurrent-token');
      expect(token2).toBe('concurrent-token');
      expect(token3).toBe('concurrent-token');
      expect(callCount).toBe(1);
    });

    it('throws error and applies cooldown on OAuth error', async () => {
      const mockErrorResponse: ZohoTokenResponse = {
        access_token: '',
        expires_in: 0,
        token_type: '',
        error: 'invalid_grant',
        error_description: 'Invalid refresh token',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 400,
        json: async () => mockErrorResponse,
      });

      const client = new ZohoOAuthClient(baseConfig);

      await expect(client.getAccessToken()).rejects.toThrow('Zoho OAuth error: Invalid refresh token');

      await expect(client.getAccessToken()).rejects.toThrow('Token refresh is in cooldown');

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('applies longer cooldown for rate limit errors', async () => {
      const mockErrorResponse: ZohoTokenResponse = {
        access_token: '',
        expires_in: 0,
        token_type: '',
        error: 'rate_limit_exceeded',
        error_description: 'Rate limit exceeded',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 429,
        json: async () => mockErrorResponse,
      });

      const client = new ZohoOAuthClient(baseConfig);

      await expect(client.getAccessToken()).rejects.toThrow('Zoho OAuth error: Rate limit exceeded');

      await expect(client.getAccessToken()).rejects.toThrow(/Token refresh is in cooldown for \d+s/);

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('calls onRefreshTokenRotated when new refresh token is provided', async () => {
      const onRefreshTokenRotated = jest.fn();
      const mockResponse: ZohoTokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'rotated-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const client = new ZohoOAuthClient({
        ...baseConfig,
        onRefreshTokenRotated,
      });

      await client.getAccessToken();

      expect(onRefreshTokenRotated).toHaveBeenCalledWith('rotated-refresh-token');
    });

    it('builds token URL from accountsBaseUrl with /oauth/v2/token path', async () => {
      const mockResponse: ZohoTokenResponse = {
        access_token: 'test-token',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const client = new ZohoOAuthClient({
        ...baseConfig,
        accountsBaseUrl: 'https://accounts.zoho.com/',
      });

      await client.getAccessToken();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://accounts.zoho.com/oauth/v2/token',
        expect.any(Object)
      );
    });

    it('accepts full token URL if provided', async () => {
      const mockResponse: ZohoTokenResponse = {
        access_token: 'test-token',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const client = new ZohoOAuthClient({
        ...baseConfig,
        accountsBaseUrl: 'https://accounts.zoho.com/oauth/v2/token',
      });

      await client.getAccessToken();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://accounts.zoho.com/oauth/v2/token',
        expect.any(Object)
      );
    });
  });

  describe('clearCache', () => {
    it('clears cached token forcing new refresh', async () => {
      const mockResponse1: ZohoTokenResponse = {
        access_token: 'token-1',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      const mockResponse2: ZohoTokenResponse = {
        access_token: 'token-2',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockResponse1,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockResponse2,
        });

      const client = new ZohoOAuthClient(baseConfig);
      const token1 = await client.getAccessToken();

      expect(token1).toBe('token-1');

      client.clearCache();

      const token2 = await client.getAccessToken();

      expect(token2).toBe('token-2');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
