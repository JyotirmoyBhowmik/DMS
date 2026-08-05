/**
 * Request schema validation middleware.
 *
 * Validates incoming request payloads against registered JSON-schema-like
 * rules.  Schemas are registered per route (method + path pattern) and
 * validated at the middleware layer before the request reaches the handler.
 *
 * This implementation is framework-agnostic – it operates on a plain
 * `IncomingRequest` object and returns validation results.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ValidationRule {
  /** The property name to validate (e.g. "body.email") */
  field: string;
  /** Built-in validator type */
  type: 'required' | 'string' | 'number' | 'boolean' | 'uuid' | 'email' | 'enum' | 'minLength' | 'maxLength' | 'min' | 'max' | 'pattern' | 'array';
  /** Human-readable error message override */
  message?: string;
  /** Extra parameter (e.g. enum values, min/max values, regex pattern) */
  param?: unknown;
}

export interface SchemaDefinition {
  /** HTTP method (uppercase). Use '*' for all methods. */
  method: string;
  /** URL path pattern (exact match or glob, e.g. "/api/v1/orders") */
  path: string;
  /** Where to look for the fields: 'body', 'query', 'params', 'headers' */
  source: 'body' | 'query' | 'params' | 'headers';
  /** Validation rules to apply */
  rules: ValidationRule[];
}

export interface ValidationError {
  field: string;
  rule: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidatableRequest {
  method: string;
  path: string;
  headers?: Record<string, string | undefined>;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
}

// ─── Validator ────────────────────────────────────────────────────────────────

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class RequestValidator {
  private readonly schemas: SchemaDefinition[] = [];

  /**
   * Register a validation schema for a route.
   */
  register(schema: SchemaDefinition): void {
    this.schemas.push(schema);
  }

  /**
   * Register multiple schemas at once.
   */
  registerAll(schemas: SchemaDefinition[]): void {
    for (const s of schemas) {
      this.register(s);
    }
  }

  /**
   * Validate an incoming request against all matching schemas.
   */
  validate(request: ValidatableRequest): ValidationResult {
    const errors: ValidationError[] = [];

    const matchingSchemas = this.schemas.filter(
      (s) =>
        (s.method === '*' || s.method.toUpperCase() === request.method.toUpperCase()) &&
        this.pathMatches(s.path, request.path),
    );

    for (const schema of matchingSchemas) {
      const source = this.getSource(request, schema.source);

      for (const rule of schema.rules) {
        const value = this.getNestedValue(source, rule.field);
        const error = this.applyRule(rule, value);
        if (error) errors.push(error);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private pathMatches(pattern: string, path: string): boolean {
    if (pattern === path) return true;
    // Simple wildcard: /api/v1/* matches /api/v1/orders
    if (pattern.endsWith('/*')) {
      return path.startsWith(pattern.slice(0, -1));
    }
    // Parametric: /api/v1/orders/:id matches /api/v1/orders/abc
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');
    if (patternParts.length !== pathParts.length) return false;
    return patternParts.every(
      (p, i) => p.startsWith(':') || p === pathParts[i],
    );
  }

  private getSource(
    request: ValidatableRequest,
    source: string,
  ): Record<string, unknown> {
    switch (source) {
      case 'body':
        return request.body ?? {};
      case 'query':
        return request.query ?? {};
      case 'params':
        return request.params ?? {};
      case 'headers':
        return (request.headers as Record<string, unknown>) ?? {};
      default:
        return {};
    }
  }

  private getNestedValue(
    obj: Record<string, unknown>,
    path: string,
  ): unknown {
    return path.split('.').reduce<unknown>((cur, key) => {
      if (cur && typeof cur === 'object' && key in (cur as Record<string, unknown>)) {
        return (cur as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  private applyRule(
    rule: ValidationRule,
    value: unknown,
  ): ValidationError | null {
    const defaultMsg = (msg: string) => rule.message ?? msg;

    switch (rule.type) {
      case 'required':
        if (value === undefined || value === null || value === '') {
          return {
            field: rule.field,
            rule: 'required',
            message: defaultMsg(`${rule.field} is required`),
          };
        }
        break;

      case 'string':
        if (value !== undefined && value !== null && typeof value !== 'string') {
          return {
            field: rule.field,
            rule: 'string',
            message: defaultMsg(`${rule.field} must be a string`),
          };
        }
        break;

      case 'number':
        if (value !== undefined && value !== null && typeof value !== 'number') {
          return {
            field: rule.field,
            rule: 'number',
            message: defaultMsg(`${rule.field} must be a number`),
          };
        }
        break;

      case 'boolean':
        if (value !== undefined && value !== null && typeof value !== 'boolean') {
          return {
            field: rule.field,
            rule: 'boolean',
            message: defaultMsg(`${rule.field} must be a boolean`),
          };
        }
        break;

      case 'uuid':
        if (typeof value === 'string' && !UUID_RE.test(value)) {
          return {
            field: rule.field,
            rule: 'uuid',
            message: defaultMsg(`${rule.field} must be a valid UUID`),
          };
        }
        break;

      case 'email':
        if (typeof value === 'string' && !EMAIL_RE.test(value)) {
          return {
            field: rule.field,
            rule: 'email',
            message: defaultMsg(`${rule.field} must be a valid email`),
          };
        }
        break;

      case 'enum': {
        const allowed = rule.param as unknown[];
        if (value !== undefined && value !== null && !allowed?.includes(value)) {
          return {
            field: rule.field,
            rule: 'enum',
            message: defaultMsg(
              `${rule.field} must be one of: ${(allowed ?? []).join(', ')}`,
            ),
          };
        }
        break;
      }

      case 'minLength':
        if (typeof value === 'string' && value.length < (rule.param as number)) {
          return {
            field: rule.field,
            rule: 'minLength',
            message: defaultMsg(
              `${rule.field} must be at least ${rule.param} characters`,
            ),
          };
        }
        break;

      case 'maxLength':
        if (typeof value === 'string' && value.length > (rule.param as number)) {
          return {
            field: rule.field,
            rule: 'maxLength',
            message: defaultMsg(
              `${rule.field} must be at most ${rule.param} characters`,
            ),
          };
        }
        break;

      case 'min':
        if (typeof value === 'number' && value < (rule.param as number)) {
          return {
            field: rule.field,
            rule: 'min',
            message: defaultMsg(
              `${rule.field} must be at least ${rule.param}`,
            ),
          };
        }
        break;

      case 'max':
        if (typeof value === 'number' && value > (rule.param as number)) {
          return {
            field: rule.field,
            rule: 'max',
            message: defaultMsg(
              `${rule.field} must be at most ${rule.param}`,
            ),
          };
        }
        break;

      case 'pattern': {
        const regex = new RegExp(rule.param as string);
        if (typeof value === 'string' && !regex.test(value)) {
          return {
            field: rule.field,
            rule: 'pattern',
            message: defaultMsg(
              `${rule.field} must match pattern ${rule.param}`,
            ),
          };
        }
        break;
      }

      case 'array':
        if (value !== undefined && value !== null && !Array.isArray(value)) {
          return {
            field: rule.field,
            rule: 'array',
            message: defaultMsg(`${rule.field} must be an array`),
          };
        }
        break;
    }

    return null;
  }
}
