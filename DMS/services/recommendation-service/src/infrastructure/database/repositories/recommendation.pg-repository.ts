import { RecommendationAggregate, RecommendationTargetType, RecommendationType, RecommendationStatus } from '../../../domain/entities/recommendation.entity.js';
import { RecommendationFilter, RecommendationRepository } from '../../../domain/repositories/recommendation.repository.js';

export class RecommendationPgRepository implements RecommendationRepository {
  private inMemoryDb: Map<string, RecommendationAggregate>;

  constructor(
    private readonly pool?: any,
    sharedStore?: Map<string, RecommendationAggregate>
  ) {
    this.inMemoryDb = sharedStore ?? new Map<string, RecommendationAggregate>();
  }

  public async save(recommendation: RecommendationAggregate): Promise<RecommendationAggregate> {
    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [recommendation.tenantId]);
        
        const existing = await client.query(
          'SELECT version FROM recommendations WHERE id = $1 AND tenant_id = $2',
          [recommendation.id, recommendation.tenantId]
        );

        if (existing.rows.length > 0) {
          const currentVersion = existing.rows[0].version;
          if (currentVersion !== recommendation.version - 1) {
            throw new Error(`Optimistic locking failure: expected version ${recommendation.version - 1}, found ${currentVersion}`);
          }
          await client.query(
            `UPDATE recommendations 
             SET title = $1, target_type = $2, target_id = $3, recommendation_type = $4, score = $5, status = $6, payload = $7, version = $8, updated_at = NOW()
             WHERE id = $9 AND tenant_id = $10`,
            [
              recommendation.title,
              recommendation.targetType,
              recommendation.targetId,
              recommendation.recommendationType,
              recommendation.score,
              recommendation.status,
              JSON.stringify(recommendation.payload),
              recommendation.version,
              recommendation.id,
              recommendation.tenantId
            ]
          );
        } else {
          await client.query(
            `INSERT INTO recommendations (id, tenant_id, title, target_type, target_id, recommendation_type, score, status, payload, version, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              recommendation.id,
              recommendation.tenantId,
              recommendation.title,
              recommendation.targetType,
              recommendation.targetId,
              recommendation.recommendationType,
              recommendation.score,
              recommendation.status,
              JSON.stringify(recommendation.payload),
              recommendation.version,
              recommendation.createdAt,
              recommendation.updatedAt
            ]
          );
        }
      } finally {
        client.release();
      }
    } else {
      const key = `${recommendation.tenantId}:${recommendation.id}`;
      this.inMemoryDb.set(key, recommendation);
    }
    return recommendation;
  }

  public async findById(id: string, tenantId: string): Promise<RecommendationAggregate | null> {
    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query(
          'SELECT * FROM recommendations WHERE id = $1 AND tenant_id = $2',
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

  public async findByTitle(title: string, tenantId: string): Promise<RecommendationAggregate | null> {
    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query(
          'SELECT * FROM recommendations WHERE title = $1 AND tenant_id = $2',
          [title, tenantId]
        );
        if (res.rows.length === 0) return null;
        return this.mapToAggregate(res.rows[0]);
      } finally {
        client.release();
      }
    } else {
      const target = Array.from(this.inMemoryDb.values()).find(
        item => item.tenantId === tenantId && item.title === title
      );
      return target ?? null;
    }
  }

  public async findAll(filter: RecommendationFilter): Promise<{ recommendations: RecommendationAggregate[]; total: number; page: number; pageSize: number }> {
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;

    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [filter.tenantId]);
        
        let query = 'SELECT * FROM recommendations WHERE tenant_id = $1';
        let countQuery = 'SELECT COUNT(*) FROM recommendations WHERE tenant_id = $1';
        const params: any[] = [filter.tenantId];
        let paramIdx = 2;

        if (filter.title) {
          query += ` AND title ILIKE $${paramIdx}`;
          countQuery += ` AND title ILIKE $${paramIdx}`;
          params.push(`%${filter.title}%`);
          paramIdx++;
        }
        if (filter.targetType) {
          query += ` AND target_type = $${paramIdx}`;
          countQuery += ` AND target_type = $${paramIdx}`;
          params.push(filter.targetType);
          paramIdx++;
        }
        if (filter.targetId) {
          query += ` AND target_id = $${paramIdx}`;
          countQuery += ` AND target_id = $${paramIdx}`;
          params.push(filter.targetId);
          paramIdx++;
        }
        if (filter.recommendationType) {
          query += ` AND recommendation_type = $${paramIdx}`;
          countQuery += ` AND recommendation_type = $${paramIdx}`;
          params.push(filter.recommendationType);
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

        const sortBy = filter.sortBy === 'title' ? 'title' : filter.sortBy === 'score' ? 'score' : 'created_at';
        const sortOrder = filter.sortOrder === 'asc' ? 'ASC' : 'DESC';
        query += ` ORDER BY ${sortBy} ${sortOrder} LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
        params.push(pageSize, (page - 1) * pageSize);

        const res = await client.query(query, params);
        const recommendations = res.rows.map((r: any) => this.mapToAggregate(r));

        return { recommendations, total, page, pageSize };
      } finally {
        client.release();
      }
    } else {
      let items = Array.from(this.inMemoryDb.values()).filter(item => item.tenantId === filter.tenantId);

      if (filter.title) {
        const q = filter.title.toLowerCase();
        items = items.filter(i => i.title.toLowerCase().includes(q));
      }
      if (filter.targetType) {
        items = items.filter(i => i.targetType === filter.targetType);
      }
      if (filter.targetId) {
        items = items.filter(i => i.targetId === filter.targetId);
      }
      if (filter.recommendationType) {
        items = items.filter(i => i.recommendationType === filter.recommendationType);
      }
      if (filter.status) {
        items = items.filter(i => i.status === filter.status);
      }

      const total = items.length;
      items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const start = (page - 1) * pageSize;
      const paginated = items.slice(start, start + pageSize);

      return { recommendations: paginated, total, page, pageSize };
    }
  }

  public async delete(id: string, tenantId: string): Promise<boolean> {
    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query('DELETE FROM recommendations WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
        return (res.rowCount ?? 0) > 0;
      } finally {
        client.release();
      }
    } else {
      const key = `${tenantId}:${id}`;
      return this.inMemoryDb.delete(key);
    }
  }

  private mapToAggregate(row: any): RecommendationAggregate {
    const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : (row.payload ?? {});
    return new RecommendationAggregate({
      id: row.id,
      tenantId: row.tenant_id,
      title: row.title,
      targetType: row.target_type as RecommendationTargetType,
      targetId: row.target_id,
      recommendationType: row.recommendation_type as RecommendationType,
      score: parseFloat(row.score),
      status: row.status as RecommendationStatus,
      payload,
      version: row.version,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }
}
