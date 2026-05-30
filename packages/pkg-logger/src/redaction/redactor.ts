const DEFAULT_REDACT_FIELDS = [
  'phone', 'email', 'pan', 'gstin', 'aadhaar', 'lat', 'lng',
  'token', 'password', 'authTag', 'secret', 'privateKey',
  'creditCard', 'ssn', 'dob', 'cvv', 'cardnumber',
];

const DEFAULT_REDACT_PATTERNS: RegExp[] = [
  /\b\d{12}\b/g,                    // Aadhaar (12-digit)
  /\b[A-Z]{5}\d{4}[A-Z]\b/g,       // PAN
  /\b\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z\d][A-Z]\d{2}\b/g, // GSTIN
  /\b(?:\d[ -]*?){13,16}\b/g,      // credit/debit card numbers
];

function deepClone<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as unknown as T;
  }
  const cloned: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    cloned[key] = deepClone((obj as Record<string, unknown>)[key]);
  }
  return cloned as T;
}

function isRedactedField(key: string, fields: string[]): boolean {
  const lower = key.toLowerCase();
  return fields.some((f) => lower === f.toLowerCase() || lower.includes(f.toLowerCase()));
}

function maskStringWithPatterns(value: string, patterns: RegExp[]): string {
  let result = value;
  for (const pattern of patterns) {
    // Reset lastIndex for global regexes
    const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
    result = result.replace(re, '[REDACTED]');
  }
  return result;
}

function walkAndRedact(
  obj: unknown,
  fields: string[],
  patterns: RegExp[],
): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return maskStringWithPatterns(obj, patterns);
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => walkAndRedact(item, fields, patterns));
  }

  const record = obj as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(record)) {
    if (isRedactedField(key, fields)) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = walkAndRedact(record[key], fields, patterns);
    }
  }

  return result;
}

/**
 * Deep-clone the object, then recursively walk all keys.
 * If any key matches a redacted field name (case-insensitive), replace value with '[REDACTED]'.
 * If any string value matches a redact pattern, mask it.
 */
export function redact(
  obj: unknown,
  opts?: { fields?: string[]; patterns?: RegExp[] },
): unknown {
  const fields = opts?.fields ?? DEFAULT_REDACT_FIELDS;
  const patterns = opts?.patterns ?? DEFAULT_REDACT_PATTERNS;
  const cloned = deepClone(obj);
  return walkAndRedact(cloned, fields, patterns);
}

// ── Backward-compatible class API ──────────────────────────────

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(\+?\d{1,3}[- ]?)?\d{10}/g;
const CARD_REGEX = /\b(?:\d[ -]*?){13,16}\b/g;

export class PiiRedactor {
  static redact(message: string): string {
    if (!message) return '';
    return message
      .replace(EMAIL_REGEX, '[REDACTED_EMAIL]')
      .replace(PHONE_REGEX, '[REDACTED_PHONE]')
      .replace(CARD_REGEX, '[REDACTED_CARD]');
  }

  static redactObject<T>(obj: T): T {
    return redact(obj) as T;
  }
}
