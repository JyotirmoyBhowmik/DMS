import { BasePostgresRepository, BaseRow, PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { OrderApproval } from '../../../domain/entities/order-approval.js';
import { OrderApprovalRepository } from '../../../domain/repositories/order-approval.repository.js';
import { Money } from '../../../domain/value-objects/money.js';
import { StructuredLogger } from '@dms/pkg-logger';
import { loadConfigSync } from '@dms/pkg-config';

const config = loadConfigSync();

class PgOrderApprovalRepo extends BasePostgresRepository<OrderApproval> {
  async checkHealth() {
    return await this.db.checkHealth();
  }

  protected tableName(): string {
    return 'order_approvals';
  }

  protected mapToEntity(row: BaseRow): OrderApproval {
    return OrderApproval.reconstitute({
      id: row.id,
      tenantId: row.tenant_id,
      orderId: row.order_id as string,
      requestedBy: row.requested_by as string,
      approvedBy: row.approved_by as string | null,
      approvalLevel: row.approval_level as any,
      thresholdAmount: Money.of(Number(row.threshold_amount) / 100, row.threshold_currency as string),
      status: row.status as any,
      comments: row.comments as string | null,
      requestedAt: row.requested_at as Date,
      decidedAt: row.decided_at as Date | null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      version: row.version,
    });
  }

  protected mapToRow(entity: OrderApproval): BaseRow {
    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      order_id: entity.orderId,
      requested_by: entity.requestedBy,
      approved_by: entity.approvedBy,
      approval_level: entity.approvalLevel,
      threshold_amount: Math.round(entity.thresholdAmount.amount * 100),
      threshold_currency: entity.thresholdAmount.currency,
      status: entity.status,
      comments: entity.comments,
      requested_at: entity.requestedAt,
      decided_at: entity.decidedAt,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
      version: entity.version,
    };
  }
}

export class OrderApprovalPgRepository implements OrderApprovalRepository {
  private logger = new StructuredLogger('OrderApprovalPgRepository');
  private inMemoryDb: Map<string, OrderApproval> = new Map();
  private pgRepo: PgOrderApprovalRepo;
  private hasDb = false;

  constructor(db?: PostgresDatabaseClient) {
    const activeDb = db ?? new PostgresDatabaseClient(config.db, new PgDriver());
    this.pgRepo = new PgOrderApprovalRepo(activeDb);
    this.checkConnection().then(alive => {
      this.hasDb = alive;
    });
  }

  private async checkConnection(): Promise<boolean> {
    try {
      const res = await this.pgRepo.checkHealth();
      return res.status === 'HEALTHY';
    } catch {
      return false;
    }
  }

  async save(approval: OrderApproval): Promise<OrderApproval> {
    if (this.hasDb) {
      try {
        this.logger.info('Saving order approval to Postgres', { id: approval.id });
        return await this.pgRepo.save(approval, approval.tenantId);
      } catch (err: any) {
        this.logger.warn('Postgres save failed, falling back to memory', { error: err.message });
      }
    }
    this.inMemoryDb.set(approval.id, approval);
    return approval;
  }

  async update(approval: OrderApproval): Promise<OrderApproval> {
    if (this.hasDb) {
      try {
        this.logger.info('Updating order approval in Postgres', { id: approval.id });
        return await this.pgRepo.update(approval, approval.tenantId);
      } catch (err: any) {
        this.logger.warn('Postgres update failed, falling back to memory', { error: err.message });
      }
    }
    this.inMemoryDb.set(approval.id, approval);
    return approval;
  }

  async findById(id: string, tenantId: string): Promise<OrderApproval | null> {
    if (this.hasDb) {
      try {
        return await this.pgRepo.findById(id, tenantId);
      } catch (err: any) {
        this.logger.warn('Postgres findById failed, falling back to memory', { error: err.message });
      }
    }
    const match = this.inMemoryDb.get(id);
    if (match && match.tenantId === tenantId) {
      return match;
    }
    return null;
  }

  async findAll(tenantId: string): Promise<OrderApproval[]> {
    if (this.hasDb) {
      try {
        const result = await this.pgRepo.findAll(tenantId, { pageSize: 200 });
        return result.data;
      } catch (err: any) {
        this.logger.warn('Postgres findAll failed, falling back to memory', { error: err.message });
      }
    }
    return Array.from(this.inMemoryDb.values()).filter(a => a.tenantId === tenantId);
  }

  async findByOrder(orderId: string, tenantId: string): Promise<OrderApproval[]> {
    if (this.hasDb) {
      try {
        const result = await this.pgRepo.findAll(tenantId, {
          pageSize: 200,
          where: { order_id: orderId }
        });
        return result.data;
      } catch (err: any) {
        this.logger.warn('Postgres findByOrder failed, falling back to memory', { error: err.message });
      }
    }
    return Array.from(this.inMemoryDb.values()).filter(a => a.tenantId === tenantId && a.orderId === orderId);
  }

  async findByRequester(requestedBy: string, tenantId: string): Promise<OrderApproval[]> {
    if (this.hasDb) {
      try {
        const result = await this.pgRepo.findAll(tenantId, {
          pageSize: 200,
          where: { requested_by: requestedBy }
        });
        return result.data;
      } catch (err: any) {
        this.logger.warn('Postgres findByRequester failed, falling back to memory', { error: err.message });
      }
    }
    return Array.from(this.inMemoryDb.values()).filter(a => a.tenantId === tenantId && a.requestedBy === requestedBy);
  }

  async findPendingByLevel(level: number, tenantId: string): Promise<OrderApproval[]> {
    if (this.hasDb) {
      try {
        const result = await this.pgRepo.findAll(tenantId, {
          pageSize: 200,
          where: { approval_level: level, status: 'pending' }
        });
        return result.data;
      } catch (err: any) {
        this.logger.warn('Postgres findPendingByLevel failed, falling back to memory', { error: err.message });
      }
    }
    return Array.from(this.inMemoryDb.values()).filter(a => a.tenantId === tenantId && a.approvalLevel === level && a.status === 'pending');
  }

  async delete(id: string, tenantId: string): Promise<void> {
    if (this.hasDb) {
      try {
        await this.pgRepo.delete(id, tenantId);
        return;
      } catch (err: any) {
        this.logger.warn('Postgres delete failed, falling back to memory', { error: err.message });
      }
    }
    this.inMemoryDb.delete(id);
  }
}
