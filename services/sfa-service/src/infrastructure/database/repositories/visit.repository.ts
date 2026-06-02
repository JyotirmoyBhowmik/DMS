import { Visit } from '../../../domain/entities/visit.js';
import { StructuredLogger } from '@dms/pkg-logger';

export class VisitRepository {
  private logger = new StructuredLogger('VisitRepository');
  private dbStore: Map<string, Visit> = new Map();

  async save(visit: Visit): Promise<Visit> {
    this.logger.info('Saving visit record to repository store', { visitId: visit.id, tenantId: visit.tenantId });
    this.dbStore.set(visit.id, visit);
    return visit;
  }

  async findById(visitId: string, tenantId: string): Promise<Visit | null> {
    this.logger.info('Querying visit by identifier', { visitId, tenantId });
    const match = this.dbStore.get(visitId);
    if (match && match.tenantId === tenantId) {
      return match;
    }
    return null;
  }

  async findByAgent(agentId: string, tenantId: string): Promise<Visit[]> {
    this.logger.info('Querying visits by agent', { agentId, tenantId });
    return Array.from(this.dbStore.values()).filter(v => v.agentId === agentId && v.tenantId === tenantId);
  }
}
