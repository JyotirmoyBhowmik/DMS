/**
 * Postgres Repository for DistributorHierarchy.
 * Uses parameterized SQL for all queries.
 */
import { DistributorHierarchy, HierarchyLevel } from '../../../domain/entities/distributor-hierarchy.js';
import { DistributorHierarchyRepository } from '../../../domain/repositories/distributor-hierarchy.repository.js';

export class DistributorHierarchyPgRepository extends DistributorHierarchyRepository {
  constructor(private pool: any) {
    super();
  }

  async save(h: DistributorHierarchy): Promise<void> {
    const data = h.toJSON();
    await this.pool.query(
      `INSERT INTO distributor_hierarchy
        (id, tenant_id, parent_distributor_id, child_distributor_id, hierarchy_level,
         territory, effective_from, effective_to, is_active, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         parent_distributor_id = $3, child_distributor_id = $4, hierarchy_level = $5,
         territory = $6, effective_from = $7, effective_to = $8, is_active = $9, version = $10`,
      [data.id, data.tenantId, data.parentDistributorId, data.childDistributorId,
       data.hierarchyLevel, data.territory, data.effectiveFrom, data.effectiveTo ?? null,
       data.isActive, data.version]
    );
  }

  async findById(tenantId: string, id: string): Promise<DistributorHierarchy | null> {
    const result = await this.pool.query(
      `SELECT * FROM distributor_hierarchy WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id]
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByChildDistributor(tenantId: string, childDistributorId: string): Promise<DistributorHierarchy | null> {
    const result = await this.pool.query(
      `SELECT * FROM distributor_hierarchy WHERE tenant_id = $1 AND child_distributor_id = $2 AND is_active = true`,
      [tenantId, childDistributorId]
    );
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByParentDistributor(tenantId: string, parentDistributorId: string): Promise<DistributorHierarchy[]> {
    const result = await this.pool.query(
      `SELECT * FROM distributor_hierarchy WHERE tenant_id = $1 AND parent_distributor_id = $2 AND is_active = true`,
      [tenantId, parentDistributorId]
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async findByLevel(tenantId: string, level: HierarchyLevel): Promise<DistributorHierarchy[]> {
    const result = await this.pool.query(
      `SELECT * FROM distributor_hierarchy WHERE tenant_id = $1 AND hierarchy_level = $2`,
      [tenantId, level]
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async findAncestors(tenantId: string, distributorId: string): Promise<DistributorHierarchy[]> {
    const result = await this.pool.query(
      `WITH RECURSIVE ancestors AS (
        SELECT * FROM distributor_hierarchy WHERE tenant_id = $1 AND child_distributor_id = $2 AND is_active = true
        UNION ALL
        SELECT dh.* FROM distributor_hierarchy dh
        INNER JOIN ancestors a ON dh.child_distributor_id = a.parent_distributor_id AND dh.tenant_id = $1 AND dh.is_active = true
      )
      SELECT * FROM ancestors`,
      [tenantId, distributorId]
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async findDescendants(tenantId: string, distributorId: string): Promise<DistributorHierarchy[]> {
    const result = await this.pool.query(
      `WITH RECURSIVE descendants AS (
        SELECT * FROM distributor_hierarchy WHERE tenant_id = $1 AND parent_distributor_id = $2 AND is_active = true
        UNION ALL
        SELECT dh.* FROM distributor_hierarchy dh
        INNER JOIN descendants d ON dh.parent_distributor_id = d.child_distributor_id AND dh.tenant_id = $1 AND dh.is_active = true
      )
      SELECT * FROM descendants`,
      [tenantId, distributorId]
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async findAll(tenantId: string): Promise<DistributorHierarchy[]> {
    const result = await this.pool.query(
      `SELECT * FROM distributor_hierarchy WHERE tenant_id = $1 ORDER BY hierarchy_level, created_at`,
      [tenantId]
    );
    return result.rows.map((r: any) => this.toDomain(r));
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM distributor_hierarchy WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id]
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
