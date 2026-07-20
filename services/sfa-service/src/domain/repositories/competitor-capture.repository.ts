import { CompetitorCapture } from '../entities/competitor-capture.js';

/**
 * Repository port for CompetitorCapture aggregate persistence.
 */
export abstract class CompetitorCaptureRepository {
  abstract save(capture: CompetitorCapture): Promise<CompetitorCapture>;
  abstract findById(id: string, tenantId: string): Promise<CompetitorCapture | null>;
  abstract findByAgent(agentId: string, tenantId: string): Promise<CompetitorCapture[]>;
  abstract findByOutlet(outletId: string, tenantId: string): Promise<CompetitorCapture[]>;
  abstract findAll(tenantId: string, limit?: number, offset?: number): Promise<CompetitorCapture[]>;
  abstract delete(id: string, tenantId: string): Promise<void>;
  abstract count(tenantId: string): Promise<number>;
}
