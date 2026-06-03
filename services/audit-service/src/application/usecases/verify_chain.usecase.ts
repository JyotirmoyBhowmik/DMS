import { StructuredLogger } from '@dms/pkg-logger';
import { AuditRepository } from '../../domain/repositories/audit.repository.js';

export interface VerifyChainResult {
  isChainValid: boolean;
  totalBlocks: number;
  logs: string[];
}

export class VerifyChainUseCase {
  private logger = new StructuredLogger('VerifyChainUseCase');

  async execute(repo: AuditRepository): Promise<VerifyChainResult> {
    this.logger.info('Initializing cryptographic ledger integrity validation scan...');
    const blocks = await repo.getAllBlocks();
    const verificationLogs: string[] = [];
    let isChainValid = true;

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];

      // 1. Verify prevHash link
      if (i > 0) {
        const prevBlock = blocks[i - 1];
        if (block.prevHash !== prevBlock.hash) {
          isChainValid = false;
          const msg = `[TAMPER_DETECTED] PrevHash mismatch in Block #${block.blockNumber}. Expected link: ${prevBlock.hash.slice(0, 12)}..., found: ${block.prevHash.slice(0, 12)}...`;
          verificationLogs.push(msg);
          this.logger.error(msg);
          continue;
        }
      }

      // 2. Verify current block hash recalculated matches stored hash
      if (!block.verify()) {
        isChainValid = false;
        const recalculated = block.hash; // recalculation happens within verify()
        const msg = `[TAMPER_DETECTED] Data tampering detected in Block #${block.blockNumber}. Hash mismatch. Stored: ${block.hash.slice(0, 12)}...`;
        verificationLogs.push(msg);
        this.logger.error(msg);
      } else {
        verificationLogs.push(`[OK] Block #${block.blockNumber} hash chain verified`);
      }
    }

    this.logger.info('Cryptographic ledger integrity scan complete', { isChainValid, totalBlocks: blocks.length });

    return {
      isChainValid,
      totalBlocks: blocks.length,
      logs: verificationLogs,
    };
  }
}
