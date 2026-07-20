import { BasePostgresRepository, BaseRow, PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { VanSale, LoadedItem, SoldItem, ReturnedItem } from '../../../domain/entities/van-sale.js';
import { VanSaleRepository } from '../../../domain/repositories/van-sale.repository.js';
import { Money } from '../../../domain/value-objects/money.js';
import { StructuredLogger } from '@dms/pkg-logger';
import { loadConfigSync } from '@dms/pkg-config';

const config = loadConfigSync();

class PgVanSaleRepo extends BasePostgresRepository<VanSale> {
  async checkHealth() {
    return await this.db.checkHealth();
  }

  async query<T = unknown>(sql: string, params?: unknown[], tenantId?: string) {
    return await this.db.query<T>(sql, params, tenantId);
  }

  override tableName(): string {
    return 'van_sales';
  }

  public override mapToEntity(row: BaseRow): VanSale {
    let loadedItems: LoadedItem[] = [];
    if (typeof row.loaded_items === 'string') {
      try {
        loadedItems = JSON.parse(row.loaded_items);
      } catch {
        loadedItems = [];
      }
    } else if (Array.isArray(row.loaded_items)) {
      loadedItems = row.loaded_items as any;
    }

    let soldItems: SoldItem[] = [];
    if (typeof row.sold_items === 'string') {
      try {
        soldItems = JSON.parse(row.sold_items);
      } catch {
        soldItems = [];
      }
    } else if (Array.isArray(row.sold_items)) {
      soldItems = row.sold_items as any;
    }

    let returnedItems: ReturnedItem[] = [];
    if (typeof row.returned_items === 'string') {
      try {
        returnedItems = JSON.parse(row.returned_items);
      } catch {
        returnedItems = [];
      }
    } else if (Array.isArray(row.returned_items)) {
      returnedItems = row.returned_items as any;
    }

    // Date can come back as a Date object or string from pg node driver depending on parsing
    let dateStr = '';
    if (row.date instanceof Date) {
      dateStr = row.date.toISOString().split('T')[0]!;
    } else {
      dateStr = String(row.date);
    }

    return VanSale.reconstitute({
      id: row.id,
      tenantId: row.tenant_id,
      agentId: row.agent_id as string,
      vehicleId: row.vehicle_id as string,
      routeId: row.route_id as string,
      date: dateStr,
      loadedItems,
      soldItems,
      returnedItems,
      cashCollected: Money.fromCents(Number(row.cash_collected || 0), row.cash_currency as string || 'INR'),
      digitalPayments: Money.fromCents(Number(row.digital_payments || 0), row.digital_currency as string || 'INR'),
      status: row.status as any,
      createdAt: row.created_at ? new Date(row.created_at as any) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at as any) : new Date(),
      version: row.version || 1,
    });
  }

  protected mapToRow(entity: VanSale): BaseRow {
    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      agent_id: entity.agentId,
      vehicle_id: entity.vehicleId,
      route_id: entity.routeId,
      date: entity.date,
      loaded_items: JSON.stringify(entity.loadedItems) as any,
      sold_items: JSON.stringify(entity.soldItems) as any,
      returned_items: JSON.stringify(entity.returnedItems) as any,
      cash_collected: entity.cashCollected.cents,
      cash_currency: entity.cashCollected.currency,
      digital_payments: entity.digitalPayments.cents,
      digital_currency: entity.digitalPayments.currency,
      status: entity.status,
      version: entity.version,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}

export class VanSalePgRepository implements VanSaleRepository {
  private logger = new StructuredLogger('VanSalePgRepository');
  public static inMemoryDb: Map<string, VanSale> = new Map();
  private pgRepo: PgVanSaleRepo;
  private hasDb = false;

  constructor(db?: PostgresDatabaseClient) {
    const activeDb = db ?? new PostgresDatabaseClient(config.db, new PgDriver());
    this.pgRepo = new PgVanSaleRepo(activeDb);
    this.checkConnection().then(alive => {
      this.hasDb = alive;
    });
  }

  public static clearStore(): void {
    VanSalePgRepository.inMemoryDb.clear();
  }

  private async checkConnection(): Promise<boolean> {
    try {
      const res = await this.pgRepo.checkHealth();
      return res.status === 'HEALTHY';
    } catch {
      return false;
    }
  }

  async save(vanSale: VanSale): Promise<VanSale> {
    if (this.hasDb) {
      try {
        this.logger.info('Saving VanSale to Postgres', { id: vanSale.id, tenantId: vanSale.tenantId });
        return await this.pgRepo.save(vanSale, vanSale.tenantId);
      } catch (err: any) {
        this.logger.warn('Failed to save to Postgres, falling back to memory', { error: err.message });
      }
    }
    // Also update in-memory store
    VanSalePgRepository.inMemoryDb.set(vanSale.id, vanSale);
    return vanSale;
  }

  async findById(id: string, tenantId: string): Promise<VanSale | null> {
    if (this.hasDb) {
      try {
        this.logger.info('Finding VanSale by ID from Postgres', { id, tenantId });
        return await this.pgRepo.findById(id, tenantId);
      } catch (err: any) {
        this.logger.warn('Failed to find in Postgres, falling back to memory', { error: err.message });
      }
    }
    const match = VanSalePgRepository.inMemoryDb.get(id);
    if (match && match.tenantId === tenantId) {
      return match;
    }
    return null;
  }

  async findAll(tenantId: string): Promise<VanSale[]> {
    if (this.hasDb) {
      try {
        const res = await this.pgRepo.findAll(tenantId, { pageSize: 500 });
        return res.data;
      } catch (err: any) {
        this.logger.warn('Failed to findAll in Postgres, falling back to memory', { error: err.message });
      }
    }
    return Array.from(VanSalePgRepository.inMemoryDb.values()).filter(v => v.tenantId === tenantId);
  }

  async findByAgent(agentId: string, tenantId: string): Promise<VanSale[]> {
    if (this.hasDb) {
      try {
        const sql = `SELECT * FROM "van_sales" WHERE "agent_id" = $1 AND "tenant_id" = $2`;
        const res = await this.pgRepo.query<BaseRow>(sql, [agentId, tenantId], tenantId);
        return res.rows.map(row => this.pgRepo.mapToEntity(row));
      } catch (err: any) {
        this.logger.warn('Failed to findByAgent in Postgres, falling back to memory', { error: err.message });
      }
    }
    return Array.from(VanSalePgRepository.inMemoryDb.values()).filter(
      v => v.tenantId === tenantId && v.agentId === agentId
    );
  }

  async findByVehicle(vehicleId: string, tenantId: string): Promise<VanSale[]> {
    if (this.hasDb) {
      try {
        const sql = `SELECT * FROM "van_sales" WHERE "vehicle_id" = $1 AND "tenant_id" = $2`;
        const res = await this.pgRepo.query<BaseRow>(sql, [vehicleId, tenantId], tenantId);
        return res.rows.map(row => this.pgRepo.mapToEntity(row));
      } catch (err: any) {
        this.logger.warn('Failed to findByVehicle in Postgres, falling back to memory', { error: err.message });
      }
    }
    return Array.from(VanSalePgRepository.inMemoryDb.values()).filter(
      v => v.tenantId === tenantId && v.vehicleId === vehicleId
    );
  }

  async findByRoute(routeId: string, tenantId: string): Promise<VanSale[]> {
    if (this.hasDb) {
      try {
        const sql = `SELECT * FROM "van_sales" WHERE "route_id" = $1 AND "tenant_id" = $2`;
        const res = await this.pgRepo.query<BaseRow>(sql, [routeId, tenantId], tenantId);
        return res.rows.map(row => this.pgRepo.mapToEntity(row));
      } catch (err: any) {
        this.logger.warn('Failed to findByRoute in Postgres, falling back to memory', { error: err.message });
      }
    }
    return Array.from(VanSalePgRepository.inMemoryDb.values()).filter(
      v => v.tenantId === tenantId && v.routeId === routeId
    );
  }

  async delete(id: string, tenantId: string): Promise<void> {
    if (this.hasDb) {
      try {
        await this.pgRepo.delete(id, tenantId);
        return;
      } catch (err: any) {
        this.logger.warn('Failed to delete in Postgres, falling back to memory', { error: err.message });
      }
    }
    VanSalePgRepository.inMemoryDb.delete(id);
  }
}
