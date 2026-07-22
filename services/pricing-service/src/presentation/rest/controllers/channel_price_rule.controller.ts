import { CreateChannelPriceRuleUseCase } from '../../../application/usecases/create-channel-price-rule.usecase.js';
import { GetChannelPriceRuleUseCase } from '../../../application/usecases/get-channel-price-rule.usecase.js';
import { UpdateChannelPriceRuleUseCase } from '../../../application/usecases/update-channel-price-rule.usecase.js';
import { ListChannelPriceRulesUseCase } from '../../../application/usecases/list-channel-price-rules.usecase.js';
import { ChannelPriceRulePgRepository } from '../../../infrastructure/database/repositories/channel_price_rule.pg-repository.js';
import { CreateChannelPriceRuleSchema, UpdateChannelPriceRuleSchema, QueryChannelPriceRuleSchema } from '@dms/pkg-validation';
import { Principal } from '@dms/pkg-rbac';
import { StructuredLogger } from '@dms/pkg-logger';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { loadConfigSync } from '@dms/pkg-config';

const config = loadConfigSync();

export class ChannelPriceRuleController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private repo = new ChannelPriceRulePgRepository(this.db);
  private createUseCase = new CreateChannelPriceRuleUseCase(this.repo);
  private getUseCase = new GetChannelPriceRuleUseCase(this.repo);
  private updateUseCase = new UpdateChannelPriceRuleUseCase(this.repo);
  private listUseCase = new ListChannelPriceRulesUseCase(this.repo);
  private logger = new StructuredLogger('ChannelPriceRuleController');

  static clearStore(): void {
    ChannelPriceRulePgRepository.clearStore();
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
    this.logger.info('Received HTTP POST channel price rule request', { tenantId, idempotencyKey });
    const principal = this.buildPrincipal(headers);

    try {
      const parsed = CreateChannelPriceRuleSchema.parse(body);
      const rule = await this.createUseCase.execute(principal, parsed, idempotencyKey);

      return {
        statusCode: 201,
        body: {
          success: true,
          channelPriceRule: rule.toJSON(),
        },
      };
    } catch (err: any) {
      this.logger.warn('Validation or execution failed for create channel price rule', { error: err.message });
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
        return { statusCode: 404, body: { success: false, error: 'ChannelPriceRule record not found' } };
      }
      return { statusCode: 200, body: { success: true, channelPriceRule: rule.toJSON() } };
    } catch (err: any) {
      const isForbidden = err.message.includes('Forbidden');
      return { statusCode: isForbidden ? 403 : 400, body: { success: false, error: err.message } };
    }
  }

  async handleUpdate(id: string, body: any, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    try {
      const parsed = UpdateChannelPriceRuleSchema.parse(body);
      const updated = await this.updateUseCase.execute(principal, id, parsed);
      return { statusCode: 200, body: { success: true, channelPriceRule: updated.toJSON() } };
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
      const parsed = QueryChannelPriceRuleSchema.parse(query);
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
