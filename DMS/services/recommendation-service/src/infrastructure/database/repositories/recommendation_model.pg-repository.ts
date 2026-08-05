import { RecommendationModelAggregate, RecommendationModelType, RecommendationModelStatus } from '../../../domain/entities/recommendation_model.entity.js';
import { RecommendationModelFilter, RecommendationModelRepository } from '../../../domain/repositories/recommendation_model.repository.js';

export class RecommendationModelPgRepository implements RecommendationModelRepository {
  private inMemoryDb: Map<string, RecommendationModelAggregate>;

  constructor(
    private readonly pool?: any,
    sharedStore?: Map<string, RecommendationModelAggregate>
  ) {
    this.inMemoryDb = sharedStore ?? new Map<string, RecommendationModelAggregate>();
  }

  public async save(model: RecommendationModelAggregate): Promise<RecommendationModelAggregate> {
    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [model.tenantId]);

        const existing = await client.query(
          'SELECT version FROM recommendation_models WHERE id = $1 AND tenant_id = $2',
          [model.id, model.tenantId]
        );

        if (existing.rows.length > 0) {
          const currentVersion = existing.rows[0].version;
          if (currentVersion !== model.version - 1) {
            throw new Error(`Optimistic locking failure: expected version ${model.version - 1}, found ${currentVersion}`);
          }
          await client.query(
            `UPDATE recommendation_models 
             SET model_name = $1, model_type = $2, precision_at_k = $3, recall_at_k = $4, status = $5, hyperparameters = $6, version = $7, updated_at = NOW()
             WHERE id = $8 AND tenant_id = $9`,
            [
              model.modelName,
              model.modelType,
              model.precisionAtK ?? null,
              model.recallAtK ?? null,
              model.status,
              JSON.stringify(model.hyperparameters),
              model.version,
              model.id,
              model.tenantId
            ]
          );
        } else {
          await client.query(
            `INSERT INTO recommendation_models (id, tenant_id, model_name, model_type, precision_at_k, recall_at_k, status, hyperparameters, version, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              model.id,
              model.tenantId,
              model.modelName,
              model.modelType,
              model.precisionAtK ?? null,
              model.recallAtK ?? null,
              model.status,
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

  public async findById(id: string, tenantId: string): Promise<RecommendationModelAggregate | null> {
    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query(
          'SELECT * FROM recommendation_models WHERE id = $1 AND tenant_id = $2',
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

  public async findByName(modelName: string, tenantId: string): Promise<RecommendationModelAggregate | null> {
    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query(
          'SELECT * FROM recommendation_models WHERE model_name = $1 AND tenant_id = $2',
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

  public async findAll(filter: RecommendationModelFilter): Promise<{ models: RecommendationModelAggregate[]; total: number; page: number; pageSize: number }> {
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;

    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [filter.tenantId]);

        let query = 'SELECT * FROM recommendation_models WHERE tenant_id = $1';
        let countQuery = 'SELECT COUNT(*) FROM recommendation_models WHERE tenant_id = $1';
        const params: any[] = [filter.tenantId];
        let paramIdx = 2;

        if (filter.modelName) {
          query += ` AND model_name ILIKE $${paramIdx}`;
          countQuery += ` AND model_name ILIKE $${paramIdx}`;
          params.push(`%${filter.modelName}%`);
          paramIdx++;
        }
        if (filter.modelType) {
          query += ` AND model_type = $${paramIdx}`;
          countQuery += ` AND model_type = $${paramIdx}`;
          params.push(filter.modelType);
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

        query += ` ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
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
      if (filter.modelType) {
        items = items.filter(i => i.modelType === filter.modelType);
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
        const res = await client.query('DELETE FROM recommendation_models WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
        return (res.rowCount ?? 0) > 0;
      } finally {
        client.release();
      }
    } else {
      const key = `${tenantId}:${id}`;
      return this.inMemoryDb.delete(key);
    }
  }

  private mapToAggregate(row: any): RecommendationModelAggregate {
    const hyperparameters = typeof row.hyperparameters === 'string' ? JSON.parse(row.hyperparameters) : (row.hyperparameters ?? {});
    return new RecommendationModelAggregate({
      id: row.id,
      tenantId: row.tenant_id,
      modelName: row.model_name,
      modelType: row.model_type as RecommendationModelType,
      precisionAtK: row.precision_at_k !== null ? parseFloat(row.precision_at_k) : undefined,
      recallAtK: row.recall_at_k !== null ? parseFloat(row.recall_at_k) : undefined,
      status: row.status as RecommendationModelStatus,
      hyperparameters,
      version: row.version,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }
}
