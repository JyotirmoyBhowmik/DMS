import { NotificationAggregate, NotificationChannel, NotificationStatus } from '../../../domain/entities/notification.entity.js';
import { NotificationFilter, NotificationRepository } from '../../../domain/repositories/notification.repository.js';

export class NotificationPgRepository implements NotificationRepository {
  private inMemoryDb: Map<string, NotificationAggregate>;

  constructor(
    private readonly pool?: any,
    sharedStore?: Map<string, NotificationAggregate>
  ) {
    this.inMemoryDb = sharedStore ?? new Map<string, NotificationAggregate>();
  }

  public async save(notification: NotificationAggregate): Promise<NotificationAggregate> {
    if (this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [notification.tenantId]);
        
        const existing = await client.query(
          'SELECT version FROM notifications WHERE id = $1 AND tenant_id = $2',
          [notification.id, notification.tenantId]
        );

        if (existing.rows.length > 0) {
          const currentVersion = existing.rows[0].version;
          if (currentVersion !== notification.version - 1) {
            throw new Error(`Optimistic locking failure: expected version ${notification.version - 1}, found ${currentVersion}`);
          }
          await client.query(
            `UPDATE notifications 
             SET template_id = $1, recipient = $2, channel = $3, status = $4, payload = $5, error_message = $6, sent_at = $7, version = $8, updated_at = NOW()
             WHERE id = $9 AND tenant_id = $10`,
            [
              notification.templateId ?? null,
              notification.recipient,
              notification.channel,
              notification.status,
              JSON.stringify(notification.payload),
              notification.errorMessage ?? null,
              notification.sentAt ?? null,
              notification.version,
              notification.id,
              notification.tenantId
            ]
          );
        } else {
          await client.query(
            `INSERT INTO notifications (id, tenant_id, template_id, recipient, channel, status, payload, error_message, sent_at, version, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              notification.id,
              notification.tenantId,
              notification.templateId ?? null,
              notification.recipient,
              notification.channel,
              notification.status,
              JSON.stringify(notification.payload),
              notification.errorMessage ?? null,
              notification.sentAt ?? null,
              notification.version,
              notification.createdAt,
              notification.updatedAt
            ]
          );
        }
      } finally {
        client.release();
      }
    } else {
      const key = `${notification.tenantId}:${notification.id}`;
      this.inMemoryDb.set(key, notification);
    }
    return notification;
  }

  public async findById(id: string, tenantId: string): Promise<NotificationAggregate | null> {
    if (this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query(
          'SELECT * FROM notifications WHERE id = $1 AND tenant_id = $2',
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

  public async findAll(filter: NotificationFilter): Promise<{ notifications: NotificationAggregate[]; total: number; page: number; pageSize: number }> {
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;

    if (this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [filter.tenantId]);
        
        let query = 'SELECT * FROM notifications WHERE tenant_id = $1';
        let countQuery = 'SELECT COUNT(*) FROM notifications WHERE tenant_id = $1';
        const params: any[] = [filter.tenantId];
        let paramIdx = 2;

        if (filter.recipient) {
          query += ` AND recipient ILIKE $${paramIdx}`;
          countQuery += ` AND recipient ILIKE $${paramIdx}`;
          params.push(`%${filter.recipient}%`);
          paramIdx++;
        }
        if (filter.channel) {
          query += ` AND channel = $${paramIdx}`;
          countQuery += ` AND channel = $${paramIdx}`;
          params.push(filter.channel);
          paramIdx++;
        }
        if (filter.status) {
          query += ` AND status = $${paramIdx}`;
          countQuery += ` AND status = $${paramIdx}`;
          params.push(filter.status);
          paramIdx++;
        }
        if (filter.templateId) {
          query += ` AND template_id = $${paramIdx}`;
          countQuery += ` AND template_id = $${paramIdx}`;
          params.push(filter.templateId);
          paramIdx++;
        }

        const countRes = await client.query(countQuery, params);
        const total = parseInt(countRes.rows[0].count, 10);

        const sortBy = filter.sortBy === 'recipient' ? 'recipient' : 'created_at';
        const sortOrder = filter.sortOrder === 'asc' ? 'ASC' : 'DESC';
        query += ` ORDER BY ${sortBy} ${sortOrder} LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
        params.push(pageSize, (page - 1) * pageSize);

        const res = await client.query(query, params);
        const notifications = res.rows.map((r: any) => this.mapToAggregate(r));

        return { notifications, total, page, pageSize };
      } finally {
        client.release();
      }
    } else {
      let items = Array.from(this.inMemoryDb.values()).filter(item => item.tenantId === filter.tenantId);

      if (filter.recipient) {
        const q = filter.recipient.toLowerCase();
        items = items.filter(i => i.recipient.toLowerCase().includes(q));
      }
      if (filter.channel) {
        items = items.filter(i => i.channel === filter.channel);
      }
      if (filter.status) {
        items = items.filter(i => i.status === filter.status);
      }
      if (filter.templateId) {
        items = items.filter(i => i.templateId === filter.templateId);
      }

      const total = items.length;
      items.sort((a, b) => (b.createdAt.getTime() - a.createdAt.getTime()));

      const start = (page - 1) * pageSize;
      const paginated = items.slice(start, start + pageSize);

      return { notifications: paginated, total, page, pageSize };
    }
  }

  public async delete(id: string, tenantId: string): Promise<boolean> {
    if (this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query('DELETE FROM notifications WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
        return (res.rowCount ?? 0) > 0;
      } finally {
        client.release();
      }
    } else {
      const key = `${tenantId}:${id}`;
      return this.inMemoryDb.delete(key);
    }
  }

  private mapToAggregate(row: any): NotificationAggregate {
    return new NotificationAggregate({
      id: row.id,
      tenantId: row.tenant_id,
      templateId: row.template_id,
      recipient: row.recipient,
      channel: row.channel as NotificationChannel,
      status: row.status as NotificationStatus,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
      errorMessage: row.error_message,
      sentAt: row.sent_at ? new Date(row.sent_at) : null,
      version: row.version,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }
}
