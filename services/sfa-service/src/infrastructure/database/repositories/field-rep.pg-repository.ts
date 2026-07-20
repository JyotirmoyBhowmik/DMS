import { FieldRep } from '../../../domain/entities/field-rep.js';
import { FieldRepRepository } from '../../../domain/repositories/field-rep.repository.js';
import { BaseRow } from '@dms/pkg-database';

export class FieldRepPgRepository implements FieldRepRepository {
  private static inMemoryDb = new Map<string, FieldRep>();

  constructor(private readonly db?: any) {}

  static clearStore(): void {
    FieldRepPgRepository.inMemoryDb.clear();
  }

  private async isDbViable(): Promise<boolean> {
    if (!this.db) return false;
    try {
      await this.db.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async save(fieldRep: FieldRep, tenantId: string): Promise<FieldRep> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      FieldRepPgRepository.inMemoryDb.set(fieldRep.id, fieldRep);
      return fieldRep;
    }

    const row = this.mapToRow(fieldRep);
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
      await this.db.query(sql, params, tenantId);
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
        await this.db.query(sql, params, tenantId);
      } catch (err: any) {
        if (err.message.includes('unique_constraint') || err.message.includes('employee_code') || err.message.includes('user_id')) {
          throw new Error(`A field representative with employee code ${fieldRep.employeeCode} or user ID ${fieldRep.userId} already exists.`);
        }
        throw err;
      }
    }

    return fieldRep;
  }

  async findById(id: string, tenantId: string): Promise<FieldRep | null> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      const found = FieldRepPgRepository.inMemoryDb.get(id);
      if (found && found.tenantId === tenantId) {
        return found;
      }
      return null;
    }

    const sql = `SELECT * FROM field_reps WHERE id = $1 AND tenant_id = $2`;
    const res = await this.db.query(sql, [id, tenantId], tenantId);
    if (!res || res.length === 0) return null;
    return this.mapToEntity(res[0]);
  }

  async findByEmployeeCode(employeeCode: string, tenantId: string): Promise<FieldRep | null> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      return Array.from(FieldRepPgRepository.inMemoryDb.values())
        .find((c) => c.tenantId === tenantId && c.employeeCode === employeeCode) || null;
    }

    const sql = `SELECT * FROM field_reps WHERE employee_code = $1 AND tenant_id = $2`;
    const res = await this.db.query(sql, [employeeCode, tenantId], tenantId);
    if (!res || res.length === 0) return null;
    return this.mapToEntity(res[0]);
  }

  async findByUserId(userId: string, tenantId: string): Promise<FieldRep | null> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      return Array.from(FieldRepPgRepository.inMemoryDb.values())
        .find((c) => c.tenantId === tenantId && c.userId === userId) || null;
    }

    const sql = `SELECT * FROM field_reps WHERE user_id = $1 AND tenant_id = $2`;
    const res = await this.db.query(sql, [userId, tenantId], tenantId);
    if (!res || res.length === 0) return null;
    return this.mapToEntity(res[0]);
  }

  async findAll(tenantId: string, limit: number = 50, offset: number = 0, filters?: {
    status?: string;
    employeeCode?: string;
    search?: string;
  }): Promise<FieldRep[] | any> {
    const isViable = await this.isDbViable();
    if (!isViable) {
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

    const res = await this.db.query(sql, params, tenantId);
    return res.map((r: any) => this.mapToEntity(r));
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const isViable = await this.isDbViable();
    if (!isViable) {
      FieldRepPgRepository.inMemoryDb.delete(id);
      return;
    }

    const sql = `DELETE FROM field_reps WHERE id = $1 AND tenant_id = $2`;
    await this.db.query(sql, [id, tenantId], tenantId);
  }

  async count(tenantId: string, filters?: {
    status?: string;
    employeeCode?: string;
    search?: string;
  }): Promise<number> {
    const isViable = await this.isDbViable();
    if (!isViable) {
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

    const res = await this.db.query(sql, params, tenantId);
    return Number(res[0]?.count ?? 0);
  }

  private mapToEntity(row: BaseRow): FieldRep {
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
      createdAt: new Date(row.created_at as any),
      updatedAt: new Date(row.updated_at as any),
      version: Number(row.version),
    });
  }

  private mapToRow(entity: FieldRep): BaseRow {
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
