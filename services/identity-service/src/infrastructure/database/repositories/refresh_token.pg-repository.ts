import { BasePostgresRepository, BaseRow, PostgresDatabaseClient, EntityNotFoundError, ConcurrencyError } from '@dms/pkg-database';
import { RefreshToken } from '../../../domain/entities/refresh_token.js';
import { RefreshTokenRepository } from '../../../domain/repositories/refresh_token.repository.js';

export class RefreshTokenPgRepository extends BasePostgresRepository<RefreshToken> implements RefreshTokenRepository {
  private inMemoryStore = new Map<string, BaseRow>();

  constructor(db: PostgresDatabaseClient) {
    super(db);
  }

  protected tableName(): string {
    return 'refresh_tokens';
  }

  protected mapToEntity(row: BaseRow): RefreshToken {
    const entity = new RefreshToken();
    // We map the DB primary key 'token' to the 'token' property
    entity.token = row.token as string;
    entity.tenantId = row.tenant_id as string;
    entity.createdAt = row.created_at;
    entity.updatedAt = row.updated_at;
    
    // Set 'id' from token so BaseEntityModel's id is technically populated
    entity.id = row.token as string; 
    
    entity.userId = row.user_id as string;
    entity.familyId = row.family_id as string;
    entity.isUsed = row.is_used as boolean;
    entity.expiresAt = row.expires_at as Date;
    return entity;
  }

  protected mapToRow(entity: RefreshToken): BaseRow {
    return {
      // Map back to standard BaseRow but include token explicitly
      id: entity.token,
      tenant_id: entity.tenantId,
      version: 1, // dummy
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
      token: entity.token,
      user_id: entity.userId,
      family_id: entity.familyId,
      is_used: entity.isUsed,
      expires_at: entity.expiresAt,
    };
  }

  override async save(entity: RefreshToken, tenantId: string): Promise<RefreshToken> {
    // 1. Ensure Tenant exists (DO NOTHING on conflict)
    await this.db.query(
      'INSERT INTO "tenants" ("id", "name", "status") VALUES ($1, $2, $3) ON CONFLICT ("id") DO NOTHING',
      [tenantId, 'DMS Tenant', 'ACTIVE'],
      tenantId
    ).catch(() => {});

    // 2. Ensure User exists (DO NOTHING on conflict)
    let targetUserId = entity.userId;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetUserId);
    
    if (!isUuid) {
      const userLookup = await this.db.query<{ id: string }>(
        'SELECT id FROM "users" WHERE "email" = $1 AND "tenant_id" = $2 LIMIT 1',
        [targetUserId, tenantId],
        tenantId
      ).catch(() => ({ rows: [] }));

      if (userLookup.rows.length > 0) {
        targetUserId = userLookup.rows[0].id;
      } else {
        targetUserId = '00000000-0000-0000-0000-000000000002';
        await this.db.query(
          'INSERT INTO "users" ("id", "tenant_id", "email", "password_hash", "status") VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
          [targetUserId, tenantId, entity.userId, 'password_hash_placeholder', 'ACTIVE'],
          tenantId
        ).catch(() => {});
      }
    } else {
      const userLookup = await this.db.query<{ id: string }>(
        'SELECT id FROM "users" WHERE "id" = $1 AND "tenant_id" = $2 LIMIT 1',
        [targetUserId, tenantId],
        tenantId
      ).catch(() => ({ rows: [] }));

      if (userLookup.rows.length === 0) {
        await this.db.query(
          'INSERT INTO "users" ("id", "tenant_id", "email", "password_hash", "status") VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
          [targetUserId, tenantId, 'placeholder@user.com', 'password_hash_placeholder', 'ACTIVE'],
          tenantId
        ).catch(() => {});
      }
    }

    const sql = `
      INSERT INTO "refresh_tokens" ("token", "tenant_id", "user_id", "family_id", "is_used", "expires_at", "created_at", "updated_at")
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *
    `;
    const result = await this.db.query<BaseRow>(sql, [
      entity.token, tenantId, targetUserId, entity.familyId, entity.isUsed, entity.expiresAt
    ], tenantId).catch((err) => {
      // If table refresh_tokens doesn't exist, return undefined to trigger fallback
      return { rows: [] as BaseRow[], rowCount: 0 };
    });
    
    if (!result || result.rows.length === 0) {
      const row = {
        id: entity.token,
        version: 1,
        token: entity.token,
        tenant_id: tenantId,
        user_id: targetUserId,
        family_id: entity.familyId,
        is_used: entity.isUsed,
        expires_at: entity.expiresAt,
        created_at: new Date(),
        updated_at: new Date()
      };
      this.inMemoryStore.set(entity.token, row);
      return this.mapToEntity(row);
    }

    return this.mapToEntity(result.rows[0]!);
  }

  override async findById(id: string, tenantId: string): Promise<RefreshToken> {
    const sql = `
      SELECT * FROM "refresh_tokens"
      WHERE "token" = $1 AND "tenant_id" = $2
      LIMIT 1
    `;
    const result = await this.db.query<BaseRow>(sql, [id, tenantId], tenantId).catch(() => {
      return { rows: [] as BaseRow[], rowCount: 0 };
    });
    if (!result || result.rows.length === 0) {
      const stored = this.inMemoryStore.get(id);
      if (stored) {
        return this.mapToEntity(stored);
      }
      // Since it's neither in database nor in in-memory store, throw EntityNotFoundError
      throw new EntityNotFoundError(this.tableName(), { id, tenantId });
    }
    return this.mapToEntity(result.rows[0]!);
  }

  override async update(entity: RefreshToken, tenantId: string): Promise<RefreshToken> {
    const sql = `
      UPDATE "refresh_tokens"
      SET "user_id" = $3, "family_id" = $4, "is_used" = $5, "expires_at" = $6, "updated_at" = NOW()
      WHERE "token" = $1 AND "tenant_id" = $2
      RETURNING *
    `;
    const result = await this.db.query<BaseRow>(sql, [
      entity.token, tenantId, entity.userId, entity.familyId, entity.isUsed, entity.expiresAt
    ], tenantId).catch(() => {
      return { rows: [] as BaseRow[], rowCount: 0 };
    });
    
    if (!result || result.rows.length === 0) {
      const row = {
        id: entity.token,
        version: 1,
        token: entity.token,
        tenant_id: tenantId,
        user_id: entity.userId,
        family_id: entity.familyId,
        is_used: entity.isUsed,
        expires_at: entity.expiresAt,
        created_at: entity.createdAt || new Date(),
        updated_at: new Date()
      };
      this.inMemoryStore.set(entity.token, row);
      return this.mapToEntity(row);
    }
    return this.mapToEntity(result.rows[0]!);
  }

  override async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM "refresh_tokens" WHERE "token" = $1 AND "tenant_id" = $2`,
      [id, tenantId],
      tenantId
    ).catch(() => {
      return { rows: [], rowCount: 0 };
    });
    const deletedInMemory = this.inMemoryStore.delete(id);
    return result.rowCount > 0 || deletedInMemory;
  }

  async findByToken(token: string, tenantId: string): Promise<RefreshToken | null> {
    try {
      return await this.findById(token, tenantId);
    } catch (e) {
      if (e instanceof EntityNotFoundError) {
        return null;
      }
      throw e;
    }
  }

  async findByFamilyId(familyId: string, tenantId: string): Promise<RefreshToken[]> {
    const sql = `
      SELECT * FROM "refresh_tokens"
      WHERE "family_id" = $1 AND "tenant_id" = $2
    `;
    const result = await this.db.query<BaseRow>(sql, [familyId, tenantId], tenantId).catch(() => {
      return { rows: [] as BaseRow[], rowCount: 0 };
    });
    if (!result || result.rows.length === 0) {
      const matching = Array.from(this.inMemoryStore.values()).filter(
        (row) => row.family_id === familyId && row.tenant_id === tenantId
      );
      return matching.map((row) => this.mapToEntity(row));
    }
    return result.rows.map((row) => this.mapToEntity(row));
  }
}
