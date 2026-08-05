"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PiiRedactor = void 0;
exports.redact = redact;
const DEFAULT_REDACT_FIELDS = [
    'phone', 'email', 'pan', 'gstin', 'aadhaar', 'lat', 'lng',
    'token', 'password', 'authTag', 'secret', 'privateKey',
    'creditCard', 'ssn', 'dob', 'cvv', 'cardnumber',
];
const DEFAULT_REDACT_PATTERNS = [
    /\b\d{12}\b/g, // Aadhaar (12-digit)
    /\b[A-Z]{5}\d{4}[A-Z]\b/g, // PAN
    /\b\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z\d][A-Z]\d{2}\b/g, // GSTIN
    /\b(?:\d[ -]*?){13,16}\b/g, // credit/debit card numbers
];
function deepClone(obj) {
    if (obj === null || obj === undefined || typeof obj !== 'object') {
        return obj;
    }
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }
    if (Array.isArray(obj)) {
        return obj.map((item) => deepClone(item));
    }
    const cloned = {};
    for (const key of Object.keys(obj)) {
        cloned[key] = deepClone(obj[key]);
    }
    return cloned;
}
function isRedactedField(key, fields) {
    const lower = key.toLowerCase();
    return fields.some((f) => lower === f.toLowerCase() || lower.includes(f.toLowerCase()));
}
function maskStringWithPatterns(value, patterns) {
    let result = value;
    for (const pattern of patterns) {
        // Reset lastIndex for global regexes
        const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
        result = result.replace(re, '[REDACTED]');
    }
    return result;
}
function walkAndRedact(obj, fields, patterns) {
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
    const record = obj;
    const result = {};
    for (const key of Object.keys(record)) {
        if (isRedactedField(key, fields)) {
            result[key] = '[REDACTED]';
        }
        else {
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
function redact(obj, opts) {
    const fields = opts?.fields ?? DEFAULT_REDACT_FIELDS;
    const patterns = opts?.patterns ?? DEFAULT_REDACT_PATTERNS;
    const cloned = deepClone(obj);
    return walkAndRedact(cloned, fields, patterns);
}
// ── Backward-compatible class API ──────────────────────────────
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(\+?\d{1,3}[- ]?)?\d{10}/g;
const CARD_REGEX = /\b(?:\d[ -]*?){13,16}\b/g;
class PiiRedactor {
    static redact(message) {
        if (!message)
            return '';
        return message
            .replace(EMAIL_REGEX, '[REDACTED_EMAIL]')
            .replace(PHONE_REGEX, '[REDACTED_PHONE]')
            .replace(CARD_REGEX, '[REDACTED_CARD]');
    }
    static redactObject(obj) {
        return redact(obj);
    }
}
exports.PiiRedactor = PiiRedactor;
//# sourceMappingURL=redactor.js.map