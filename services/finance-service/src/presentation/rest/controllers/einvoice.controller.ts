import { CreateEInvoiceUseCase } from '../../../application/usecases/create-einvoice.usecase.js';
import { GetEInvoiceUseCase } from '../../../application/usecases/get-einvoice.usecase.js';
import { UpdateEInvoiceUseCase } from '../../../application/usecases/update-einvoice.usecase.js';
import { ListEInvoicesUseCase } from '../../../application/usecases/list-einvoices.usecase.js';
import { EInvoiceDomainError, EInvoiceValidationError, InvalidEInvoiceStateTransitionError } from '../../../domain/entities/einvoice.entity.js';
import { Principal } from '../../../application/usecases/create-invoice.usecase.js';

export class EInvoiceController {
  constructor(
    private readonly createUseCase: CreateEInvoiceUseCase,
    private readonly getUseCase: GetEInvoiceUseCase,
    private readonly updateUseCase: UpdateEInvoiceUseCase,
    private readonly listUseCase: ListEInvoicesUseCase
  ) {}

  async create(req: any, res: any): Promise<void> {
    try {
      this.validateHeaders(req);
      const principal = this.extractPrincipal(req);
      const correlationId = (req.headers && req.headers['x-correlation-id']) || 'N/A';
      const idempotencyKey = (req.headers && req.headers['x-idempotency-key']) as string | undefined;

      const einvoice = await this.createUseCase.execute(principal, req.body, idempotencyKey, correlationId);

      res.status(201).json({
        success: true,
        data: einvoice.toJSON(),
        correlationId,
      });
    } catch (err: any) {
      this.handleError(err, res, req);
    }
  }

  async getById(req: any, res: any): Promise<void> {
    try {
      const principal = this.extractPrincipal(req);
      const einvoice = await this.getUseCase.execute(req.params.id, principal);

      res.status(200).json({
        success: true,
        data: einvoice.toJSON(),
      });
    } catch (err: any) {
      this.handleError(err, res, req);
    }
  }

  async update(req: any, res: any): Promise<void> {
    try {
      this.validateHeaders(req);
      const principal = this.extractPrincipal(req);
      const correlationId = (req.headers && req.headers['x-correlation-id']) || 'N/A';

      const einvoice = await this.updateUseCase.execute(req.params.id, principal, req.body, correlationId);

      res.status(200).json({
        success: true,
        data: einvoice.toJSON(),
        correlationId,
      });
    } catch (err: any) {
      this.handleError(err, res, req);
    }
  }

  async list(req: any, res: any): Promise<void> {
    try {
      const principal = this.extractPrincipal(req);
      const options = {
        page: req.query.page ? parseInt(req.query.page, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
        status: req.query.status,
        invoiceId: req.query.invoiceId,
      };

      const result = await this.listUseCase.execute(principal, options);

      res.status(200).json({
        success: true,
        data: result.items.map(item => item.toJSON()),
        meta: {
          total: result.total,
          page: result.page,
          limit: result.limit,
        },
      });
    } catch (err: any) {
      this.handleError(err, res, req);
    }
  }

  private validateHeaders(req: any): void {
    const contentType = req.headers && req.headers['content-type'];
    if (contentType && !contentType.includes('application/json')) {
      throw new EInvoiceDomainError('Unsupported Media Type: Content-Type must be application/json');
    }
  }

  private extractPrincipal(req: any): Principal {
    const tenantId = (req.headers && req.headers['x-tenant-id']) || '00000000-0000-0000-0000-000000000001';
    const userId = (req.headers && req.headers['x-user-id']) || 'user-default';
    const rolesStr = (req.headers && req.headers['x-user-roles']) || 'admin';
    const permsStr = (req.headers && req.headers['x-user-permissions']) || 'finance:*';

    return {
      userId,
      tenantId,
      roles: rolesStr.split(','),
      permissions: permsStr.split(','),
    };
  }

  private handleError(err: any, res: any, req: any): void {
    const correlationId = (req.headers && req.headers['x-correlation-id']) || 'N/A';

    if (err instanceof EInvoiceValidationError) {
      res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: err.message,
          fields: err.fields,
        },
        correlationId,
      });
      return;
    }

    if (err instanceof InvalidEInvoiceStateTransitionError) {
      res.status(409).json({
        success: false,
        error: {
          code: 'INVALID_STATE_TRANSITION',
          message: err.message,
        },
        correlationId,
      });
      return;
    }

    if (err instanceof EInvoiceDomainError) {
      let statusCode = 400;
      if (err.message.includes('Forbidden')) statusCode = 403;
      else if (err.message.includes('not found')) statusCode = 404;
      else if (err.message.includes('already exists') || err.message.includes('Optimistic')) statusCode = 409;
      else if (err.message.includes('Unsupported Media Type')) statusCode = 415;

      res.status(statusCode).json({
        success: false,
        error: {
          code: 'DOMAIN_ERROR',
          message: err.message,
        },
        correlationId,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected internal server error occurred',
      },
      correlationId,
    });
  }
}
