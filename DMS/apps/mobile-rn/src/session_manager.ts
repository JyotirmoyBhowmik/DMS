import { signRequest, CanonicalRequestParts } from './request_signer.js';

export interface TokenSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  tenantId: string;
  email: string;
  clientSecretKeyHex: string;
}

export class SessionManager {
  private currentSession: TokenSession | null = null;
  private refreshPromise: Promise<TokenSession> | null = null;

  constructor(private readonly configServiceUrl = 'http://localhost:3000') {}

  setSession(session: TokenSession): void {
    this.currentSession = session;
  }

  getSession(): TokenSession | null {
    return this.currentSession;
  }

  clearSession(): void {
    this.currentSession = null;
    this.refreshPromise = null;
  }

  isTokenExpired(): boolean {
    if (!this.currentSession) return true;
    // Expire 60s early to prevent boundary latency issues
    return Date.now() > this.currentSession.expiresAt - 60000;
  }

  /**
   * Performs a single-flight token refresh preventing dual-request stampedes.
   */
  async refreshSession(): Promise<TokenSession> {
    if (!this.currentSession) {
      throw new Error('No active session found to refresh');
    }

    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${this.configServiceUrl}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            refreshToken: this.currentSession!.refreshToken,
          }),
        });

        if (!response.ok) {
          this.clearSession();
          throw new Error('Refresh token rejected or expired');
        }

        const data = (await response.json()) as {
          accessToken: string;
          refreshToken: string;
          expiresIn: number;
        };

        const updated: TokenSession = {
          ...this.currentSession!,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresAt: Date.now() + data.expiresIn * 1000,
        };

        this.currentSession = updated;
        return updated;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Prepares signed headers for outgoing HTTP requests.
   */
  async getSignedHeaders(
    method: string,
    urlPath: string,
    query: string,
    body: string
  ): Promise<Record<string, string>> {
    if (!this.currentSession) {
      throw new Error('Authentication required');
    }

    // Refresh if needed
    if (this.isTokenExpired()) {
      await this.refreshSession();
    }

    const timestamp = new Date().toISOString();
    const nonce = Math.random().toString(36).substring(2, 15);

    const parts: CanonicalRequestParts = {
      method,
      path: urlPath,
      query,
      body,
      timestamp,
      nonce,
    };

    const signature = signRequest(parts, this.currentSession.clientSecretKeyHex);

    return {
      'Authorization': `Bearer ${this.currentSession.accessToken}`,
      'X-Tenant-Id': this.currentSession.tenantId,
      'X-DMS-Signature': signature,
      'X-DMS-Timestamp': timestamp,
      'X-DMS-Nonce': nonce,
    };
  }
}
