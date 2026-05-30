/**
 * Represents a request to be forwarded to an upstream service.
 */
export interface UpstreamRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body?: unknown;
  readonly timeout: number;
}

/**
 * Represents the response received from an upstream service.
 */
export interface UpstreamResponse {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly body: unknown;
  readonly durationMs: number;
}

/**
 * Port interface for forwarding requests to upstream services.
 */
export interface IUpstreamAdapter {
  forward(request: UpstreamRequest): Promise<UpstreamResponse>;
}
