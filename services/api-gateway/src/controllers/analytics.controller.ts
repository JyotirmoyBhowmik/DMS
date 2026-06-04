import { RequirePermissions } from '@dms/pkg-rbac';
// Assuming we are importing these queries to be executed or simply mapped.
// In a true microservices architecture, the gateway would forward these over HTTP,
// but the prompt instructs to wire it up by importing the queries.
import { SalesPerformanceQuery, SalesPerformanceResult } from '@dms/sfa-service/src/application/queries/sales-performance.query.js';
import { DistributorProfitabilityQuery, DistributorProfitabilityResult } from '@dms/dms-core-service/src/application/queries/distributor-profitability.query.js';

export class AnalyticsController {
  constructor(
    private readonly salesPerformanceQuery: SalesPerformanceQuery,
    private readonly distributorProfitabilityQuery: DistributorProfitabilityQuery
  ) {}

  @RequirePermissions('analytics:sales-performance:read', 'report:read')
  async getSalesPerformance(tenantId: string, startDate: Date, endDate: Date): Promise<SalesPerformanceResult[]> {
    return this.salesPerformanceQuery.execute(tenantId, { startDate, endDate });
  }

  @RequirePermissions('analytics:distributor-profitability:read', 'report:read')
  async getDistributorProfitability(tenantId: string, startDate: Date, endDate: Date): Promise<DistributorProfitabilityResult[]> {
    return this.distributorProfitabilityQuery.execute(tenantId, { startDate, endDate });
  }
}
