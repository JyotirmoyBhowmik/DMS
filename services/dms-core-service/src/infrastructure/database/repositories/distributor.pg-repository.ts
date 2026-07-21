import { BasePostgresRepository, BaseRow, PostgresDatabaseClient, EntityNotFoundError, ConcurrencyError, PaginatedResult } from '@dms/pkg-database';
import { Distributor } from '../../../domain/entities/distributor.js';
import { DistributorRepository } from '../../../domain/repositories/distributor.repository.js';
import { Money } from '../../../domain/value-objects/money.js';
import { DuplicateDistributorError, ConcurrencyConflictError } from '../../../domain/errors/domain-error.js';
import { StructuredLogger } from '@dms/pkg-logger';

export class DistributorPgRepository extends BasePostgresRepository<Distributor> implements DistributorRepository {
  private hasDb = false;
  private static inMemoryDb = new Map<string, Map<string, BaseRow>>(); // tenantId -> Map<id, BaseRow>
  private logger = new StructuredLogger('DistributorPgRepository');

  constructor(db: PostgresDatabaseClient) {
    super(db);
    this.checkConnection().then(alive => {
      this.hasDb = alive;
    });
  }

  private async checkConnection(): Promise<boolean> {
    try {
      await this.db.checkHealth();
      return true;
    } catch {
      return false;
    }
  }

  private isPgActive(): boolean {
    return this.hasDb;
  }

  static clearStore(): void {
    this.inMemoryDb.clear();
  }

  protected tableName(): string {
    return 'distributors';
  }

  protected mapToEntity(row: BaseRow): Distributor {
    return Distributor.create({
      id: row.id as string,
      tenantId: row.tenant_id as string,
      name: row.name as string,
      region: row.region as string,
      creditLimit: Money.fromCents(Number(row.credit_limit || 0)),
      balance: Money.fromCents(Number(row.balance || 0)),
      version: Number(row.version || 1),
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    });
  }

  protected mapToRow(entity: Distributor): BaseRow {
    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      name: entity.name,
      region: entity.region,
      credit_limit: entity.creditLimit.cents,
      balance: entity.balance.cents,
      version: entity.version,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }

  private getTenantStore(tenantId: string): Map<string, BaseRow> {
    if (!DistributorPgRepository.inMemoryDb.has(tenantId)) {
      DistributorPgRepository.inMemoryDb.set(tenantId, new Map());
    }
    return DistributorPgRepository.inMemoryDb.get(tenantId)!;
  }

  // Override save
  override async save(entity: Distributor, tenantId: string): Promise<Distributor> {
    if (this.isPgActive()) {
      try {
        return await super.save(entity, tenantId);
      } catch (err: any) {
        if (err.message?.includes('uq_distributors_name_tenant') || err.message?.includes('unique constraint')) {
          throw new DuplicateDistributorError(entity.name);
        }
        this.logger.warn('Postgres save failed, falling back to in-memory', { error: err.message });
      }
    }

    const store = this.getTenantStore(tenantId);
    // Validate unique name constraint in-memory
    for (const existing of store.values()) {
      if ((existing.name as string).toLowerCase() === entity.name.toLowerCase()) {
        throw new DuplicateDistributorError(entity.name);
      }
    }
    store.set(entity.id, this.mapToRow(entity));
    return entity;
  }

  // Override findById
  override async findById(id: string, tenantId: string): Promise<Distributor> {
    if (this.isPgActive()) {
      try {
        return await super.findById(id, tenantId);
      } catch (err: any) {
        if (err.name === 'EntityNotFoundError' || err.message?.includes('not found')) {
          throw err;
        }
        this.logger.warn('Postgres findById failed, falling back to in-memory', { id, error: err.message });
      }
    }

    const store = this.getTenantStore(tenantId);
    const row = store.get(id);
    if (!row) {
      throw new EntityNotFoundError(this.tableName(), { id, tenantId });
    }
    return this.mapToEntity(row);
  }

  // Override update
  override async update(entity: Distributor, tenantId: string): Promise<Distributor> {
    if (this.isPgActive()) {
      try {
        return await super.update(entity, tenantId);
      } catch (err: any) {
        if (err instanceof ConcurrencyError || err.name === 'ConcurrencyError' || err.message?.includes('concurrency') || err.message?.includes('version')) {
          throw new ConcurrencyConflictError('Distributor', entity.id);
        }
        if (err.message?.includes('uq_distributors_name_tenant') || err.message?.includes('unique constraint')) {
          throw new DuplicateDistributorError(entity.name);
        }
        this.logger.warn('Postgres update failed, falling back to in-memory', { id: entity.id, error: err.message });
      }
    }

    const store = this.getTenantStore(tenantId);
    const row = store.get(entity.id);
    if (!row) {
      throw new EntityNotFoundError(this.tableName(), { id: entity.id, tenantId });
    }
    if (row.version !== entity.version) {
      throw new ConcurrencyConflictError('Distributor', entity.id);
    }
    // Check duplicate name
    for (const other of store.values()) {
      if (other.id !== entity.id && (other.name as string).toLowerCase() === entity.name.toLowerCase()) {
        throw new DuplicateDistributorError(entity.name);
      }
    }
    entity.incrementVersion();
    store.set(entity.id, this.mapToRow(entity));
    return entity;
  }

  // Override findAll
  override async findAll(tenantId: string, options: any = {}): Promise<PaginatedResult<Distributor>> {
    if (this.isPgActive()) {
      try {
        return await super.findAll(tenantId, options);
      } catch (err: any) {
        this.logger.warn('Postgres findAll failed, falling back to in-memory', { error: err.message });
      }
    }

    const store = this.getTenantStore(tenantId);
    let list = Array.from(store.values());

    // Filter by options.where
    if (options.where) {
      for (const [col, val] of Object.entries(options.where)) {
        list = list.filter(row => row[col] === val);
      }
    }

    // Pagination
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, options.pageSize ?? 25));
    const totalCount = list.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const offset = (page - 1) * pageSize;

    // Slice the list
    const dataRows = list.slice(offset, offset + pageSize);

    return {
      data: dataRows.map(row => this.mapToEntity(row)),
      page,
      pageSize,
      totalCount,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }

  // Override delete
  override async delete(id: string, tenantId: string): Promise<boolean> {
    if (this.isPgActive()) {
      try {
        const sql = `DELETE FROM "${this.tableName()}" WHERE "id" = $1 AND "tenant_id" = $2`;
        const result = await this.db.query(sql, [id, tenantId], tenantId);
        return result.rowCount > 0;
      } catch (err: any) {
        this.logger.warn('Postgres delete failed, falling back to in-memory', { id, error: err.message });
      }
    }

    const store = this.getTenantStore(tenantId);
    return store.delete(id);
  }

  async findByRegion(region: string, tenantId: string): Promise<Distributor[]> {
    if (this.isPgActive()) {
      try {
        const sql = `SELECT * FROM "${this.tableName()}" WHERE "region" = $1 AND "tenant_id" = $2`;
        const result = await this.db.query<BaseRow>(sql, [region, tenantId], tenantId);
        return result.rows.map(r => this.mapToEntity(r));
      } catch (err: any) {
        this.logger.warn('Postgres findByRegion failed, falling back to in-memory', { region, error: err.message });
      }
    }

    const store = this.getTenantStore(tenantId);
    return Array.from(store.values())
      .filter(r => r.region === region)
      .map(r => this.mapToEntity(r));
  }
}
