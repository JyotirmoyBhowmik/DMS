import { ReportScheduleAggregate, ScheduleFrequency, ScheduleStatus } from '../../../domain/entities/report_schedule.entity.js';
import { ReportScheduleFilter, ReportScheduleRepository } from '../../../domain/repositories/report_schedule.repository.js';

export class ReportSchedulePgRepository implements ReportScheduleRepository {
  private inMemoryDb: Map<string, ReportScheduleAggregate>;

  constructor(
    private readonly pool?: any,
    sharedStore?: Map<string, ReportScheduleAggregate>
  ) {
    this.inMemoryDb = sharedStore ?? new Map<string, ReportScheduleAggregate>();
  }

  public async save(schedule: ReportScheduleAggregate): Promise<ReportScheduleAggregate> {
    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [schedule.tenantId]);
        
        const existing = await client.query(
          'SELECT version FROM report_schedules WHERE id = $1 AND tenant_id = $2',
          [schedule.id, schedule.tenantId]
        );

        if (existing.rows.length > 0) {
          const currentVersion = existing.rows[0].version;
          if (currentVersion !== schedule.version - 1) {
            throw new Error(`Optimistic locking failure: expected version ${schedule.version - 1}, found ${currentVersion}`);
          }
          await client.query(
            `UPDATE report_schedules 
             SET report_name = $1, cron_expression = $2, frequency = $3, status = $4, next_run_at = $5, version = $6, updated_at = NOW()
             WHERE id = $7 AND tenant_id = $8`,
            [
              schedule.reportName,
              schedule.cronExpression,
              schedule.frequency,
              schedule.status,
              schedule.nextRunAt ?? null,
              schedule.version,
              schedule.id,
              schedule.tenantId
            ]
          );
        } else {
          await client.query(
            `INSERT INTO report_schedules (id, tenant_id, report_name, cron_expression, frequency, status, next_run_at, version, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              schedule.id,
              schedule.tenantId,
              schedule.reportName,
              schedule.cronExpression,
              schedule.frequency,
              schedule.status,
              schedule.nextRunAt ?? null,
              schedule.version,
              schedule.createdAt,
              schedule.updatedAt
            ]
          );
        }
      } finally {
        client.release();
      }
    } else {
      const key = `${schedule.tenantId}:${schedule.id}`;
      this.inMemoryDb.set(key, schedule);
    }
    return schedule;
  }

  public async findById(id: string, tenantId: string): Promise<ReportScheduleAggregate | null> {
    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query(
          'SELECT * FROM report_schedules WHERE id = $1 AND tenant_id = $2',
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

  public async findAll(filter: ReportScheduleFilter): Promise<{ schedules: ReportScheduleAggregate[]; total: number; page: number; pageSize: number }> {
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;

    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [filter.tenantId]);
        
        let query = 'SELECT * FROM report_schedules WHERE tenant_id = $1';
        let countQuery = 'SELECT COUNT(*) FROM report_schedules WHERE tenant_id = $1';
        const params: any[] = [filter.tenantId];
        let paramIdx = 2;

        if (filter.reportName) {
          query += ` AND report_name ILIKE $${paramIdx}`;
          countQuery += ` AND report_name ILIKE $${paramIdx}`;
          params.push(`%${filter.reportName}%`);
          paramIdx++;
        }
        if (filter.frequency) {
          query += ` AND frequency = $${paramIdx}`;
          countQuery += ` AND frequency = $${paramIdx}`;
          params.push(filter.frequency);
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

        const sortBy = filter.sortBy === 'reportName' ? 'report_name' : 'created_at';
        const sortOrder = filter.sortOrder === 'asc' ? 'ASC' : 'DESC';
        query += ` ORDER BY ${sortBy} ${sortOrder} LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
        params.push(pageSize, (page - 1) * pageSize);

        const res = await client.query(query, params);
        const schedules = res.rows.map((r: any) => this.mapToAggregate(r));

        return { schedules, total, page, pageSize };
      } finally {
        client.release();
      }
    } else {
      let items = Array.from(this.inMemoryDb.values()).filter(item => item.tenantId === filter.tenantId);

      if (filter.reportName) {
        const q = filter.reportName.toLowerCase();
        items = items.filter(i => i.reportName.toLowerCase().includes(q));
      }
      if (filter.frequency) {
        items = items.filter(i => i.frequency === filter.frequency);
      }
      if (filter.status) {
        items = items.filter(i => i.status === filter.status);
      }

      const total = items.length;
      items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const start = (page - 1) * pageSize;
      const paginated = items.slice(start, start + pageSize);

      return { schedules: paginated, total, page, pageSize };
    }
  }

  public async delete(id: string, tenantId: string): Promise<boolean> {
    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query('DELETE FROM report_schedules WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
        return (res.rowCount ?? 0) > 0;
      } finally {
        client.release();
      }
    } else {
      const key = `${tenantId}:${id}`;
      return this.inMemoryDb.delete(key);
    }
  }

  private mapToAggregate(row: any): ReportScheduleAggregate {
    return new ReportScheduleAggregate({
      id: row.id,
      tenantId: row.tenant_id,
      reportName: row.report_name,
      cronExpression: row.cron_expression,
      frequency: row.frequency as ScheduleFrequency,
      status: row.status as ScheduleStatus,
      nextRunAt: row.next_run_at ? new Date(row.next_run_at) : null,
      version: row.version,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }
}
