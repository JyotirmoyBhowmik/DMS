import { BaseReadQuery } from '@dms/pkg-analytics';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { Logger } from '@dms/pkg-logger';

export interface DistributorProfitabilityResult {
  distributorId: string;
  distributorName: string;
  totalRevenue: number;
  totalCost: number;
  grossMargin: number;
  grossMarginPercentage: number;
  schemesApplied: number;
  creditLimitUtilization: number;
}

export class DistributorProfitabilityQuery extends BaseReadQuery {
  constructor(dbDriver: PostgresDatabaseClient, logger: Logger) {
    super(dbDriver, logger);
  }

  async execute(tenantId: string, timePeriod: { startDate: Date; endDate: Date }): Promise<DistributorProfitabilityResult[]> {
    const cacheKey = `distributor-profitability:${tenantId}:${timePeriod.startDate.toISOString()}:${timePeriod.endDate.toISOString()}`;
    
    return this.withCache(cacheKey, 3600, async () => {
      // Complex SQL query joining invoices, schemes, and credit limits to compute distributor profitability margins.
      const query = `
        WITH distributor_invoices AS (
          SELECT
            d.id as distributor_id,
            d.name as distributor_name,
            COALESCE(SUM(i.total_amount), 0) as total_revenue,
            COALESCE(SUM(i.cost_of_goods), 0) as total_cost,
            COUNT(i.id) as invoice_count
          FROM distributors d
          LEFT JOIN invoices i ON i.distributor_id = d.id
            AND i.created_at >= $2
            AND i.created_at <= $3
            AND i.tenant_id = $1
          WHERE d.tenant_id = $1
          GROUP BY d.id, d.name
        ),
        distributor_schemes AS (
          SELECT
            distributor_id,
            COALESCE(SUM(discount_amount), 0) as total_scheme_discount
          FROM applied_schemes
          WHERE tenant_id = $1
            AND applied_date >= $2
            AND applied_date <= $3
          GROUP BY distributor_id
        ),
        distributor_credit AS (
          SELECT
            d.id as distributor_id,
            CASE 
              WHEN d.credit_limit > 0 THEN (COALESCE(SUM(c.outstanding_amount), 0) / d.credit_limit) * 100
              ELSE 0 
            END as credit_utilization
          FROM distributors d
          LEFT JOIN credit_invoices c ON c.distributor_id = d.id AND c.tenant_id = $1
          WHERE d.tenant_id = $1
          GROUP BY d.id, d.credit_limit
        )
        SELECT
          di.distributor_id as "distributorId",
          di.distributor_name as "distributorName",
          di.total_revenue as "totalRevenue",
          di.total_cost as "totalCost",
          (di.total_revenue - di.total_cost - COALESCE(ds.total_scheme_discount, 0)) as "grossMargin",
          CASE 
            WHEN di.total_revenue > 0 THEN ((di.total_revenue - di.total_cost - COALESCE(ds.total_scheme_discount, 0)) / di.total_revenue) * 100
            ELSE 0
          END as "grossMarginPercentage",
          COALESCE(ds.total_scheme_discount, 0) as "schemesApplied",
          COALESCE(dc.credit_utilization, 0) as "creditLimitUtilization"
        FROM distributor_invoices di
        LEFT JOIN distributor_schemes ds ON di.distributor_id = ds.distributor_id
        LEFT JOIN distributor_credit dc ON di.distributor_id = dc.distributor_id
        ORDER BY "grossMarginPercentage" DESC;
      `;
      
      const result = await this.dbDriver.query(query, [
        tenantId,
        timePeriod.startDate,
        timePeriod.endDate
      ]);
      
      return result.rows as DistributorProfitabilityResult[];
    });
  }
}
