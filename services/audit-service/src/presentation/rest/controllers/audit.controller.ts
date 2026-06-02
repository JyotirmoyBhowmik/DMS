import { StructuredLogger } from '@dms/pkg-logger';
import { createHash } from 'node:crypto';

interface AuditBlock {
  blockNumber: number;
  data: any;
  hash: string;
  prevHash: string;
  timestamp: string;
  tenantId: string;
}

export class AuditController {
  private logger = new StructuredLogger('AuditController');
  private chain: AuditBlock[] = [];
  private genesisHash = createHash('sha256').update('genesis-audit-chain').digest('hex');

  constructor() {
    this.seedGenesisBlock();
  }

  private seedGenesisBlock() {
    const timestamp = new Date().toISOString();
    const data = { message: 'Genesis Block initialized' };
    const hash = this.calculateBlockHash(1, this.genesisHash, data, timestamp);
    
    this.chain.push({
      blockNumber: 1,
      data,
      hash,
      prevHash: this.genesisHash,
      timestamp,
      tenantId: 'system'
    });
  }

  private calculateBlockHash(blockNumber: number, prevHash: string, data: any, timestamp: string): string {
    const payload = `${blockNumber}:${prevHash}:${JSON.stringify(data)}:${timestamp}`;
    return createHash('sha256').update(payload).digest('hex');
  }

  async handlePostRecordEvent(eventEnvelope: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received request to append audit log', { tenantId, eventId: eventEnvelope?.eventId });

    const prevBlock = this.chain[this.chain.length - 1];
    const blockNumber = prevBlock.blockNumber + 1;
    const timestamp = new Date().toISOString();
    const hash = this.calculateBlockHash(blockNumber, prevBlock.hash, eventEnvelope, timestamp);

    const block: AuditBlock = {
      blockNumber,
      data: eventEnvelope,
      hash,
      prevHash: prevBlock.hash,
      timestamp,
      tenantId
    };

    this.chain.push(block);

    this.logger.info('Audit log successfully recorded in append-only cryptographic store', {
      tenantId,
      blockNumber,
      hash: hash.slice(0, 16) + '...'
    });

    return {
      statusCode: 201,
      body: {
        success: true,
        blockNumber,
        hash,
        recorded: true,
      },
    };
  }

  async handleVerifyChain(): Promise<any> {
    this.logger.info('Initializing cryptographic ledger integrity validation scan...');
    const verificationLogs: string[] = [];
    let isChainValid = true;

    for (let i = 0; i < this.chain.length; i++) {
      const block = this.chain[i];
      
      // 1. Verify prevHash link
      if (i > 0) {
        const prevBlock = this.chain[i - 1];
        if (block.prevHash !== prevBlock.hash) {
          isChainValid = false;
          const msg = `[TAMPER_DETECTED] PrevHash mismatch in Block #${block.blockNumber}. Expected link: ${prevBlock.hash.slice(0, 12)}..., found: ${block.prevHash.slice(0, 12)}...`;
          verificationLogs.push(msg);
          this.logger.error(msg);
          continue;
        }
      } else {
        if (block.prevHash !== this.genesisHash) {
          isChainValid = false;
          verificationLogs.push(`[TAMPER_DETECTED] Genesis hash link corrupted in Block #1`);
          continue;
        }
      }

      // 2. Verify current block hash recalculated matches stored hash
      const recalculatedHash = this.calculateBlockHash(block.blockNumber, block.prevHash, block.data, block.timestamp);
      if (block.hash !== recalculatedHash) {
        isChainValid = false;
        const msg = `[TAMPER_DETECTED] Data tampering detected in Block #${block.blockNumber}. Hash mismatch. Stored: ${block.hash.slice(0, 12)}..., Calculated: ${recalculatedHash.slice(0, 12)}...`;
        verificationLogs.push(msg);
        this.logger.error(msg);
      } else {
        verificationLogs.push(`[OK] Block #${block.blockNumber} hash chain verified`);
      }
    }

    return {
      statusCode: 200,
      body: {
        isChainValid,
        totalBlocks: this.chain.length,
        logs: verificationLogs
      }
    };
  }

  // Simulator helper to demonstrate block tampering detection
  async simulateTampering(blockNumber: number, alteredData: any): Promise<void> {
    const block = this.chain.find(b => b.blockNumber === blockNumber);
    if (block) {
      this.logger.warn(`[SIMULATION] Tampering with block #${blockNumber} content...`);
      block.data = alteredData;
    }
  }
}
