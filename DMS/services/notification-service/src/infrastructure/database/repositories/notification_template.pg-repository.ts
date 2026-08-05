import { NotificationTemplateRepository, ListNotificationTemplatesOptions } from '../../../domain/repositories/notification_template.repository.js';
import { NotificationTemplateAggregate, NotificationTemplateDomainError } from '../../../domain/entities/notification_template.entity.js';

export class NotificationTemplatePgRepository implements NotificationTemplateRepository {
  private static globalInMemoryDb = new Map<string, NotificationTemplateAggregate>();
  private inMemoryDb: Map<string, NotificationTemplateAggregate>;

  constructor(private readonly dbPool?: any, sharedStore?: Map<string, NotificationTemplateAggregate>) {
    this.inMemoryDb = sharedStore || NotificationTemplatePgRepository.globalInMemoryDb;
  }

  async save(template: NotificationTemplateAggregate, tenantId: string): Promise<NotificationTemplateAggregate> {
    if (template.tenantId !== tenantId) {
      throw new NotificationTemplateDomainError(`Tenant mismatch: Template tenant '${template.tenantId}' does not match context '${tenantId}'`);
    }

    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const query = `
          INSERT INTO notification_templates (
            id, tenant_id, code, name, channel, subject, body_template,
            status, version, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *;
        `;
        const values = [
          template.id, template.tenantId, template.code, template.name,
          template.channel, template.subject, template.bodyTemplate,
          template.status, template.version, template.createdAt, template.updatedAt
        ];
        await client.query(query, values);
      } finally {
        client.release();
      }
    }

    this.inMemoryDb.set(template.id, template);
    return template;
  }

  async findById(id: string, tenantId: string): Promise<NotificationTemplateAggregate | null> {
    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query(
          'SELECT * FROM notification_templates WHERE id = $1 AND tenant_id = $2',
          [id, tenantId]
        );
        if (res.rows.length === 0) return null;
        return this.mapRowToEntity(res.rows[0]);
      } finally {
        client.release();
      }
    }

    const item = this.inMemoryDb.get(id);
    if (!item || item.tenantId !== tenantId) return null;
    return item;
  }

  async findByCode(code: string, tenantId: string): Promise<NotificationTemplateAggregate | null> {
    const formattedCode = code.trim().toUpperCase();
    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query(
          'SELECT * FROM notification_templates WHERE code = $1 AND tenant_id = $2',
          [formattedCode, tenantId]
        );
        if (res.rows.length === 0) return null;
        return this.mapRowToEntity(res.rows[0]);
      } finally {
        client.release();
      }
    }

    for (const item of this.inMemoryDb.values()) {
      if (item.tenantId === tenantId && item.code === formattedCode) {
        return item;
      }
    }
    return null;
  }

  async list(tenantId: string, options?: ListNotificationTemplatesOptions): Promise<{ items: NotificationTemplateAggregate[]; total: number }> {
    const page = Math.max(1, options?.page || 1);
    const limit = Math.min(100, Math.max(1, options?.limit || 20));
    const offset = (page - 1) * limit;

    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const whereClauses = ['tenant_id = $1'];
        const values: any[] = [tenantId];

        if (options?.channel) {
          values.push(options.channel);
          whereClauses.push(`channel = $${values.length}`);
        }
        if (options?.status) {
          values.push(options.status);
          whereClauses.push(`status = $${values.length}`);
        }
        if (options?.code) {
          values.push(`%${options.code.toUpperCase()}%`);
          whereClauses.push(`code LIKE $${values.length}`);
        }

        const whereStr = whereClauses.join(' AND ');
        const countRes = await client.query(`SELECT COUNT(*)::int FROM notification_templates WHERE ${whereStr}`, values);
        const total = countRes.rows[0].count;

        values.push(limit, offset);
        const dataRes = await client.query(
          `SELECT * FROM notification_templates WHERE ${whereStr} ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
          values
        );
        const items = dataRes.rows.map((row: any) => this.mapRowToEntity(row));
        return { items, total };
      } finally {
        client.release();
      }
    }

    let items = Array.from(this.inMemoryDb.values()).filter(item => item.tenantId === tenantId);

    if (options?.channel) {
      items = items.filter(item => item.channel === options.channel);
    }
    if (options?.status) {
      items = items.filter(item => item.status === options.status);
    }
    if (options?.code) {
      items = items.filter(item => item.code.includes(options.code!.toUpperCase()));
    }

    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = items.length;
    items = items.slice(offset, offset + limit);

    return { items, total };
  }

  async update(template: NotificationTemplateAggregate, tenantId: string): Promise<NotificationTemplateAggregate> {
    const existing = await this.findById(template.id, tenantId);
    if (!existing) {
      throw new NotificationTemplateDomainError(`NotificationTemplate with id '${template.id}' not found`);
    }

    if (existing.version !== template.version) {
      throw new NotificationTemplateDomainError(
        `Optimistic concurrency conflict for NotificationTemplate '${template.id}': expected v${template.version}, found v${existing.version}`
      );
    }

    const updatedEntity = new NotificationTemplateAggregate({
      id: template.id,
      tenantId: template.tenantId || existing.tenantId,
      code: template.code || existing.code,
      name: template.name || existing.name,
      channel: template.channel || existing.channel,
      subject: template.subject !== undefined ? template.subject : existing.subject,
      bodyTemplate: template.bodyTemplate || existing.bodyTemplate,
      status: template.status || existing.status,
      version: existing.version + 1,
      createdAt: template.createdAt || existing.createdAt,
      updatedAt: new Date(),
    });

    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const query = `
          UPDATE notification_templates
          SET name = $1, subject = $2, body_template = $3, status = $4, version = version + 1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $5 AND tenant_id = $6 AND version = $7
          RETURNING *;
        `;
        const res = await client.query(query, [
          updatedEntity.name, updatedEntity.subject, updatedEntity.bodyTemplate,
          updatedEntity.status, template.id, tenantId, template.version
        ]);

        if (res.rows.length === 0) {
          throw new NotificationTemplateDomainError(`Optimistic concurrency update failed for NotificationTemplate '${template.id}'`);
        }
      } finally {
        client.release();
      }
    }

    this.inMemoryDb.set(updatedEntity.id, updatedEntity);
    return updatedEntity;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const existing = await this.findById(id, tenantId);
    if (!existing) return false;

    if (this.dbPool && typeof this.dbPool.connect === 'function') {
      const client = await this.dbPool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query('DELETE FROM notification_templates WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
        this.inMemoryDb.delete(id);
        return (res.rowCount ?? 0) > 0;
      } finally {
        client.release();
      }
    }

    this.inMemoryDb.delete(id);
    return true;
  }

  private mapRowToEntity(row: any): NotificationTemplateAggregate {
    return new NotificationTemplateAggregate({
      id: row.id,
      tenantId: row.tenant_id,
      code: row.code,
      name: row.name,
      channel: row.channel,
      subject: row.subject,
      bodyTemplate: row.body_template,
      status: row.status,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
