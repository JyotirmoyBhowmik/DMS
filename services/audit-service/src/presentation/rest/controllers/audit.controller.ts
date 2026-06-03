import { StructuredLogger } from '@dms/pkg-logger';
import { RecordAuditUseCase } from '../../../application/usecases/record_audit.usecase.js';
import { VerifyChainUseCase } from '../../../application/usecases/verify_chain.usecase.js';
import { InMemoryAuditRepository } from '../../../domain/repositories/audit.repository.js';

export class AuditController {
  private logger = new StructuredLogger('AuditController');
  private repo = new InMemoryAuditRepository();
  private recordUseCase = new RecordAuditUseCase();
  private verifyUseCase = new VerifyChainUseCase();

  getRepository(): InMemoryAuditRepository {
    return this.repo;
  }

  async handlePostRecordEvent(eventEnvelope: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received request to append audit log', { tenantId, eventId: eventEnvelope?.eventId });

    try {
      const result = await this.recordUseCase.execute(this.repo, tenantId, eventEnvelope);
      return {
        statusCode: 201,
        body: {
          success: true,
          blockNumber: result.blockNumber,
          hash: result.hash,
          recorded: true,
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to append audit log', { error: err.message });
      return {
        statusCode: 500,
        body: {
          error: err.message || 'Internal Server Error',
        },
      };
    }
  }

  async handleVerifyChain(): Promise<any> {
    this.logger.info('Received request to verify cryptographic ledger integrity');
    try {
      const result = await this.verifyUseCase.execute(this.repo);
      return {
        statusCode: 200,
        body: {
          isChainValid: result.isChainValid,
          totalBlocks: result.totalBlocks,
          logs: result.logs,
        },
      };
    } catch (err: any) {
      this.logger.error('Ledger verification failed', { error: err.message });
      return {
        statusCode: 500,
        body: {
          error: err.message || 'Internal Server Error',
        },
      };
    }
  }

  // Simulator helper to demonstrate block tampering detection
  async simulateTampering(blockNumber: number, alteredData: any): Promise<void> {
    this.logger.warn(`[SIMULATION] Tampering with block #${blockNumber} content...`);
    await this.repo.simulateTampering(blockNumber, alteredData);
  }
}
