import { InvoiceRepository } from '../../domain/repositories/invoice.repository.js';
import { Invoice, InvoiceDomainError } from '../../domain/entities/invoice.entity.js';

export interface EventEnvelope {
  id: string;
  tenantId: string;
  type: string;
  version?: number;
  payload: Record<string, any>;
  occurredAt?: string;
}

export class InvoiceEventConsumer {
  private processedEvents = new Set<string>();

  constructor(private readonly repository: InvoiceRepository) {}

  public clearProcessedEvents(): void {
    this.processedEvents.clear();
  }

  async handleEvent(event: EventEnvelope): Promise<{ success: boolean; status: 'PROCESSED' | 'SKIPPED' | 'FAILED'; error?: string }> {
    if (!event || !event.id || !event.tenantId || !event.type) {
      return { success: false, status: 'FAILED', error: 'Invalid event envelope schema' };
    }

    // Deduplication check
    const dedupKey = `${event.tenantId}:${event.id}`;
    if (this.processedEvents.has(dedupKey)) {
      return { success: true, status: 'SKIPPED' };
    }

    try {
      if (event.type === 'order.placed.v1' || event.type === 'order.placed.v2') {
        const { orderId, distributorId, orderNumber, totalAmountCents } = event.payload;
        if (!orderId || !distributorId) {
          throw new InvoiceDomainError('Event payload missing orderId or distributorId');
        }

        const invoiceNumber = `INV-${orderNumber || orderId.slice(0, 8)}`;
        const existing = await this.repository.findByInvoiceNumber(invoiceNumber, event.tenantId);

        if (!existing) {
          const invoice = new Invoice({
            tenantId: event.tenantId,
            distributorId,
            orderId,
            invoiceNumber,
            grossAmountCents: totalAmountCents || 0,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days due
            status: 'ISSUED',
          });
          await this.repository.save(invoice, event.tenantId);
        }
      }

      this.processedEvents.add(dedupKey);
      return { success: true, status: 'PROCESSED' };
    } catch (err: any) {
      return { success: false, status: 'FAILED', error: err.message };
    }
  }
}
