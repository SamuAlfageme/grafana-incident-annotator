import type { ZohoOAuthConfig, ZohoTokenCache, ZohoTokenResponse, ZohoApiError } from './types';

const TOKEN_EXPIRY_SKEW_MS = 30_000;
const GENERIC_ERROR_COOLDOWN_MS = 20_000;
const RATE_LIMIT_COOLDOWN_MS = 90_000;

export class ZohoOAuthClient {
  private config: ZohoOAuthConfig;
  private tokenCache?: ZohoTokenCache;
  private tokenPromise?: Promise<string>;
  private cooldownUntilMs = 0;

  constructor(config: ZohoOAuthConfig) {
    this.config = config;
  }

  public async getAccessToken(): Promise<string> {
    const now = Date.now();

    if (this.cooldownUntilMs > now) {
      const remainingMs = this.cooldownUntilMs - now;
      throw this.createError(
        `Token refresh is in cooldown for ${Math.ceil(remainingMs / 1000)}s after previous error`
      );
    }

    if (this.tokenCache && this.tokenCache.expiresAtMs > now) {
      return this.tokenCache.accessToken;
    }

    if (this.tokenPromise) {
      return await this.tokenPromise;
    }

    this.tokenPromise = this.refreshAccessToken()
      .then((token) => {
        this.tokenPromise = undefined;
        return token;
      })
      .catch((error) => {
        this.tokenPromise = undefined;
        throw error;
      });

    return await this.tokenPromise;
  }

  public clearCache(): void {
    this.tokenCache = undefined;
  }

  private async refreshAccessToken(): Promise<string> {
    const tokenUrl = this.buildTokenUrl();
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      refresh_token: this.config.refreshToken,
    });

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      const data = (await response.json()) as ZohoTokenResponse;

      if (data.error) {
        const errorMsg = data.error_description || data.error;
        const isRateLimit = this.looksLikeRateLimit(errorMsg);
        this.cooldownUntilMs = Date.now() + (isRateLimit ? RATE_LIMIT_COOLDOWN_MS : GENERIC_ERROR_COOLDOWN_MS);

        const err = this.createError(`Zoho OAuth error: ${errorMsg}`);
        err.error = data.error;
        err.error_description = data.error_description;
        err.statusCode = response.status;
        throw err;
      }

      if (!data.access_token) {
        throw this.createError('No access_token in Zoho OAuth response');
      }

      const expiresInMs = (data.expires_in || 3600) * 1000;
      this.tokenCache = {
        accessToken: data.access_token,
        expiresAtMs: Date.now() + expiresInMs - TOKEN_EXPIRY_SKEW_MS,
      };

      if (data.refresh_token && this.config.onRefreshTokenRotated) {
        await this.config.onRefreshTokenRotated(data.refresh_token);
      }

      return data.access_token;
    } catch (error) {
      if ((error as ZohoApiError).error) {
        throw error;
      }

      this.cooldownUntilMs = Date.now() + GENERIC_ERROR_COOLDOWN_MS;

      if (error instanceof Error) {
        throw this.createError(`Token refresh failed: ${error.message}`);
      }
      throw this.createError('Token refresh failed with unknown error');
    }
  }

  private buildTokenUrl(): string {
    let base = this.config.accountsBaseUrl.trim();
    if (base.includes('/oauth/v2/token')) {
      return base;
    }

    base = base.replace(/\/+$/, '');
    return `${base}/oauth/v2/token`;
  }

  private looksLikeRateLimit(message: string): boolean {
    const lower = message.toLowerCase();
    return (
      lower.includes('rate limit') ||
      lower.includes('too many requests') ||
      lower.includes('quota exceeded') ||
      lower.includes('throttle')
    );
  }

  private createError(message: string): ZohoApiError {
    return Object.assign(new Error(message), { name: 'ZohoApiError' });
  }
}
