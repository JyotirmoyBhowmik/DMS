import { ForecastModelAggregate, ForecastAlgorithm, ForecastModelStatus } from '../../../domain/entities/forecast_model.entity.js';
import { ForecastModelFilter, ForecastModelRepository } from '../../../domain/repositories/forecast_model.repository.js';

export class ForecastModelPgRepository implements ForecastModelRepository {
  private inMemoryDb: Map<string, ForecastModelAggregate>;

  constructor(
    private readonly pool?: any,
    sharedStore?: Map<string, ForecastModelAggregate>
  ) {
    this.inMemoryDb = sharedStore ?? new Map<string, ForecastModelAggregate>();
  }

  public async save(model: ForecastModelAggregate): Promise<ForecastModelAggregate> {
    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [model.tenantId]);
        
        const existing = await client.query(
          'SELECT version FROM forecast_models WHERE id = $1 AND tenant_id = $2',
          [model.id, model.tenantId]
        );

        if (existing.rows.length > 0) {
          const currentVersion = existing.rows[0].version;
          if (currentVersion !== model.version - 1) {
            throw new Error(`Optimistic locking failure: expected version ${model.version - 1}, found ${currentVersion}`);
          }
          await client.query(
            `UPDATE forecast_models 
             SET model_name = $1, algorithm = $2, status = $3, accuracy_mape = $4, accuracy_rmse = $5, hyperparameters = $6, version = $7, updated_at = NOW()
             WHERE id = $8 AND tenant_id = $9`,
            [
              model.modelName,
              model.algorithm,
              model.status,
              model.accuracyMape ?? null,
              model.accuracyRmse ?? null,
              JSON.stringify(model.hyperparameters),
              model.version,
              model.id,
              model.tenantId
            ]
          );
        } else {
          await client.query(
            `INSERT INTO forecast_models (id, tenant_id, model_name, algorithm, status, accuracy_mape, accuracy_rmse, hyperparameters, version, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              model.id,
              model.tenantId,
              model.modelName,
              model.algorithm,
              model.status,
              model.accuracyMape ?? null,
              model.accuracyRmse ?? null,
              JSON.stringify(model.hyperparameters),
              model.version,
              model.createdAt,
              model.updatedAt
            ]
          );
        }
      } finally {
        client.release();
      }
    } else {
      const key = `${model.tenantId}:${model.id}`;
      this.inMemoryDb.set(key, model);
    }
    return model;
  }

  public async findById(id: string, tenantId: string): Promise<ForecastModelAggregate | null> {
    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query(
          'SELECT * FROM forecast_models WHERE id = $1 AND tenant_id = $2',
          [id, tenantId]
        );
        if (res.rows.length === 0) return null;
        return this.mapToAggregate(res.rows[0]);
      } finally {
        client.release();
      }
    } else {
      const key = `${tenantId}:${id}`;
      const item = this.inMemoryDb.get(key);
      return item ?? null;
    }
  }

  public async findByName(modelName: string, tenantId: string): Promise<ForecastModelAggregate | null> {
    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query(
          'SELECT * FROM forecast_models WHERE model_name = $1 AND tenant_id = $2',
          [modelName, tenantId]
        );
        if (res.rows.length === 0) return null;
        return this.mapToAggregate(res.rows[0]);
      } finally {
        client.release();
      }
    } else {
      const target = Array.from(this.inMemoryDb.values()).find(
        item => item.tenantId === tenantId && item.modelName === modelName
      );
      return target ?? null;
    }
  }

  public async findAll(filter: ForecastModelFilter): Promise<{ models: ForecastModelAggregate[]; total: number; page: number; pageSize: number }> {
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;

    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [filter.tenantId]);
        
        let query = 'SELECT * FROM forecast_models WHERE tenant_id = $1';
        let countQuery = 'SELECT COUNT(*) FROM forecast_models WHERE tenant_id = $1';
        const params: any[] = [filter.tenantId];
        let paramIdx = 2;

        if (filter.modelName) {
          query += ` AND model_name ILIKE $${paramIdx}`;
          countQuery += ` AND model_name ILIKE $${paramIdx}`;
          params.push(`%${filter.modelName}%`);
          paramIdx++;
        }
        if (filter.algorithm) {
          query += ` AND algorithm = $${paramIdx}`;
          countQuery += ` AND algorithm = $${paramIdx}`;
          params.push(filter.algorithm);
          paramIdx++;
        }
        if (filter.status) {
          query += ` AND status = $${paramIdx}`;
          countQuery += ` AND status = $${paramIdx}`;
          params.push(filter.status);
          paramIdx++;
        }

        const countRes = await client.query(countQuery, params);
        const total = parseInt(countRes.rows[0].count, 10);

        const sortBy = filter.sortBy === 'modelName' ? 'model_name' : 'created_at';
        const sortOrder = filter.sortOrder === 'asc' ? 'ASC' : 'DESC';
        query += ` ORDER BY ${sortBy} ${sortOrder} LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
        params.push(pageSize, (page - 1) * pageSize);

        const res = await client.query(query, params);
        const models = res.rows.map((r: any) => this.mapToAggregate(r));

        return { models, total, page, pageSize };
      } finally {
        client.release();
      }
    } else {
      let items = Array.from(this.inMemoryDb.values()).filter(item => item.tenantId === filter.tenantId);

      if (filter.modelName) {
        const q = filter.modelName.toLowerCase();
        items = items.filter(i => i.modelName.toLowerCase().includes(q));
      }
      if (filter.algorithm) {
        items = items.filter(i => i.algorithm === filter.algorithm);
      }
      if (filter.status) {
        items = items.filter(i => i.status === filter.status);
      }

      const total = items.length;
      items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const start = (page - 1) * pageSize;
      const paginated = items.slice(start, start + pageSize);

      return { models: paginated, total, page, pageSize };
    }
  }

  public async delete(id: string, tenantId: string): Promise<boolean> {
    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query('DELETE FROM forecast_models WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
        return (res.rowCount ?? 0) > 0;
      } finally {
        client.release();
      }
    } else {
      const key = `${tenantId}:${id}`;
      return this.inMemoryDb.delete(key);
    }
  }

  private mapToAggregate(row: any): ForecastModelAggregate {
    const hyper = typeof row.hyperparameters === 'string' ? JSON.parse(row.hyperparameters) : (row.hyperparameters ?? {});
    return new ForecastModelAggregate({
      id: row.id,
      tenantId: row.tenant_id,
      modelName: row.model_name,
      algorithm: row.algorithm as ForecastAlgorithm,
      status: row.status as ForecastModelStatus,
      accuracyMape: row.accuracy_mape ? parseFloat(row.accuracy_mape) : undefined,
      accuracyRmse: row.accuracy_rmse ? parseFloat(row.accuracy_rmse) : undefined,
      hyperparameters: hyper,
      version: row.version,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }
}
