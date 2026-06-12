import { BasePostgresRepository, BaseRow, PostgresDatabaseClient, EntityNotFoundError } from '@dms/pkg-database';
import { Distributor } from '../../../domain/entities/distributor.js';
import { DistributorRepository } from '../../../domain/repositories/distributor.repository.js';

export class DistributorPgRepository extends BasePostgresRepository<Distributor> implements DistributorRepository {
  constructor(db: PostgresDatabaseClient) {
    super(db);
  }

  protected tableName(): string {
    return 'distributors';
  }

  protected mapToEntity(row: BaseRow): Distributor {
    return new Distributor(
      row.id as string,
      row.tenant_id as string,
      row.name as string,
      row.region as string,
      Number(row.credit_limit),
      Number(row.balance)
    );
  }

  protected mapToRow(entity: Distributor): BaseRow {
    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      name: entity.name,
      region: entity.region,
      credit_limit: entity.creditLimit,
      balance: entity.balance,
      version: 1,
      created_at: new Date(),
      updated_at: new Date(),
    };
  }

  async findByRegion(region: string, tenantId: string): Promise<Distributor[]> {
    const sql = `SELECT * FROM "${this.tableName()}" WHERE "region" = $1 AND "tenant_id" = $2`;
    const result = await this.db.query<BaseRow>(sql, [region, tenantId], tenantId);
    return result.rows.map(r => this.mapToEntity(r));
  }
}
