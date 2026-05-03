export interface ZohoTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  error?: string;
  error_description?: string;
}

export interface ZohoOAuthConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accountsBaseUrl: string;
  onRefreshTokenRotated?: (newRefreshToken: string) => void | Promise<void>;
}

export interface ZohoTokenCache {
  accessToken: string;
  expiresAtMs: number;
}

export interface ZohoApiError extends Error {
  error?: string;
  error_description?: string;
  statusCode?: number;
}
