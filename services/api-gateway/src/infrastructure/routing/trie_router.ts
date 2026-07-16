import { createHash } from 'node:crypto';

interface TrieNode {
  children: Map<string, TrieNode>;
  paramName: string | null;
  isParam: boolean;
  isWildcard: boolean;
  handler: RouteHandler | null;
}

export interface RouteHandler {
  routeId: string;
  targetService: string;
  targetPath: string;
  requiredPermissions: string[];
  rateLimit: number;
  timeout: number;
}

interface MatchResult {
  handler: RouteHandler;
  params: Record<string, string>;
}

export class TrieRouter {
  private roots = new Map<string, TrieNode>();

  private createNode(): TrieNode {
    return { children: new Map(), paramName: null, isParam: false, isWildcard: false, handler: null };
  }

  insert(method: string, path: string, handler: RouteHandler): void {
    const m = method.toUpperCase();
    if (!this.roots.has(m)) this.roots.set(m, this.createNode());
    let node = this.roots.get(m)!;
    const segments = path.split('/').filter(Boolean);

    for (const seg of segments) {
      if (seg === '*') {
        let wildcardChild = Array.from(node.children.values()).find((c) => c.isWildcard);
        if (!wildcardChild) {
          wildcardChild = this.createNode();
          wildcardChild.isWildcard = true;
          node.children.set('*', wildcardChild);
        }
        node = wildcardChild;
        break;
      }

      if (seg.startsWith(':')) {
        const paramName = seg.slice(1);
        let paramChild = Array.from(node.children.values()).find((c) => c.isParam);
        if (!paramChild) {
          paramChild = this.createNode();
          paramChild.isParam = true;
          paramChild.paramName = paramName;
          node.children.set(':param', paramChild);
        }
        node = paramChild;
        continue;
      }

      if (!node.children.has(seg)) {
        node.children.set(seg, this.createNode());
      }
      node = node.children.get(seg)!;
    }

    node.handler = handler;
  }

  match(method: string, path: string): MatchResult | null {
    const m = method.toUpperCase();
    const root = this.roots.get(m);
    if (!root) return null;

    const segments = path.split('/').filter(Boolean);
    const params: Record<string, string> = {};

    return this.matchNode(root, segments, 0, params);
  }

  private matchNode(node: TrieNode, segments: string[], index: number, params: Record<string, string>): MatchResult | null {
    if (index === segments.length) {
      return node.handler ? { handler: node.handler, params: { ...params } } : null;
    }

    const seg = segments[index];

    // Exact match first
    const exactChild = node.children.get(seg);
    if (exactChild) {
      const result = this.matchNode(exactChild, segments, index + 1, params);
      if (result) return result;
    }

    // Param match
    const paramChild = node.children.get(':param');
    if (paramChild && paramChild.paramName) {
      params[paramChild.paramName] = seg;
      const result = this.matchNode(paramChild, segments, index + 1, params);
      if (result) return result;
      delete params[paramChild.paramName];
    }

    // Wildcard match
    const wildcardChild = node.children.get('*');
    if (wildcardChild && wildcardChild.handler) {
      return { handler: wildcardChild.handler, params: { ...params, '*': segments.slice(index).join('/') } };
    }

    return null;
  }
}

/**
 * JWT validator (structural validation, no crypto verification in mock).
 */
export class JwtValidator {
  validate(token: string): { valid: boolean; claims?: Record<string, unknown>; error?: string } {
    if (!token || !token.includes('.')) {
      return { valid: false, error: 'Invalid token format' };
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'JWT must have 3 parts' };
    }

    try {
      const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf-8'));

      if (payload.exp && payload.exp * 1000 < Date.now()) {
        return { valid: false, error: 'Token expired' };
      }

      return { valid: true, claims: payload };
    } catch {
      return { valid: false, error: 'Failed to decode JWT payload' };
    }
  }
}

/**
 * API key validator using SHA-256 hash comparison.
 */
export class ApiKeyValidator {
  hashKey(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }

  verify(rawKey: string, storedHash: string): boolean {
    const hash = this.hashKey(rawKey);
    if (hash.length !== storedHash.length) return false;
    let result = 0;
    for (let i = 0; i < hash.length; i++) {
      result |= hash.charCodeAt(i) ^ storedHash.charCodeAt(i);
    }
    return result === 0;
  }
}

/**
 * In-memory sliding window rate limit store.
 */
export class RateLimitStore {
  private windows = new Map<string, { start: number; count: number }>();
  private readonly windowMs: number;

  constructor(windowMs: number = 60_000) {
    this.windowMs = windowMs;
  }

  tryAcquire(key: string, limit: number): boolean {
    const now = Date.now();
    const window = this.windows.get(key);

    if (!window || now - window.start >= this.windowMs) {
      this.windows.set(key, { start: now, count: 1 });
      return true;
    }

    if (window.count >= limit) return false;
    window.count++;
    return true;
  }

  remaining(key: string, limit: number): number {
    const now = Date.now();
    const window = this.windows.get(key);
    if (!window || now - window.start >= this.windowMs) return limit;
    return Math.max(0, limit - window.count);
  }
}

/**
 * In-memory route repository seeded with default routes for all services.
 */
export class InMemoryRouteRepository {
  private routes: RouteHandler[] = [];

  constructor() {
    this.seed();
  }

  private seed(): void {
    const services = [
      { prefix: 'sfa', service: 'sfa-service', paths: ['orders', 'visits', 'journey-plans', 'agents', 'order-approvals', 'beat-routes', 'attendance'] },
      { prefix: 'dms', service: 'dms-core-service', paths: [
        'distributors',
        'distributors/onboarding',
        'distributors/onboarding/submit-kyc',
        'distributors/onboarding/approve-kyc',
        'distributors/onboarding/approve-credit',
        'distributors/onboarding/sign-contract',
        'distributors/onboarding/activate',
        'distributors/hierarchy',
        'distributors/kyc',
        'distributors/kyc/verify',
        'distributors/credit-limit',
        'distributors/credit-limit/utilize',
        'outlets',
        'inventory',
        'inventory/allocate',
        'inventory/alerts',
        'inventory/reconcile',
        'returns'
      ] },
      { prefix: 'schemes', service: 'schemes-service', paths: ['schemes'] },
      { prefix: 'pricing', service: 'pricing-service', paths: ['pricing/price-lists', 'pricing/calculate'] },
      { prefix: 'claims', service: 'claims-service', paths: ['claims', 'claims/:id/validate', 'claims/:id/approve', 'claims/:id/reject', 'claims/:id/settle'] },
      { prefix: 'identity', service: 'identity-service', paths: ['auth', 'users', 'roles', 'tenants', 'permissions', 'mfa-devices'] },
      { prefix: 'config', service: 'config-service', paths: ['flags', 'tenant-configs'] },
      { prefix: 'notifications', service: 'notification-service', paths: ['notifications', 'templates'] },
      { prefix: 'sync', service: 'sync-service', paths: ['sync'] },
      { prefix: 'files', service: 'file-service', paths: ['files'] },
      { prefix: 'audit', service: 'audit-service', paths: ['audit', 'audit/verify', 'audit/tamper'] },
      { prefix: 'ai', service: 'ai-gateway-service', paths: ['inference', 'models', 'prompts'] },
      { prefix: 'forecasts', service: 'forecasting-service', paths: ['forecasts'] },
      { prefix: 'recommendations', service: 'recommendation-service', paths: ['recommendations'] },
      { prefix: 'reports', service: 'report-service', paths: ['reports', 'dashboards'] },
    ];

    for (const svc of services) {
      for (const path of svc.paths) {
        this.routes.push({
          routeId: `route-${svc.prefix}-${path}`,
          targetService: svc.service,
          targetPath: `/${path}`,
          requiredPermissions: [`${path}:read`],
          rateLimit: 100,
          timeout: 30_000,
        });
      }
    }
  }

  getAll(): RouteHandler[] {
    return [...this.routes];
  }

  findByServiceAndPath(service: string, path: string): RouteHandler | undefined {
    return this.routes.find((r) => r.targetService === service && r.targetPath === path);
  }
}
