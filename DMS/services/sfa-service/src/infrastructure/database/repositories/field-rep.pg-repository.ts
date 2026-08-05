import { BasePostgresRepository, BaseRow, PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { FieldRep } from '../../../domain/entities/field-rep.js';
import { FieldRepRepository } from '../../../domain/repositories/field-rep.repository.js';
import { StructuredLogger } from '@dms/pkg-logger';
import { loadConfigSync } from '@dms/pkg-config';

const config = loadConfigSync();

class PgFieldRepRepo extends BasePostgresRepository<FieldRep> {
  async checkHealth() {
    return await this.db.checkHealth();
  }

  async query<T = unknown>(sql: string, params?: unknown[], tenantId?: string) {
    return await this.db.query<T>(sql, params, tenantId);
  }

  override tableName(): string {
    return 'field_reps';
  }

  public override mapToEntity(row: BaseRow): FieldRep {
    return FieldRep.fromPersistence({
      id: row.id as string,
      tenantId: row.tenant_id as string,
      userId: row.user_id as string,
      employeeCode: row.employee_code as string,
      firstName: row.first_name as string,
      lastName: row.last_name as string,
      email: row.email as string,
      phone: row.phone as string,
      status: row.status as any,
      createdAt: row.created_at ? new Date(row.created_at as any) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at as any) : new Date(),
      version: Number(row.version || 0),
    });
  }

  public override mapToRow(entity: FieldRep): BaseRow {
    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      user_id: entity.userId,
      employee_code: entity.employeeCode,
      first_name: entity.firstName,
      last_name: entity.lastName,
      email: entity.email,
      phone: entity.phone,
      status: entity.status,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
      version: entity.version,
    };
  }
}

export class FieldRepPgRepository implements FieldRepRepository {
  private logger = new StructuredLogger('FieldRepPgRepository');
  public static inMemoryDb = new Map<string, FieldRep>();
  private pgRepo: PgFieldRepRepo;
  private hasDb = false;

  constructor(db?: PostgresDatabaseClient) {
    const activeDb = db ?? new PostgresDatabaseClient(config.db, new PgDriver());
    this.pgRepo = new PgFieldRepRepo(activeDb);
    this.checkConnection().then((alive) => {
      this.hasDb = alive;
    });
  }

  public static clearStore(): void {
    FieldRepPgRepository.inMemoryDb.clear();
  }

  private async checkConnection(): Promise<boolean> {
    try {
      const res = await this.pgRepo.checkHealth();
      return res.status === 'HEALTHY';
    } catch {
      return false;
    }
  }

  async save(fieldRep: FieldRep, tenantId: string): Promise<FieldRep> {
    if (this.hasDb) {
      try {
        const row = this.pgRepo.mapToRow(fieldRep);
        const existing = await this.findById(fieldRep.id, tenantId);

        if (existing) {
          if (existing.version !== fieldRep.version) {
            throw new Error(`Optimistic locking conflict: version mismatch. DB version ${existing.version}, requested version ${fieldRep.version}`);
          }

          const sql = `
            UPDATE field_reps
            SET first_name = $1, last_name = $2, email = $3, phone = $4, status = $5,
                updated_at = $6, version = version + 1
            WHERE id = $7 AND tenant_id = $8
          `;
          const params = [
            row.first_name,
            row.last_name,
            row.email,
            row.phone,
            row.status,
            row.updated_at,
            row.id,
            row.tenant_id,
          ];
          await this.pgRepo.query(sql, params, tenantId);
        } else {
          const sql = `
            INSERT INTO field_reps (
              id, tenant_id, user_id, employee_code, first_name, last_name,
              email, phone, status, created_at, updated_at, version
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          `;
          const params = [
            row.id,
            row.tenant_id,
            row.user_id,
            row.employee_code,
            row.first_name,
            row.last_name,
            row.email,
            row.phone,
            row.status,
            row.created_at,
            row.updated_at,
            row.version,
          ];
          try {
            await this.pgRepo.query(sql, params, tenantId);
          } catch (err: any) {
            if (err.message?.includes('unique_constraint') || err.message?.includes('employee_code') || err.message?.includes('user_id')) {
              throw new Error(`A field representative with employee code ${fieldRep.employeeCode} or user ID ${fieldRep.userId} already exists.`);
            }
            throw err;
          }
        }
        return fieldRep;
      } catch (err: any) {
        if (err.message?.includes('Optimistic locking conflict') || err.message?.includes('already exists')) {
          throw err;
        }
        this.logger.warn('Failed to save to Postgres, falling back to memory', { error: err.message });
      }
    }

    FieldRepPgRepository.inMemoryDb.set(fieldRep.id, fieldRep);
    return fieldRep;
  }

  async findById(id: string, tenantId: string): Promise<FieldRep | null> {
    if (this.hasDb) {
      try {
        const sql = `SELECT * FROM field_reps WHERE id = $1 AND tenant_id = $2`;
        const res = await this.pgRepo.query<BaseRow>(sql, [id, tenantId], tenantId);
        if (!res || res.rows.length === 0) return null;
        return this.pgRepo.mapToEntity(res.rows[0]!);
      } catch (err: any) {
        this.logger.warn('Failed to findById in Postgres, falling back to memory', { error: err.message });
      }
    }

    const found = FieldRepPgRepository.inMemoryDb.get(id);
    if (found && found.tenantId === tenantId) {
      return found;
    }
    return null;
  }

  async findByEmployeeCode(employeeCode: string, tenantId: string): Promise<FieldRep | null> {
    if (this.hasDb) {
      try {
        const sql = `SELECT * FROM field_reps WHERE employee_code = $1 AND tenant_id = $2`;
        const res = await this.pgRepo.query<BaseRow>(sql, [employeeCode, tenantId], tenantId);
        if (!res || res.rows.length === 0) return null;
        return this.pgRepo.mapToEntity(res.rows[0]!);
      } catch (err: any) {
        this.logger.warn('Failed to findByEmployeeCode in Postgres, falling back to memory', { error: err.message });
      }
    }

    return Array.from(FieldRepPgRepository.inMemoryDb.values())
      .find((c) => c.tenantId === tenantId && c.employeeCode === employeeCode) || null;
  }

  async findByUserId(userId: string, tenantId: string): Promise<FieldRep | null> {
    if (this.hasDb) {
      try {
        const sql = `SELECT * FROM field_reps WHERE user_id = $1 AND tenant_id = $2`;
        const res = await this.pgRepo.query<BaseRow>(sql, [userId, tenantId], tenantId);
        if (!res || res.rows.length === 0) return null;
        return this.pgRepo.mapToEntity(res.rows[0]!);
      } catch (err: any) {
        this.logger.warn('Failed to findByUserId in Postgres, falling back to memory', { error: err.message });
      }
    }

    return Array.from(FieldRepPgRepository.inMemoryDb.values())
      .find((c) => c.tenantId === tenantId && c.userId === userId) || null;
  }

  async findAll(tenantId: string, limit: number = 50, offset: number = 0, filters?: {
    status?: string;
    employeeCode?: string;
    search?: string;
  }): Promise<FieldRep[]> {
    if (this.hasDb) {
      try {
        let sql = `SELECT * FROM field_reps WHERE tenant_id = $1`;
        const params: any[] = [tenantId];
        let paramIndex = 2;

        if (filters?.status) {
          sql += ` AND status = $${paramIndex++}`;
          params.push(filters.status);
        }
        if (filters?.employeeCode) {
          sql += ` AND employee_code = $${paramIndex++}`;
          params.push(filters.employeeCode);
        }
        if (filters?.search) {
          sql += ` AND (first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
          params.push(`%${filters.search}%`);
          paramIndex++;
        }

        sql += ` ORDER BY employee_code ASC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(limit, offset);

        const res = await this.pgRepo.query<BaseRow>(sql, params, tenantId);
        return res.rows.map((r) => this.pgRepo.mapToEntity(r));
      } catch (err: any) {
        this.logger.warn('Failed to findAll in Postgres, falling back to memory', { error: err.message });
      }
    }

    let list = Array.from(FieldRepPgRepository.inMemoryDb.values())
      .filter((c) => c.tenantId === tenantId);

    if (filters?.status) {
      list = list.filter((c) => c.status === filters.status);
    }
    if (filters?.employeeCode) {
      list = list.filter((c) => c.employeeCode.includes(filters.employeeCode!));
    }
    if (filters?.search) {
      const query = filters.search.toLowerCase();
      list = list.filter(
        (c) =>
          c.firstName.toLowerCase().includes(query) ||
          c.lastName.toLowerCase().includes(query) ||
          c.email.toLowerCase().includes(query)
      );
    }

    return list.slice(offset, offset + limit);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    if (this.hasDb) {
      try {
        const sql = `DELETE FROM field_reps WHERE id = $1 AND tenant_id = $2`;
        await this.pgRepo.query(sql, [id, tenantId], tenantId);
        return;
      } catch (err: any) {
        this.logger.warn('Failed to delete in Postgres, falling back to memory', { error: err.message });
      }
    }

    FieldRepPgRepository.inMemoryDb.delete(id);
  }

  async count(tenantId: string, filters?: {
    status?: string;
    employeeCode?: string;
    search?: string;
  }): Promise<number> {
    if (this.hasDb) {
      try {
        let sql = `SELECT COUNT(*) as count FROM field_reps WHERE tenant_id = $1`;
        const params: any[] = [tenantId];
        let paramIndex = 2;

        if (filters?.status) {
          sql += ` AND status = $${paramIndex++}`;
          params.push(filters.status);
        }
        if (filters?.employeeCode) {
          sql += ` AND employee_code = $${paramIndex++}`;
          params.push(filters.employeeCode);
        }
        if (filters?.search) {
          sql += ` AND (first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
          params.push(`%${filters.search}%`);
          paramIndex++;
        }

        const res = await this.pgRepo.query<{ count: string | number }>(sql, params, tenantId);
        return Number(res.rows[0]?.count ?? 0);
      } catch (err: any) {
        this.logger.warn('Failed to count in Postgres, falling back to memory', { error: err.message });
      }
    }

    let list = Array.from(FieldRepPgRepository.inMemoryDb.values())
      .filter((c) => c.tenantId === tenantId);

    if (filters?.status) {
      list = list.filter((c) => c.status === filters.status);
    }
    if (filters?.employeeCode) {
      list = list.filter((c) => c.employeeCode.includes(filters.employeeCode!));
    }
    if (filters?.search) {
      const query = filters.search.toLowerCase();
      list = list.filter(
        (c) =>
          c.firstName.toLowerCase().includes(query) ||
          c.lastName.toLowerCase().includes(query) ||
          c.email.toLowerCase().includes(query)
      );
    }
    return list.length;
  }
}
