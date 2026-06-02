// Decoupled Logger Wrapper
class StructuredLogger {
  constructor(private name: string) {}
  info(msg: string, meta?: any) { console.log(`[INFO] [${this.name}] ${msg}`, meta ? JSON.stringify(meta) : ''); }
  error(msg: string, meta?: any) { console.error(`[ERROR] [${this.name}] ${msg}`, meta ? JSON.stringify(meta) : ''); }
  warn(msg: string, meta?: any) { console.warn(`[WARN] [${this.name}] ${msg}`, meta ? JSON.stringify(meta) : ''); }
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface HttpRequestOptions {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  idempotent?: boolean;
}

export interface HttpResponse<T = any> {
  status: number;
  headers: Record<string, string>;
  data: T;
}

export type HttpInterceptor = (options: HttpRequestOptions) => Promise<HttpRequestOptions> | HttpRequestOptions;

// ==========================================
// 1. CIRCUIT BREAKER IMPLEMENTATION
// ==========================================
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private lastStateChange: number = Date.now();
  private logger = new StructuredLogger('CircuitBreaker');

  constructor(
    private readonly failureThreshold = 5,
    private readonly cooldownPeriodMs = 10000
  ) {}

  getState(): CircuitState {
    this.checkCooldown();
    return this.state;
  }

  private checkCooldown(): void {
    if (this.state === 'OPEN' && Date.now() - this.lastStateChange > this.cooldownPeriodMs) {
      this.state = 'HALF_OPEN';
      this.lastStateChange = Date.now();
      this.logger.info('Circuit Breaker entering HALF_OPEN state');
    }
  }

  recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.failureCount = 0;
      this.lastStateChange = Date.now();
      this.logger.info('Circuit Breaker reset to CLOSED state');
    } else if (this.state === 'CLOSED') {
      this.failureCount = 0;
    }
  }

  recordFailure(): void {
    if (this.state === 'CLOSED') {
      this.failureCount++;
      if (this.failureCount >= this.failureThreshold) {
        this.state = 'OPEN';
        this.lastStateChange = Date.now();
        this.logger.error('Circuit Breaker tripped to OPEN state');
      }
    } else if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.lastStateChange = Date.now();
      this.logger.error('Circuit Breaker tripped to OPEN state during HALF_OPEN trial');
    }
  }
}

// ==========================================
// 2. RETRY POLICY IMPLEMENTATION
// ==========================================
export class RetryPolicy {
  constructor(
    private readonly maxRetries = 3,
    private readonly initialDelayMs = 200,
    private readonly backoffFactor = 2
  ) {}

  /**
   * Exponential backoff with random jitter to prevent stampedes.
   */
  getDelay(attempt: number): number {
    const delay = this.initialDelayMs * Math.pow(this.backoffFactor, attempt);
    const jitter = Math.random() * 0.5 * delay; // 50% random jitter
    return delay + jitter;
  }

  isIdempotent(method: HttpMethod, headers: Record<string, string>): boolean {
    const methodUpper = method.toUpperCase();
    // GET, PUT, DELETE, HEAD are idempotent.
    // POST with idempotency key is also eligible.
    if (['GET', 'PUT', 'DELETE', 'HEAD'].includes(methodUpper)) {
      return true;
    }
    if (headers['x-idempotency-key'] || headers['X-Idempotency-Key']) {
      return true;
    }
    return false;
  }
}

// ==========================================
// 3. RESILIENT HTTP CLIENT
// ==========================================
export class ResilientHttpClient {
  private interceptors: HttpInterceptor[] = [];
  private circuitBreaker = new CircuitBreaker();
  private retryPolicy = new RetryPolicy();
  private logger = new StructuredLogger('ResilientHttpClient');

  addInterceptor(interceptor: HttpInterceptor): void {
    this.interceptors.push(interceptor);
  }

  async request<T = any>(url: string, opts: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    let method: HttpMethod = opts.method ?? 'GET';
    let headers: Record<string, string> = { ...(opts.headers ?? {}) };
    let body = opts.body;
    let timeoutMs = opts.timeoutMs ?? 5000;

    // Apply interceptors
    let requestOptions: HttpRequestOptions = { method, headers, body, timeoutMs };
    for (const interceptor of this.interceptors) {
      requestOptions = await interceptor(requestOptions);
    }

    method = requestOptions.method ?? method;
    headers = requestOptions.headers ?? headers;
    body = requestOptions.body ?? body;
    timeoutMs = requestOptions.timeoutMs ?? timeoutMs;

    let attempt = 0;

    while (true) {
      // 1. Check Circuit Breaker State
      const state = this.circuitBreaker.getState();
      if (state === 'OPEN') {
        this.logger.error('Request blocked by Circuit Breaker (OPEN)');
        throw new Error('Circuit Breaker is OPEN. Request blocked.');
      }

      // 2. Setup Abort Controller for Timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const fetchResponse = await fetch(url, {
          method,
          headers,
          body,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!fetchResponse.ok) {
          throw new Error(`HTTP error! status: ${fetchResponse.status}`);
        }

        const data = await fetchResponse.json().catch(() => ({}));
        
        // Convert headers mapping
        const responseHeaders: Record<string, string> = {};
        fetchResponse.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        // Record success in Circuit Breaker
        this.circuitBreaker.recordSuccess();

        return {
          status: fetchResponse.status,
          headers: responseHeaders,
          data: data as T
        };

      } catch (err: any) {
        clearTimeout(timeoutId);
        
        // Record failure in Circuit Breaker
        this.circuitBreaker.recordFailure();

        // 3. Evaluate Retry Eligibility
        const isIdempotent = this.retryPolicy.isIdempotent(method, headers);
        if (isIdempotent && attempt < this.maxRetries()) {
          attempt++;
          const delay = this.retryPolicy.getDelay(attempt);
          this.logger.warn(`Request failed. Retrying in ${Math.round(delay)}ms... (Attempt ${attempt}/${this.maxRetries()})`, { error: err.message });
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        this.logger.error('Request failed and cannot be retried', { error: err.message });
        throw err;
      }
    }
  }

  private maxRetries(): number {
    return 3;
  }
}
