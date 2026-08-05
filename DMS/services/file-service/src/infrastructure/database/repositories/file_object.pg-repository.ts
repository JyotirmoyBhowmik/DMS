import { FileObjectAggregate, FileObjectStatus } from '../../../domain/entities/file_object.entity.js';
import { FileObjectFilter, FileObjectRepository } from '../../../domain/repositories/file_object.repository.js';

export class FileObjectPgRepository implements FileObjectRepository {
  private inMemoryDb: Map<string, FileObjectAggregate>;

  constructor(
    private readonly pool?: any,
    sharedStore?: Map<string, FileObjectAggregate>
  ) {
    this.inMemoryDb = sharedStore ?? new Map<string, FileObjectAggregate>();
  }

  public async save(fileObject: FileObjectAggregate): Promise<FileObjectAggregate> {
    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [fileObject.tenantId]);
        
        const existing = await client.query(
          'SELECT version FROM file_objects WHERE id = $1 AND tenant_id = $2',
          [fileObject.id, fileObject.tenantId]
        );

        if (existing.rows.length > 0) {
          const currentVersion = existing.rows[0].version;
          if (currentVersion !== fileObject.version - 1) {
            throw new Error(`Optimistic locking failure: expected version ${fileObject.version - 1}, found ${currentVersion}`);
          }
          await client.query(
            `UPDATE file_objects 
             SET filename = $1, status = $2, version = $3, updated_at = NOW()
             WHERE id = $4 AND tenant_id = $5`,
            [
              fileObject.filename,
              fileObject.status,
              fileObject.version,
              fileObject.id,
              fileObject.tenantId
            ]
          );
        } else {
          await client.query(
            `INSERT INTO file_objects (id, tenant_id, filename, mime_type, size_bytes, storage_path, checksum, status, version, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              fileObject.id,
              fileObject.tenantId,
              fileObject.filename,
              fileObject.mimeType,
              fileObject.sizeBytes,
              fileObject.storagePath,
              fileObject.checksum,
              fileObject.status,
              fileObject.version,
              fileObject.createdAt,
              fileObject.updatedAt
            ]
          );
        }
      } finally {
        client.release();
      }
    } else {
      const key = `${fileObject.tenantId}:${fileObject.id}`;
      this.inMemoryDb.set(key, fileObject);
    }
    return fileObject;
  }

  public async findById(id: string, tenantId: string): Promise<FileObjectAggregate | null> {
    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query(
          'SELECT * FROM file_objects WHERE id = $1 AND tenant_id = $2',
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

  public async findAll(filter: FileObjectFilter): Promise<{ fileObjects: FileObjectAggregate[]; total: number; page: number; pageSize: number }> {
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;

    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [filter.tenantId]);
        
        let query = 'SELECT * FROM file_objects WHERE tenant_id = $1';
        let countQuery = 'SELECT COUNT(*) FROM file_objects WHERE tenant_id = $1';
        const params: any[] = [filter.tenantId];
        let paramIdx = 2;

        if (filter.filename) {
          query += ` AND filename ILIKE $${paramIdx}`;
          countQuery += ` AND filename ILIKE $${paramIdx}`;
          params.push(`%${filter.filename}%`);
          paramIdx++;
        }
        if (filter.mimeType) {
          query += ` AND mime_type = $${paramIdx}`;
          countQuery += ` AND mime_type = $${paramIdx}`;
          params.push(filter.mimeType);
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

        const sortBy = filter.sortBy === 'filename' ? 'filename' : filter.sortBy === 'sizeBytes' ? 'size_bytes' : 'created_at';
        const sortOrder = filter.sortOrder === 'asc' ? 'ASC' : 'DESC';
        query += ` ORDER BY ${sortBy} ${sortOrder} LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
        params.push(pageSize, (page - 1) * pageSize);

        const res = await client.query(query, params);
        const fileObjects = res.rows.map((r: any) => this.mapToAggregate(r));

        return { fileObjects, total, page, pageSize };
      } finally {
        client.release();
      }
    } else {
      let items = Array.from(this.inMemoryDb.values()).filter(item => item.tenantId === filter.tenantId);

      if (filter.filename) {
        const q = filter.filename.toLowerCase();
        items = items.filter(i => i.filename.toLowerCase().includes(q));
      }
      if (filter.mimeType) {
        items = items.filter(i => i.mimeType === filter.mimeType);
      }
      if (filter.status) {
        items = items.filter(i => i.status === filter.status);
      }

      const total = items.length;
      items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const start = (page - 1) * pageSize;
      const paginated = items.slice(start, start + pageSize);

      return { fileObjects: paginated, total, page, pageSize };
    }
  }

  public async delete(id: string, tenantId: string): Promise<boolean> {
    if (this.pool && typeof this.pool.connect === 'function') {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
        const res = await client.query('DELETE FROM file_objects WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
        return (res.rowCount ?? 0) > 0;
      } finally {
        client.release();
      }
    } else {
      const key = `${tenantId}:${id}`;
      return this.inMemoryDb.delete(key);
    }
  }

  private mapToAggregate(row: any): FileObjectAggregate {
    return new FileObjectAggregate({
      id: row.id,
      tenantId: row.tenant_id,
      filename: row.filename,
      mimeType: row.mime_type,
      sizeBytes: Number(row.size_bytes),
      storagePath: row.storage_path,
      checksum: row.checksum,
      status: row.status as FileObjectStatus,
      version: row.version,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }
}
