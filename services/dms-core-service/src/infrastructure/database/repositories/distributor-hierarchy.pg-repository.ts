import { BaseRow, PostgresDatabaseClient } from '@dms/pkg-database';
import { DistributorHierarchy, HierarchyLevel } from '../../../domain/entities/distributor-hierarchy.js';
import { DistributorHierarchyRepository } from '../../../domain/repositories/distributor-hierarchy.repository.js';

export class DistributorHierarchyPgRepository extends DistributorHierarchyRepository {
  private static inMemoryStore = new Map<string, DistributorHierarchy>();

  static clearStore(): void {
    this.inMemoryStore.clear();
  }

  constructor(private db: PostgresDatabaseClient) {
    super();
  }

  async save(h: DistributorHierarchy): Promise<void> {
    DistributorHierarchyPgRepository.inMemoryStore.set(h.id, h);
    const data = h.toJSON();

    await this.db.query(
      `INSERT INTO distributor_hierarchy
        (id, tenant_id, parent_distributor_id, child_distributor_id, hierarchy_level,
         territory, effective_from, effective_to, is_active, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         parent_distributor_id = $3, child_distributor_id = $4, hierarchy_level = $5,
         territory = $6, effective_from = $7, effective_to = $8, is_active = $9, version = $10`,
      [data.id, data.tenantId, data.parentDistributorId, data.childDistributorId,
       data.hierarchyLevel, data.territory, data.effectiveFrom, data.effectiveTo ?? null,
       data.isActive, data.version],
      data.tenantId
    );
  }

  async findById(tenantId: string, id: string): Promise<DistributorHierarchy | null> {
    const mem = DistributorHierarchyPgRepository.inMemoryStore.get(id);
    if (mem && mem.tenantId === tenantId) return mem;

    const result = await this.db.query<BaseRow>(
      `SELECT * FROM distributor_hierarchy WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByChildDistributor(tenantId: string, childDistributorId: string): Promise<DistributorHierarchy | null> {
    const result = await this.db.query<BaseRow>(
      `SELECT * FROM distributor_hierarchy WHERE tenant_id = $1 AND child_distributor_id = $2 AND is_active = true`,
      [tenantId, childDistributorId],
      tenantId
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByChild(tenantId: string, childDistributorId: string): Promise<DistributorHierarchy | null> {
    return this.findByChildDistributor(tenantId, childDistributorId);
  }

  async findByParentDistributor(tenantId: string, parentDistributorId: string): Promise<DistributorHierarchy[]> {
    const result = await this.db.query<BaseRow>(
      `SELECT * FROM distributor_hierarchy WHERE tenant_id = $1 AND parent_distributor_id = $2 AND is_active = true`,
      [tenantId, parentDistributorId],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async findByParent(tenantId: string, parentDistributorId: string): Promise<DistributorHierarchy[]> {
    return this.findByParentDistributor(tenantId, parentDistributorId);
  }

  async findActive(tenantId: string): Promise<DistributorHierarchy[]> {
    const memList = Array.from(DistributorHierarchyPgRepository.inMemoryStore.values()).filter(h => h.tenantId === tenantId && h.isActive);
    if (memList.length > 0) return memList;
    return this.findAll(tenantId);
  }


  async findByLevel(tenantId: string, level: HierarchyLevel): Promise<DistributorHierarchy[]> {
    const result = await this.db.query<BaseRow>(
      `SELECT * FROM distributor_hierarchy WHERE tenant_id = $1 AND hierarchy_level = $2`,
      [tenantId, level],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async findAncestors(tenantId: string, distributorId: string): Promise<DistributorHierarchy[]> {
    const result = await this.db.query<BaseRow>(
      `WITH RECURSIVE ancestors AS (
        SELECT * FROM distributor_hierarchy WHERE tenant_id = $1 AND child_distributor_id = $2 AND is_active = true
        UNION ALL
        SELECT dh.* FROM distributor_hierarchy dh
        INNER JOIN ancestors a ON dh.child_distributor_id = a.parent_distributor_id AND dh.tenant_id = $1 AND dh.is_active = true
      )
      SELECT * FROM ancestors`,
      [tenantId, distributorId],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async findDescendants(tenantId: string, distributorId: string): Promise<DistributorHierarchy[]> {
    const result = await this.db.query<BaseRow>(
      `WITH RECURSIVE descendants AS (
        SELECT * FROM distributor_hierarchy WHERE tenant_id = $1 AND parent_distributor_id = $2 AND is_active = true
        UNION ALL
        SELECT dh.* FROM distributor_hierarchy dh
        INNER JOIN descendants d ON dh.parent_distributor_id = d.child_distributor_id AND dh.tenant_id = $1 AND dh.is_active = true
      )
      SELECT * FROM descendants`,
      [tenantId, distributorId],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async findAll(tenantId: string): Promise<DistributorHierarchy[]> {
    const result = await this.db.query<BaseRow>(
      `SELECT * FROM distributor_hierarchy WHERE tenant_id = $1 ORDER BY hierarchy_level, created_at`,
      [tenantId],
      tenantId
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.db.query(
      `DELETE FROM distributor_hierarchy WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
      tenantId
    );
  }

  private toDomain(row: any): DistributorHierarchy {
    return new DistributorHierarchy({
      id: row.id,
      tenantId: row.tenant_id,
      parentDistributorId: row.parent_distributor_id,
      childDistributorId: row.child_distributor_id,
      hierarchyLevel: row.hierarchy_level,
      territory: row.territory,
      effectiveFrom: row.effective_from?.toISOString?.() ?? row.effective_from,
      effectiveTo: row.effective_to?.toISOString?.() ?? row.effective_to,
      isActive: row.is_active,
      version: row.version,
    });
  }
}
