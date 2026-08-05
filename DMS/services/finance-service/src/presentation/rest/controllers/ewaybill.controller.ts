import { CreateEWayBillUseCase } from '../../../application/usecases/create-ewaybill.usecase.js';
import { GetEWayBillUseCase } from '../../../application/usecases/get-ewaybill.usecase.js';
import { UpdateEWayBillUseCase } from '../../../application/usecases/update-ewaybill.usecase.js';
import { ListEWayBillsUseCase } from '../../../application/usecases/list-ewaybills.usecase.js';
import { EWayBillDomainError, EWayBillValidationError, InvalidEWayBillStateTransitionError } from '../../../domain/entities/ewaybill.entity.js';
import { Principal } from '../../../application/usecases/create-invoice.usecase.js';

export class EWayBillController {
  constructor(
    private readonly createUseCase: CreateEWayBillUseCase,
    private readonly getUseCase: GetEWayBillUseCase,
    private readonly updateUseCase: UpdateEWayBillUseCase,
    private readonly listUseCase: ListEWayBillsUseCase
  ) {}

  async create(req: any, res: any): Promise<void> {
    try {
      this.validateHeaders(req);
      const principal = this.extractPrincipal(req);
      const correlationId = (req.headers && req.headers['x-correlation-id']) || 'N/A';
      const idempotencyKey = (req.headers && req.headers['x-idempotency-key']) as string | undefined;

      const ewaybill = await this.createUseCase.execute(principal, req.body, idempotencyKey, correlationId);

      res.status(201).json({
        success: true,
        data: ewaybill.toJSON(),
        correlationId,
      });
    } catch (err: any) {
      this.handleError(err, res, req);
    }
  }

  async getById(req: any, res: any): Promise<void> {
    try {
      const principal = this.extractPrincipal(req);
      const ewaybill = await this.getUseCase.execute(req.params.id, principal);

      res.status(200).json({
        success: true,
        data: ewaybill.toJSON(),
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

      const ewaybill = await this.updateUseCase.execute(req.params.id, principal, req.body, correlationId);

      res.status(200).json({
        success: true,
        data: ewaybill.toJSON(),
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
      throw new EWayBillDomainError('Unsupported Media Type: Content-Type must be application/json');
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

    if (err instanceof EWayBillValidationError) {
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

    if (err instanceof InvalidEWayBillStateTransitionError) {
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

    if (err instanceof EWayBillDomainError) {
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
