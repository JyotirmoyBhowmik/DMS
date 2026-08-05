import { SalesTarget } from '../entities/sales-target.js';

export interface SalesTargetRepository {
  save(target: SalesTarget, tenantId: string): Promise<SalesTarget>;
  findById(id: string, tenantId: string): Promise<SalesTarget | null>;
  findByAgentAndPeriod(
    agentId: string,
    periodMonth: number,
    periodYear: number,
    tenantId: string
  ): Promise<SalesTarget[]>;
  findAll(tenantId: string, limit?: number, offset?: number): Promise<SalesTarget[]>;
  delete(id: string, tenantId: string): Promise<void>;
  count(tenantId: string): Promise<number>;
}
