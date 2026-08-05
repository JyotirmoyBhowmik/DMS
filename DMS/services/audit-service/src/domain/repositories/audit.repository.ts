import { AuditBlock } from '../entities/audit-block.js';
import { createHash } from 'node:crypto';

export interface AuditRepository {
  append(block: AuditBlock): Promise<AuditBlock>;
  getLastBlock(): Promise<AuditBlock | null>;
  getAllBlocks(): Promise<AuditBlock[]>;
  clear(): Promise<void>;
  simulateTampering(blockNumber: number, alteredData: any): Promise<void>;
}

export class InMemoryAuditRepository implements AuditRepository {
  private chain: AuditBlock[] = [];
  private genesisHash = createHash('sha256').update('genesis-audit-chain').digest('hex');

  constructor() {
    this.seedGenesisBlock();
  }

  private seedGenesisBlock() {
    const genesis = AuditBlock.create({
      blockNumber: 1,
      prevHash: this.genesisHash,
      data: { message: 'Genesis Block initialized' },
      tenantId: 'system',
    });
    this.chain.push(genesis);
  }

  async append(block: AuditBlock): Promise<AuditBlock> {
    this.chain.push(block);
    return block;
  }

  async getLastBlock(): Promise<AuditBlock | null> {
    return this.chain.length > 0 ? this.chain[this.chain.length - 1] : null;
  }

  async getAllBlocks(): Promise<AuditBlock[]> {
    return [...this.chain];
  }

  async clear(): Promise<void> {
    this.chain = [];
    this.seedGenesisBlock();
  }

  async simulateTampering(blockNumber: number, alteredData: any): Promise<void> {
    const idx = this.chain.findIndex((b) => b.blockNumber === blockNumber);
    if (idx !== -1) {
      const block = this.chain[idx];
      // Forcefully alter props directly to simulate DB tampering bypassing business validation
      const props = block.toJSON();
      props.data = alteredData;
      this.chain[idx] = AuditBlock.reconstitute(props);
    }
  }
}
