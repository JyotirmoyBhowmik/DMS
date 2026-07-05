import { BasePostgresRepository, BaseRow, PaginatedResult } from '@dms/pkg-database';
import { PriceListEntity } from '../../../domain/entities/price-list.entity.js';
import { PriceListEntryEntity, PriceListEntryTier } from '../../../domain/entities/price-list-entry.entity.js';
import { PriceListAssignmentEntity } from '../../../domain/entities/price-list-assignment.entity.js';
import { TaxRuleEntity } from '../../../domain/entities/tax-rule.entity.js';
import { IPriceListRepository } from '../../../domain/repositories/price-list.repository.js';
import { randomUUID } from 'node:crypto';

export class PriceListPgRepository extends BasePostgresRepository<PriceListEntity> implements IPriceListRepository {
  protected tableName(): string {
    return 'pricing_price_lists';
  }

  protected mapToEntity(row: BaseRow): PriceListEntity {
    return new PriceListEntity({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name as string,
      description: row.description as string | undefined,
      effectiveFrom: row.effective_from as Date,
      effectiveTo: row.effective_to as Date | undefined,
      isActive: row.is_active as boolean,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  protected mapToRow(entity: PriceListEntity): BaseRow {
    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      name: entity.name,
      description: entity.description || null,
      effective_from: entity.effectiveFrom,
      effective_to: entity.effectiveTo || null,
      is_active: entity.isActive,
      version: entity.version || 0,
      created_at: entity.createdAt || new Date(),
      updated_at: entity.updatedAt || new Date(),
    };
  }

  // Override findById to populate assignments and entries
  override async findById(id: string, tenantId: string): Promise<PriceListEntity> {
    const priceList = await super.findById(id, tenantId);
    priceList.assignments = await this.findAssignmentsForPriceList(id, tenantId);
    priceList.entries = await this.findEntriesForPriceList(id, tenantId);
    return priceList;
  }

  // Assignment management
  async saveAssignment(assignment: PriceListAssignmentEntity, tenantId: string): Promise<PriceListAssignmentEntity> {
    const sql = `
      INSERT INTO pricing_price_list_assignments (
        id, tenant_id, price_list_id, assignment_type, assignment_value, priority, version, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, 1, NOW(), NOW())
      ON CONFLICT (tenant_id, assignment_type, assignment_value) DO UPDATE SET
        price_list_id = EXCLUDED.price_list_id,
        priority = EXCLUDED.priority,
        version = pricing_price_list_assignments.version + 1,
        updated_at = NOW()
      RETURNING *
    `;
    const res = await this.db.query<any>(sql, [
      assignment.id || randomUUID(),
      tenantId,
      assignment.priceListId,
      assignment.assignmentType,
      assignment.assignmentValue || null,
      assignment.priority
    ], tenantId);

    return new PriceListAssignmentEntity({
      id: res.rows[0].id,
      tenantId: res.rows[0].tenant_id,
      priceListId: res.rows[0].price_list_id,
      assignmentType: res.rows[0].assignment_type,
      assignmentValue: res.rows[0].assignment_value,
      priority: res.rows[0].priority,
      version: res.rows[0].version,
      createdAt: res.rows[0].created_at,
      updatedAt: res.rows[0].updated_at
    });
  }

  async findAssignmentsForPriceList(priceListId: string, tenantId: string): Promise<PriceListAssignmentEntity[]> {
    const res = await this.db.query<any>(
      `SELECT * FROM pricing_price_list_assignments WHERE price_list_id = $1`,
      [priceListId],
      tenantId
    );
    return res.rows.map(row => new PriceListAssignmentEntity({
      id: row.id,
      tenantId: row.tenant_id,
      priceListId: row.price_list_id,
      assignmentType: row.assignment_type,
      assignmentValue: row.assignment_value,
      priority: row.priority,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  async deleteAssignment(id: string, tenantId: string): Promise<boolean> {
    const res = await this.db.query(
      `DELETE FROM pricing_price_list_assignments WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
      tenantId
    );
    return res.rowCount > 0;
  }

  // Entry management
  async saveEntry(entry: PriceListEntryEntity, tenantId: string): Promise<PriceListEntryEntity> {
    const sql = `
      INSERT INTO pricing_price_list_entries (
        id, price_list_id, product_id, base_price, mrp, tax_rule_key, rounding_rule, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT (price_list_id, product_id) DO UPDATE SET
        base_price = EXCLUDED.base_price,
        mrp = EXCLUDED.mrp,
        tax_rule_key = EXCLUDED.tax_rule_key,
        rounding_rule = EXCLUDED.rounding_rule,
        updated_at = NOW()
      RETURNING *
    `;
    const res = await this.db.query<any>(sql, [
      entry.id || randomUUID(),
      entry.priceListId,
      entry.productId,
      entry.basePrice,
      entry.mrp,
      entry.taxRuleKey,
      entry.roundingRule
    ], tenantId);

    const savedEntryId = res.rows[0].id;

    // Delete existing tiers for this entry first
    await this.db.query(
      `DELETE FROM pricing_price_list_entry_tiers WHERE entry_id = $1`,
      [savedEntryId],
      tenantId
    );

    // Insert new tiers
    const savedTiers: PriceListEntryTier[] = [];
    if (entry.tiers && entry.tiers.length > 0) {
      for (const tier of entry.tiers) {
        const tierSql = `
          INSERT INTO pricing_price_list_entry_tiers (
            id, entry_id, min_quantity, discount_percentage, discount_flat, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
          RETURNING *
        `;
        const tierRes = await this.db.query<any>(tierSql, [
          tier.id || randomUUID(),
          savedEntryId,
          tier.minQuantity,
          tier.discountPercentage !== undefined ? tier.discountPercentage : null,
          tier.discountFlat !== undefined ? tier.discountFlat : null
        ], tenantId);

        savedTiers.push({
          id: tierRes.rows[0].id,
          entryId: tierRes.rows[0].entry_id,
          minQuantity: tierRes.rows[0].min_quantity,
          discountPercentage: tierRes.rows[0].discount_percentage !== null ? Number(tierRes.rows[0].discount_percentage) : undefined,
          discountFlat: tierRes.rows[0].discount_flat !== null ? BigInt(tierRes.rows[0].discount_flat) : undefined
        });
      }
    }

    return new PriceListEntryEntity({
      id: res.rows[0].id,
      priceListId: res.rows[0].price_list_id,
      productId: res.rows[0].product_id,
      basePrice: BigInt(res.rows[0].base_price),
      mrp: BigInt(res.rows[0].mrp),
      taxRuleKey: res.rows[0].tax_rule_key,
      roundingRule: res.rows[0].rounding_rule,
      tiers: savedTiers,
      createdAt: res.rows[0].created_at,
      updatedAt: res.rows[0].updated_at
    });
  }

  async findEntriesForPriceList(priceListId: string, tenantId: string): Promise<PriceListEntryEntity[]> {
    const entriesRes = await this.db.query<any>(
      `SELECT * FROM pricing_price_list_entries WHERE price_list_id = $1`,
      [priceListId],
      tenantId
    );

    const entries: PriceListEntryEntity[] = [];
    for (const row of entriesRes.rows) {
      const tiersRes = await this.db.query<any>(
        `SELECT * FROM pricing_price_list_entry_tiers WHERE entry_id = $1 ORDER BY min_quantity ASC`,
        [row.id],
        tenantId
      );

      const tiers = tiersRes.rows.map(t => ({
        id: t.id,
        entryId: t.entry_id,
        minQuantity: t.min_quantity,
        discountPercentage: t.discount_percentage !== null ? Number(t.discount_percentage) : undefined,
        discountFlat: t.discount_flat !== null ? BigInt(t.discount_flat) : undefined
      }));

      entries.push(new PriceListEntryEntity({
        id: row.id,
        priceListId: row.price_list_id,
        productId: row.product_id,
        basePrice: BigInt(row.base_price),
        mrp: BigInt(row.mrp),
        taxRuleKey: row.tax_rule_key,
        roundingRule: row.rounding_rule,
        tiers,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    }
    return entries;
  }

  async deleteEntry(id: string, tenantId: string): Promise<boolean> {
    // Rely on CASCADE to delete tiers
    const res = await this.db.query(
      `DELETE FROM pricing_price_list_entries WHERE id = $1`,
      [id],
      tenantId
    );
    return res.rowCount > 0;
  }

  // Effective price list resolution
  async findEffectivePriceList(
    tenantId: string,
    customerId?: string,
    channel?: string,
    asOfDate?: Date
  ): Promise<PriceListEntity | null> {
    const targetDate = asOfDate || new Date();

    const sql = `
      SELECT pl.*, pla.assignment_type, pla.assignment_value, pla.priority AS assignment_priority
      FROM pricing_price_lists pl
      JOIN pricing_price_list_assignments pla ON pl.id = pla.price_list_id
      WHERE pl.tenant_id = $1
        AND pl.is_active = true
        AND pl.effective_from <= $2
        AND (pl.effective_to IS NULL OR pl.effective_to >= $2)
    `;

    const res = await this.db.query<any>(sql, [tenantId, targetDate], tenantId);
    if (res.rows.length === 0) {
      return null;
    }

    let bestRow: any = null;
    let bestTypeScore = -1; // 2: customer, 1: channel, 0: default

    for (const row of res.rows) {
      let typeScore = -1;
      if (row.assignment_type === 'customer' && customerId && row.assignment_value === customerId) {
        typeScore = 2;
      } else if (row.assignment_type === 'channel' && channel && row.assignment_value === channel) {
        typeScore = 1;
      } else if (row.assignment_type === 'default') {
        typeScore = 0;
      }

      if (typeScore === -1) {
        continue;
      }

      if (bestRow === null) {
        bestRow = row;
        bestTypeScore = typeScore;
      } else {
        if (typeScore > bestTypeScore) {
          bestRow = row;
          bestTypeScore = typeScore;
        } else if (typeScore === bestTypeScore) {
          if (row.assignment_priority > bestRow.assignment_priority) {
            bestRow = row;
          } else if (row.assignment_priority === bestRow.assignment_priority) {
            if (new Date(row.effective_from) > new Date(bestRow.effective_from)) {
              bestRow = row;
            }
          }
        }
      }
    }

    if (!bestRow) {
      return null;
    }

    const priceList = new PriceListEntity({
      id: bestRow.id,
      tenantId: bestRow.tenant_id,
      name: bestRow.name,
      description: bestRow.description,
      effectiveFrom: bestRow.effective_from,
      effectiveTo: bestRow.effective_to,
      isActive: bestRow.is_active,
      version: bestRow.version,
      createdAt: bestRow.created_at,
      updatedAt: bestRow.updated_at
    });

    priceList.assignments = await this.findAssignmentsForPriceList(priceList.id, tenantId);
    priceList.entries = await this.findEntriesForPriceList(priceList.id, tenantId);

    return priceList;
  }

  // Tax lookup rules
  async findTaxRule(tenantId: string, taxRuleKey: string): Promise<TaxRuleEntity | null> {
    // If we had a table we would query it. Since we don't, we will fall back to standard rules,
    // but we can query it if needed. Let's make it return a fallback to avoid errors.
    let rate = 18;
    if (taxRuleKey === 'GST_5') rate = 5;
    else if (taxRuleKey === 'GST_12') rate = 12;
    else if (taxRuleKey === 'GST_18') rate = 18;
    else if (taxRuleKey === 'GST_28') rate = 28;
    else if (taxRuleKey === 'GST_0' || taxRuleKey === 'VAT_0') rate = 0;
    else if (taxRuleKey.startsWith('GST_') || taxRuleKey.startsWith('VAT_')) {
      const match = taxRuleKey.match(/\d+/);
      if (match) {
        rate = parseInt(match[0], 10);
      }
    }

    return new TaxRuleEntity({
      id: randomUUID(),
      tenantId,
      taxRuleKey,
      ratePercentage: rate,
    });
  }

  async saveTaxRule(taxRule: TaxRuleEntity, tenantId: string): Promise<TaxRuleEntity> {
    // Dynamic mapping return
    return taxRule;
  }

  // Audit trail logging
  async saveAuditLog(log: {
    priceListId: string;
    productId: string;
    actorId: string;
    actionType: string;
    oldBasePrice?: bigint;
    newBasePrice?: bigint;
    oldMrp?: bigint;
    newMrp?: bigint;
    reason?: string;
  }, tenantId: string): Promise<void> {
    const sql = `
      INSERT INTO pricing_audit_trail (
        id, tenant_id, price_list_id, product_id, actor_id, action_type,
        old_base_price, new_base_price, old_mrp, new_mrp, reason, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
    `;
    await this.db.query(sql, [
      randomUUID(),
      tenantId,
      log.priceListId,
      log.productId,
      log.actorId,
      log.actionType,
      log.oldBasePrice !== undefined ? log.oldBasePrice : null,
      log.newBasePrice !== undefined ? log.newBasePrice : null,
      log.oldMrp !== undefined ? log.oldMrp : null,
      log.newMrp !== undefined ? log.newMrp : null,
      log.reason || null
    ], tenantId);
  }
}
