export class PiiRedactor {
  private static readonly EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  private static readonly PHONE_REGEX = /(\+?\d{1,3}[- ]?)?\d{10}/g;
  private static readonly CARD_REGEX = /\b(?:\d[ -]*?){13,16}\b/g;

  static redact(message: string): string {
    if (!message) return '';
    return message
      .replace(this.EMAIL_REGEX, '[REDACTED_EMAIL]')
      .replace(this.PHONE_REGEX, '[REDACTED_PHONE]')
      .replace(this.CARD_REGEX, '[REDACTED_CARD]');
  }

  static redactObject<T>(obj: T): T {
    if (typeof obj !== 'object' || obj === null) {
      if (typeof obj === 'string') {
        return this.redact(obj) as unknown as T;
      }
      return obj;
    }
    const result: any = Array.isArray(obj) ? [] : {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const val = obj[key];
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes('password') ||
          lowerKey.includes('secret') ||
          lowerKey.includes('token') ||
          lowerKey.includes('cvv') ||
          lowerKey.includes('cardnumber')
        ) {
          result[key] = '[REDACTED_PII]';
        } else if (typeof val === 'string') {
          result[key] = this.redact(val);
        } else if (typeof val === 'object') {
          result[key] = this.redactObject(val);
        } else {
          result[key] = val;
        }
      }
    }
    return result;
  }
}
