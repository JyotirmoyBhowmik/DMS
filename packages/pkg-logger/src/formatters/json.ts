import { CorrelationContext } from '../correlation/context';
import { PiiRedactor } from '../redaction/redactor';

export class StructuredLogger {
  private serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  private log(level: 'INFO' | 'WARN' | 'ERROR', message: string, meta?: Record<string, any>) {
    const context = CorrelationContext.get() || {};
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      message: PiiRedactor.redact(message),
      ...context,
      meta: meta ? PiiRedactor.redactObject(meta) : undefined,
    };
    process.stdout.write(JSON.stringify(payload) + '\n');
  }

  info(message: string, meta?: Record<string, any>) {
    this.log('INFO', message, meta);
  }

  warn(message: string, meta?: Record<string, any>) {
    this.log('WARN', message, meta);
  }

  error(message: string, meta?: Record<string, any>) {
    this.log('ERROR', message, meta);
  }
}
