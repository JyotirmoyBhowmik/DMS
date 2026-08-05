import { Visit } from '../entities/visit.js';

export abstract class VisitRepository {
  abstract save(visit: Visit): Promise<Visit>;
  abstract findById(visitId: string, tenantId: string): Promise<Visit | null>;
  abstract findByAgent(agentId: string, tenantId: string): Promise<Visit[]>;
  abstract findAll(tenantId: string): Promise<Visit[]>;
}
