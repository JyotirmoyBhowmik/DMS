"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PiiRedactor = void 0;
class PiiRedactor {
    static EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    static PHONE_REGEX = /(\+?\d{1,3}[- ]?)?\d{10}/g;
    static CARD_REGEX = /\b(?:\d[ -]*?){13,16}\b/g;
    static redact(message) {
        if (!message)
            return '';
        return message
            .replace(this.EMAIL_REGEX, '[REDACTED_EMAIL]')
            .replace(this.PHONE_REGEX, '[REDACTED_PHONE]')
            .replace(this.CARD_REGEX, '[REDACTED_CARD]');
    }
    static redactObject(obj) {
        if (typeof obj !== 'object' || obj === null) {
            if (typeof obj === 'string') {
                return this.redact(obj);
            }
            return obj;
        }
        const result = Array.isArray(obj) ? [] : {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const val = obj[key];
                const lowerKey = key.toLowerCase();
                if (lowerKey.includes('password') ||
                    lowerKey.includes('secret') ||
                    lowerKey.includes('token') ||
                    lowerKey.includes('cvv') ||
                    lowerKey.includes('cardnumber')) {
                    result[key] = '[REDACTED_PII]';
                }
                else if (typeof val === 'string') {
                    result[key] = this.redact(val);
                }
                else if (typeof val === 'object') {
                    result[key] = this.redactObject(val);
                }
                else {
                    result[key] = val;
                }
            }
        }
        return result;
    }
}
exports.PiiRedactor = PiiRedactor;
//# sourceMappingURL=redactor.js.map