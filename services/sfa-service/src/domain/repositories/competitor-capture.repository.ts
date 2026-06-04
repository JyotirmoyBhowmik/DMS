import { CompetitorCapture } from '../entities/competitor-capture';

export interface ICompetitorCaptureRepository {
  save(capture: CompetitorCapture): Promise<void>;
  findById(id: string): Promise<CompetitorCapture | null>;
  findByOutlet(outletId: string, tenantId: string): Promise<CompetitorCapture[]>;
  findByTenant(tenantId: string, limit?: number, offset?: number): Promise<CompetitorCapture[]>;
}
