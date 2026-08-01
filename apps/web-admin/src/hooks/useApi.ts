import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

export const API_GATEWAY_URL = 'https://api.dms.jyotirmoyb.com';

export interface ApiResponse<T = any> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

export function useApi() {
  const { authToken, tenantId } = useAuth();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const get = useCallback(
    async <T = any>(path: string): Promise<ApiResponse<T>> => {
      setLoading(true);
      setError(null);
      try {
        const url = path.startsWith('http')
          ? path
          : `${API_GATEWAY_URL}${path.startsWith('/') ? '' : '/'}${path}`;

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId || '00000000-0000-0000-0000-000000000001',
        };

        if (authToken) {
          headers['Authorization'] = authToken.startsWith('Bearer ')
            ? authToken
            : `Bearer ${authToken}`;
        }

        const response = await fetch(url, {
          method: 'GET',
          headers,
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}: ${response.statusText}`);
        }

        const json = await response.json();
        setData(json);
        setLoading(false);
        return { data: json as T, error: null, loading: false };
      } catch (err: any) {
        const errorMsg = err?.message || 'An unknown network error occurred';
        setError(errorMsg);
        setData(null);
        setLoading(false);
        return { data: null, error: errorMsg, loading: false };
      }
    },
    [authToken, tenantId]
  );

  const post = useCallback(
    async <T = any>(path: string, body?: any): Promise<ApiResponse<T>> => {
      setLoading(true);
      setError(null);
      try {
        const url = path.startsWith('http')
          ? path
          : `${API_GATEWAY_URL}${path.startsWith('/') ? '' : '/'}${path}`;

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId || '00000000-0000-0000-0000-000000000001',
        };

        if (authToken) {
          headers['Authorization'] = authToken.startsWith('Bearer ')
            ? authToken
            : `Bearer ${authToken}`;
        }

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}: ${response.statusText}`);
        }

        const json = await response.json();
        setData(json);
        setLoading(false);
        return { data: json as T, error: null, loading: false };
      } catch (err: any) {
        const errorMsg = err?.message || 'An unknown network error occurred';
        setError(errorMsg);
        setData(null);
        setLoading(false);
        return { data: null, error: errorMsg, loading: false };
      }
    },
    [authToken, tenantId]
  );

  return {
    get,
    post,
    data,
    error,
    loading,
    apiGatewayUrl: API_GATEWAY_URL,
  };
}
