import { InvoiceRepository } from '../../domain/repositories/invoice.repository.js';
import { Invoice, InvoiceItem, InvoiceDomainError } from '../../domain/entities/invoice.entity.js';
import { CreateInvoiceDto } from '../dtos/invoice.dto.js';
import { validateCreateInvoiceInput } from '../../domain/validation/invoice.validation.js';

export interface Principal {
  userId: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}

export class CreateInvoiceUseCase {
  constructor(private readonly repository: InvoiceRepository) {}

  async execute(principal: Principal, dto: CreateInvoiceDto, idempotencyKey?: string): Promise<Invoice> {
    if (!principal || !principal.tenantId) {
      throw new InvoiceDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:invoice:create') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new InvoiceDomainError('Forbidden: Insufficient permissions to create invoice');
    }

    validateCreateInvoiceInput(dto);

    const effectiveIdempotencyKey = idempotencyKey || dto.idempotencyKey;

    // Idempotency check if idempotencyKey provided
    if (effectiveIdempotencyKey) {
      const existing = await this.repository.findByInvoiceNumber(dto.invoiceNumber, principal.tenantId);
      if (existing && existing.idempotencyKey === effectiveIdempotencyKey) {
        return existing;
      }
    }

    // Check uniqueness of invoiceNumber
    const duplicate = await this.repository.findByInvoiceNumber(dto.invoiceNumber, principal.tenantId);
    if (duplicate) {
      throw new InvoiceDomainError(`Invoice with number '${dto.invoiceNumber}' already exists`);
    }

    const items = dto.items ? dto.items.map(i => new InvoiceItem({
      tenantId: principal.tenantId,
      productId: i.productId,
      description: i.description,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
      totalAmountCents: i.totalAmountCents,
    })) : [];

    const invoice = new Invoice({
      tenantId: principal.tenantId,
      distributorId: dto.distributorId,
      orderId: dto.orderId,
      invoiceNumber: dto.invoiceNumber,
      grossAmountCents: dto.grossAmountCents,
      discountAmountCents: dto.discountAmountCents,
      taxAmountCents: dto.taxAmountCents,
      netAmountCents: dto.netAmountCents,
      currency: dto.currency || 'USD',
      dueDate: new Date(dto.dueDate),
      idempotencyKey: effectiveIdempotencyKey,
      items,
      status: 'DRAFT',
      version: 1,
    });

    const saved = await this.repository.save(invoice, principal.tenantId);
    return saved;
  }
}
