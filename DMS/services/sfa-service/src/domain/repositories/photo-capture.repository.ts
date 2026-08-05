import { PhotoCapture } from '../entities/photo-capture.js';

/**
 * Repository port for PhotoCapture aggregate persistence.
 */
export abstract class PhotoCaptureRepository {
  abstract save(capture: PhotoCapture): Promise<PhotoCapture>;
  abstract findById(id: string, tenantId: string): Promise<PhotoCapture | null>;
  abstract findByAgent(agentId: string, tenantId: string): Promise<PhotoCapture[]>;
  abstract findByOutlet(outletId: string, tenantId: string): Promise<PhotoCapture[]>;
  abstract findAll(tenantId: string, limit?: number, offset?: number): Promise<PhotoCapture[]>;
  abstract delete(id: string, tenantId: string): Promise<void>;
  abstract count(tenantId: string): Promise<number>;
}
