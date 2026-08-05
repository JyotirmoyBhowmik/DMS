import { CreateTaxRuleUseCase } from '../../../application/usecases/create-tax-rule.usecase.js';
import { GetTaxRuleUseCase } from '../../../application/usecases/get-tax-rule.usecase.js';
import { UpdateTaxRuleUseCase } from '../../../application/usecases/update-tax-rule.usecase.js';
import { ListTaxRulesUseCase } from '../../../application/usecases/list-tax-rules.usecase.js';
import { TaxRulePgRepository } from '../../../infrastructure/database/repositories/tax_rule.pg-repository.js';
import { CreateTaxRuleSchema, UpdateTaxRuleSchema, QueryTaxRuleSchema } from '@dms/pkg-validation';
import { Principal } from '@dms/pkg-rbac';
import { StructuredLogger } from '@dms/pkg-logger';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { loadConfigSync } from '@dms/pkg-config';

const config = loadConfigSync();

export class TaxRuleController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private repo = new TaxRulePgRepository(this.db);
  private createUseCase = new CreateTaxRuleUseCase(this.repo);
  private getUseCase = new GetTaxRuleUseCase(this.repo);
  private updateUseCase = new UpdateTaxRuleUseCase(this.repo);
  private listUseCase = new ListTaxRulesUseCase(this.repo);
  private logger = new StructuredLogger('TaxRuleController');

  static clearStore(): void {
    TaxRulePgRepository.clearStore();
  }

  private buildPrincipal(headers: Record<string, string | undefined>): Principal {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    const roles = headers['x-user-roles'] ? (headers['x-user-roles'] as string).split(',') : ['admin'];
    return {
      id: headers['x-user-id'] || 'mock-user-uuid',
      tenantId,
      roles,
    };
  }

  async handleCreate(body: any, headers: Record<string, string | undefined>) {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    const idempotencyKey = headers['x-idempotency-key'];
    this.logger.info('Received HTTP POST tax rule request', { tenantId, idempotencyKey });
    const principal = this.buildPrincipal(headers);

    try {
      const parsed = CreateTaxRuleSchema.parse(body);
      const rule = await this.createUseCase.execute(principal, parsed, idempotencyKey);

      return {
        statusCode: 201,
        body: {
          success: true,
          taxRule: rule.toJSON(),
        },
      };
    } catch (err: any) {
      this.logger.warn('Validation or execution failed for create tax rule', { error: err.message });
      const isForbidden = err.message.includes('Forbidden') || err.message.includes('permission');
      const isConflict = err.message.includes('409 Conflict') || err.message.includes('already exists');
      return {
        statusCode: isForbidden ? 403 : (isConflict ? 409 : 400),
        body: { success: false, error: err.message },
      };
    }
  }

  async handleGet(id: string, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    try {
      const rule = await this.getUseCase.execute(principal, id);
      if (!rule) {
        return { statusCode: 404, body: { success: false, error: 'TaxRule record not found' } };
      }
      return { statusCode: 200, body: { success: true, taxRule: rule.toJSON() } };
    } catch (err: any) {
      const isForbidden = err.message.includes('Forbidden');
      return { statusCode: isForbidden ? 403 : 400, body: { success: false, error: err.message } };
    }
  }

  async handleUpdate(id: string, body: any, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    try {
      const parsed = UpdateTaxRuleSchema.parse(body);
      const updated = await this.updateUseCase.execute(principal, id, parsed);
      return { statusCode: 200, body: { success: true, taxRule: updated.toJSON() } };
    } catch (err: any) {
      const isForbidden = err.message.includes('Forbidden');
      const isConflict = err.message.includes('Conflict') || err.message.includes('version');
      const isNotFound = err.message.includes('not found');
      let statusCode = 400;
      if (isForbidden) statusCode = 403;
      else if (isConflict) statusCode = 409;
      else if (isNotFound) statusCode = 404;
      return { statusCode, body: { success: false, error: err.message } };
    }
  }

  async handleList(query: any, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    try {
      const parsed = QueryTaxRuleSchema.parse(query);
      const result = await this.listUseCase.execute(principal, parsed);
      return {
        statusCode: 200,
        body: {
          success: true,
          ...result,
          data: result.data.map(i => i.toJSON()),
        },
      };
    } catch (err: any) {
      const isForbidden = err.message.includes('Forbidden');
      return { statusCode: isForbidden ? 403 : 400, body: { success: false, error: err.message } };
    }
  }
}
