import { BaseReadQuery } from '@dms/pkg-analytics';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { Logger } from '@dms/pkg-logger';

export interface SalesPerformanceResult {
  agentId: string;
  agentName: string;
  targetAmount: number;
  achievedAmount: number;
  achievementPercentage: number;
  leaderboardRank: number;
  routeAdherencePercentage: number;
}

export class SalesPerformanceQuery extends BaseReadQuery {
  constructor(dbDriver: PostgresDatabaseClient, logger: Logger) {
    super(dbDriver, logger);
  }

  async execute(tenantId: string, timePeriod: { startDate: Date; endDate: Date }): Promise<SalesPerformanceResult[]> {
    const cacheKey = `sales-performance:${tenantId}:${timePeriod.startDate.toISOString()}:${timePeriod.endDate.toISOString()}`;
    
    return this.withCache(cacheKey, 3600, async () => {
      // Complex SQL query to calculate agent sales achievements against SalesTarget,
      // leaderboard rankings, and route adherence.
      const query = `
        WITH agent_sales AS (
          SELECT
            a.id as agent_id,
            a.name as agent_name,
            COALESCE(SUM(o.total_amount), 0) as achieved_amount,
            COUNT(o.id) as total_orders
          FROM agents a
          LEFT JOIN orders o ON o.agent_id = a.id 
            AND o.created_at >= $2 
            AND o.created_at <= $3
            AND o.tenant_id = $1
          WHERE a.tenant_id = $1
          GROUP BY a.id, a.name
        ),
        agent_targets AS (
          SELECT
            agent_id,
            COALESCE(SUM(target_amount), 0) as target_amount
          FROM sales_targets
          WHERE tenant_id = $1 
            AND target_date >= $2 
            AND target_date <= $3
          GROUP BY agent_id
        ),
        route_adherence AS (
          SELECT
            agent_id,
            CAST(SUM(CASE WHEN visited_on_time = true THEN 1 ELSE 0 END) AS FLOAT) / NULLIF(COUNT(id), 0) * 100 as adherence_percentage
          FROM route_visits
          WHERE tenant_id = $1
            AND visit_date >= $2
            AND visit_date <= $3
          GROUP BY agent_id
        )
        SELECT
          s.agent_id as "agentId",
          s.agent_name as "agentName",
          COALESCE(t.target_amount, 0) as "targetAmount",
          s.achieved_amount as "achievedAmount",
          CASE 
            WHEN COALESCE(t.target_amount, 0) > 0 THEN (s.achieved_amount / t.target_amount) * 100 
            ELSE 0 
          END as "achievementPercentage",
          RANK() OVER (ORDER BY s.achieved_amount DESC) as "leaderboardRank",
          COALESCE(r.adherence_percentage, 0) as "routeAdherencePercentage"
        FROM agent_sales s
        LEFT JOIN agent_targets t ON s.agent_id = t.agent_id
        LEFT JOIN route_adherence r ON s.agent_id = r.agent_id
        ORDER BY "leaderboardRank" ASC;
      `;
      
      const result = await this.dbDriver.query(query, [
        tenantId,
        timePeriod.startDate,
        timePeriod.endDate
      ]);
      
      return result.rows as SalesPerformanceResult[];
    });
  }
}
