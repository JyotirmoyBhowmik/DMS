import { Survey } from '../../../domain/entities/survey.js';
import { SurveyRepository } from '../../../domain/repositories/survey.repository.js';
import { BusinessRuleViolationError } from '../../../domain/errors/domain-error.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class SurveyPgRepository implements SurveyRepository {
  private static inMemoryDb = new Map<string, any>();
  private hasDb = false;

  constructor(private db?: PostgresDatabaseClient) {
    if (this.db) {
      this.checkConnection().then(alive => {
        this.hasDb = alive;
      });
    }
  }

  static clearStore(): void {
    SurveyPgRepository.inMemoryDb.clear();
  }

  private async checkConnection(): Promise<boolean> {
    try {
      const res = await this.db!.checkHealth();
      return res.status === 'HEALTHY';
    } catch {
      return false;
    }
  }

  private isPgActive(): boolean {
    return this.hasDb;
  }

  async save(survey: Survey, tenantId: string): Promise<void> {
    if (!this.isPgActive()) {
      const key = `${tenantId}:${survey.id}`;
      const existing = SurveyPgRepository.inMemoryDb.get(key);
      if (existing) {
        if (existing.version !== survey.version) {
          throw new BusinessRuleViolationError('Optimistic locking conflict: version mismatch');
        }
        survey.incrementVersion();
      }
      // Check business unique key: unique (tenant_id, outlet_id, agent_id, title)
      for (const item of SurveyPgRepository.inMemoryDb.values()) {
        if (
          item.id !== survey.id &&
          item.tenantId === tenantId &&
          item.outletId === survey.outletId &&
          item.agentId === survey.agentId &&
          item.title.toLowerCase() === survey.title.toLowerCase()
        ) {
          throw new BusinessRuleViolationError(`Unique constraint violation: survey with title "${survey.title}" already exists for this agent and outlet`);
        }
      }
      SurveyPgRepository.inMemoryDb.set(key, survey.toJSON());
      return;
    }

    try {
      await this.db!.query('SET LOCAL app.tenant_id = $1', [tenantId]);

      const existing = await this.findById(survey.id, tenantId);
      if (existing) {
        if (existing.version !== survey.version) {
          throw new BusinessRuleViolationError('Optimistic locking conflict: version mismatch');
        }
        const nextVersion = survey.version + 1;
        const result = await this.db!.query(
          `UPDATE surveys
           SET title = $1, description = $2, status = $3, updated_at = $4, version = $5
           WHERE id = $6 AND tenant_id = $7 AND version = $8`,
          [
            survey.title,
            survey.description,
            survey.status,
            survey.updatedAt,
            nextVersion,
            survey.id,
            tenantId,
            survey.version,
          ]
        );

        if (result.rowCount === 0) {
          throw new BusinessRuleViolationError('Optimistic locking conflict or record missing during update');
        }
        survey.incrementVersion();
      } else {
        await this.db!.query(
          `INSERT INTO surveys (id, tenant_id, agent_id, outlet_id, title, description, status, created_at, updated_at, version)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            survey.id,
            tenantId,
            survey.agentId,
            survey.outletId,
            survey.title,
            survey.description,
            survey.status,
            survey.createdAt,
            survey.updatedAt,
            survey.version,
          ]
        );
      }
    } catch (err: any) {
      if (err.message.includes('unique') || err.message.includes('uq_surveys_business_key')) {
        throw new BusinessRuleViolationError(`Unique constraint violation: survey with title "${survey.title}" already exists for this agent and outlet`);
      }
      throw err;
    }
  }

  async findById(id: string, tenantId: string): Promise<Survey | null> {
    if (!this.isPgActive()) {
      const data = SurveyPgRepository.inMemoryDb.get(`${tenantId}:${id}`);
      if (!data) return null;
      return this.mapToEntity(data);
    }

    await this.db!.query('SET LOCAL app.tenant_id = $1', [tenantId]);
    const res = await this.db!.query(
      'SELECT * FROM surveys WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (res.rows.length === 0) return null;
    return this.mapToEntity(res.rows[0]);
  }

  async findByTitle(title: string, tenantId: string): Promise<Survey | null> {
    if (!this.isPgActive()) {
      for (const item of SurveyPgRepository.inMemoryDb.values()) {
        if (item.tenantId === tenantId && item.title.toLowerCase() === title.toLowerCase()) {
          return this.mapToEntity(item);
        }
      }
      return null;
    }

    await this.db!.query('SET LOCAL app.tenant_id = $1', [tenantId]);
    const res = await this.db!.query(
      'SELECT * FROM surveys WHERE LOWER(title) = LOWER($1) AND tenant_id = $2',
      [title, tenantId]
    );

    if (res.rows.length === 0) return null;
    return this.mapToEntity(res.rows[0]);
  }

  async list(options: {
    tenantId: string;
    agentId?: string;
    outletId?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: Survey[]; total: number; page: number; pageSize: number }> {
    const page = options.page || 1;
    const pageSize = Math.min(options.pageSize || 10, 100);
    const offset = (page - 1) * pageSize;

    if (!this.isPgActive()) {
      let list = Array.from(SurveyPgRepository.inMemoryDb.values()).filter(
        (t: any) => t.tenantId === options.tenantId
      );

      if (options.agentId) {
        list = list.filter((t: any) => t.agentId === options.agentId);
      }
      if (options.outletId) {
        list = list.filter((t: any) => t.outletId === options.outletId);
      }
      if (options.status) {
        list = list.filter((t: any) => t.status === options.status);
      }

      const total = list.length;
      const sliced = list.slice(offset, offset + pageSize);

      return {
        items: sliced.map((t) => this.mapToEntity(t)),
        total,
        page,
        pageSize,
      };
    }

    await this.db!.query('SET LOCAL app.tenant_id = $1', [options.tenantId]);

    let queryStr = 'SELECT * FROM surveys WHERE tenant_id = $1';
    let countQueryStr = 'SELECT COUNT(*)::INTEGER as count FROM surveys WHERE tenant_id = $1';
    const params: any[] = [options.tenantId];

    let paramIndex = 2;
    if (options.agentId) {
      queryStr += ` AND agent_id = $${paramIndex}`;
      countQueryStr += ` AND agent_id = $${paramIndex}`;
      params.push(options.agentId);
      paramIndex++;
    }
    if (options.outletId) {
      queryStr += ` AND outlet_id = $${paramIndex}`;
      countQueryStr += ` AND outlet_id = $${paramIndex}`;
      params.push(options.outletId);
      paramIndex++;
    }
    if (options.status) {
      queryStr += ` AND status = $${paramIndex}`;
      countQueryStr += ` AND status = $${paramIndex}`;
      params.push(options.status);
      paramIndex++;
    }

    queryStr += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    const paginatedParams = [...params, pageSize, offset];

    const [itemsRes, countRes] = await Promise.all([
      this.db!.query<any>(queryStr, paginatedParams),
      this.db!.query<{ count: number }>(countQueryStr, params),
    ]);

    return {
      items: itemsRes.rows.map((r) => this.mapToEntity(r)),
      total: countRes.rows[0]?.count ?? 0,
      page,
      pageSize,
    };
  }

  async delete(id: string, tenantId: string): Promise<void> {
    if (!this.isPgActive()) {
      SurveyPgRepository.inMemoryDb.delete(`${tenantId}:${id}`);
      return;
    }

    await this.db!.query('SET LOCAL app.tenant_id = $1', [tenantId]);
    await this.db!.query(
      'DELETE FROM surveys WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
  }

  private mapToEntity(row: any): Survey {
    return Survey.create({
      id: row.id,
      tenantId: row.tenantId || row.tenant_id,
      agentId: row.agentId || row.agent_id,
      outletId: row.outletId || row.outlet_id,
      title: row.title,
      description: row.description,
      status: row.status,
      createdAt: row.createdAt ? new Date(row.createdAt) : (row.created_at ? new Date(row.created_at) : undefined),
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : (row.updated_at ? new Date(row.updated_at) : undefined),
      version: row.version,
    });
  }
}
