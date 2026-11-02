import type { ZohoOAuthClient } from './oauth';
import type { StatusHistoryResponse } from '../statusiq/types';

const STATUSIQ_API_BASE = 'https://www.site24x7.com/sp/api';
const REQUEST_TIMEOUT_MS = 30_000;

export interface StatusIQApiClientConfig {
  oauthClient: ZohoOAuthClient;
}

export class StatusIQApiClient {
  private oauthClient: ZohoOAuthClient;

  constructor(config: StatusIQApiClientConfig) {
    this.oauthClient = config.oauthClient;
  }

  public async getStatusHistory(
    encodedStatusPageId: string,
    timezone: string,
    page: number
  ): Promise<StatusHistoryResponse> {
    const url = this.buildStatusHistoryUrl(encodedStatusPageId, timezone, page);
    return await this.fetchWithRetry(url);
  }

  private async fetchWithRetry(url: string, retryOn401 = true): Promise<StatusHistoryResponse> {
    const accessToken = await this.oauthClient.getAccessToken();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          Accept: 'application/json; version=2.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 401 && retryOn401) {
        this.oauthClient.clearCache();
        return await this.fetchWithRetry(url, false);
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(
          `StatusIQ API request failed: HTTP ${response.status} ${response.statusText}${errorText ? `: ${errorText}` : ''}`
        );
      }

      const data = (await response.json()) as StatusHistoryResponse;
      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if ((error as Error).name === 'AbortError') {
        throw new Error(`StatusIQ API request timed out after ${REQUEST_TIMEOUT_MS}ms`);
      }

      throw error;
    }
  }

  private buildStatusHistoryUrl(encodedStatusPageId: string, timezone: string, page: number): string {
    const period = 27;
    return `${STATUSIQ_API_BASE}/status_history/${encodedStatusPageId}?timezone=${encodeURIComponent(timezone)}&period=${period}&page=${page}`;
  }
}
