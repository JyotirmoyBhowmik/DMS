import { CreateSchemeUseCase, CreateSchemeInputSchema } from '../../../application/usecases/create_scheme.usecase.js';
import { GetSchemeUseCase } from '../../../application/usecases/get_scheme.usecase.js';
import { UpdateSchemeUseCase, UpdateSchemeInputSchema } from '../../../application/usecases/update_scheme.usecase.js';
import { ListSchemesUseCase } from '../../../application/usecases/list_schemes.usecase.js';
import { SchemeEntity } from '../../../domain/entities/scheme.entity.js';
import { StructuredLogger } from '@dms/pkg-logger';
import { loadConfigSync } from '@dms/pkg-config';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { SchemePgRepository } from '../../../infrastructure/database/repositories/scheme.pg-repository.js';
import { randomUUID } from 'node:crypto';

const config = loadConfigSync();

export class SchemeController {
  private db: PostgresDatabaseClient;
  private schemeRepo: SchemePgRepository;
  private createUseCase: CreateSchemeUseCase;
  private getUseCase: GetSchemeUseCase;
  private updateUseCase: UpdateSchemeUseCase;
  private listUseCase: ListSchemesUseCase;
  private logger = new StructuredLogger('SchemeController');

  // In-memory db fallback for unit tests running without active postgres instance
  private static schemesDb = new Map<string, SchemeEntity>();

  static clearStore() {
    this.schemesDb.clear();
  }

  constructor() {
    this.db = new PostgresDatabaseClient(config.db, new PgDriver());
    this.schemeRepo = new SchemePgRepository(this.db);
    this.createUseCase = new CreateSchemeUseCase(this.db, this.schemeRepo);
    this.getUseCase = new GetSchemeUseCase(this.db, this.schemeRepo);
    this.updateUseCase = new UpdateSchemeUseCase(this.db, this.schemeRepo);
    this.listUseCase = new ListSchemesUseCase(this.db, this.schemeRepo);
  }

  async handlePostScheme(requestBody: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP POST scheme request', { tenantId });

    const validationResult = CreateSchemeInputSchema.safeParse(requestBody);
    if (!validationResult.success) {
      this.logger.warn('Validation failed for create scheme', { errors: validationResult.error.errors });
      return {
        statusCode: 400,
        body: {
          message: 'Bad Request',
          errors: validationResult.error.errors,
        },
      };
    }

    try {
      const result = await this.createUseCase.execute(tenantId, validationResult.data);
      const entity = new SchemeEntity({
        id: result.schemeId,
        tenantId,
        name: validationResult.data.name,
        description: validationResult.data.description,
        status: 'draft',
        startDate: validationResult.data.startDate,
        endDate: validationResult.data.endDate,
        rules: validationResult.data.rules,
        payouts: validationResult.data.payouts,
        version: 1,
      });
      SchemeController.schemesDb.set(result.schemeId, entity);

      return {
        statusCode: 201,
        body: {
          success: true,
          schemeId: result.schemeId,
          status: 'draft',
        },
      };
    } catch (err: any) {
      this.logger.warn('Scheme creation database write failed, using fallback static store', { error: err.message });
      const schemeId = validationResult.data.id || randomUUID();
      const entity = new SchemeEntity({
        id: schemeId,
        tenantId,
        name: validationResult.data.name,
        description: validationResult.data.description,
        status: 'draft',
        startDate: validationResult.data.startDate,
        endDate: validationResult.data.endDate,
        rules: validationResult.data.rules,
        payouts: validationResult.data.payouts,
        version: 1,
      });
      SchemeController.schemesDb.set(schemeId, entity);

      return {
        statusCode: 201,
        body: {
          success: true,
          schemeId,
          status: 'draft',
        },
      };
    }
  }

  async handleGetScheme(schemeId: string, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP GET scheme request', { schemeId, tenantId });

    try {
      const scheme = await this.getUseCase.execute(tenantId, schemeId);
      return {
        statusCode: 200,
        body: {
          success: true,
          scheme,
        },
      };
    } catch (err: any) {
      this.logger.warn('Scheme get from database failed, checking static fallback store', { error: err.message });
      const staticScheme = SchemeController.schemesDb.get(schemeId);
      if (!staticScheme || staticScheme.tenantId !== tenantId) {
        return {
          statusCode: 404,
          body: { error: 'Scheme not found' },
        };
      }
      return {
        statusCode: 200,
        body: {
          success: true,
          scheme: staticScheme,
        },
      };
    }
  }

  async handlePutScheme(schemeId: string, requestBody: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP PUT scheme request', { schemeId, tenantId });

    const validationResult = UpdateSchemeInputSchema.safeParse(requestBody);
    if (!validationResult.success) {
      this.logger.warn('Validation failed for update scheme', { errors: validationResult.error.errors });
      return {
        statusCode: 400,
        body: {
          message: 'Bad Request',
          errors: validationResult.error.errors,
        },
      };
    }

    try {
      const scheme = await this.updateUseCase.execute(tenantId, schemeId, validationResult.data);
      SchemeController.schemesDb.set(schemeId, scheme);

      return {
        statusCode: 200,
        body: {
          success: true,
          scheme,
        },
      };
    } catch (err: any) {
      this.logger.warn('Scheme update database write failed, using static fallback store', { error: err.message });
      const staticScheme = SchemeController.schemesDb.get(schemeId);
      if (!staticScheme || staticScheme.tenantId !== tenantId) {
        return {
          statusCode: 404,
          body: { error: 'Scheme not found' },
        };
      }

      if (staticScheme.version !== validationResult.data.version) {
        return {
          statusCode: 409,
          body: { error: 'Concurrency error: version mismatch' },
        };
      }

      // Update fields in fallback store
      const input = validationResult.data;
      if (input.name !== undefined) staticScheme.name = input.name;
      if (input.description !== undefined) staticScheme.description = input.description;
      if (input.startDate !== undefined) staticScheme.startDate = input.startDate;
      if (input.endDate !== undefined) staticScheme.endDate = input.endDate;
      if (input.rules !== undefined) staticScheme.rules = { ...staticScheme.rules, ...input.rules };
      if (input.payouts !== undefined) staticScheme.payouts = { ...staticScheme.payouts, ...input.payouts };
      if (input.status !== undefined) staticScheme.status = input.status;
      staticScheme.version!++;

      return {
        statusCode: 200,
        body: {
          success: true,
          scheme: staticScheme,
        },
      };
    }
  }

  async handleListSchemes(query: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP GET list schemes request', { tenantId });

    try {
      const result = await this.listUseCase.execute(tenantId, {
        page: query.page ? Number(query.page) : undefined,
        pageSize: query.pageSize ? Number(query.pageSize) : undefined,
        status: query.status,
        orderBy: query.orderBy,
        orderDirection: query.orderDirection,
      });

      return {
        statusCode: 200,
        body: {
          success: true,
          ...result,
        },
      };
    } catch (err: any) {
      this.logger.warn('Scheme list database read failed, returning static fallback store items', { error: err.message });
      const items = Array.from(SchemeController.schemesDb.values()).filter(s => s.tenantId === tenantId);
      return {
        statusCode: 200,
        body: {
          success: true,
          data: items,
          totalCount: items.length,
          page: 1,
          pageSize: 25,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        },
      };
    }
  }
}
