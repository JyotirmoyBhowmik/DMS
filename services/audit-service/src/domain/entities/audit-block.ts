import { createHash } from 'node:crypto';

export interface AuditBlockProps {
  blockNumber: number;
  data: any;
  hash: string;
  prevHash: string;
  timestamp: string;
  tenantId: string;
}

export class AuditBlock {
  private props: AuditBlockProps;

  private constructor(props: AuditBlockProps) {
    this.props = { ...props };
  }

  static create(input: {
    blockNumber: number;
    prevHash: string;
    data: any;
    tenantId: string;
    timestamp?: string;
  }): AuditBlock {
    const timestamp = input.timestamp ?? new Date().toISOString();
    const hash = this.calculateHash(input.blockNumber, input.prevHash, input.data, timestamp);
    return new AuditBlock({
      blockNumber: input.blockNumber,
      prevHash: input.prevHash,
      data: input.data,
      hash,
      timestamp,
      tenantId: input.tenantId,
    });
  }

  static reconstitute(props: AuditBlockProps): AuditBlock {
    return new AuditBlock(props);
  }

  get blockNumber(): number { return this.props.blockNumber; }
  get data(): any { return this.props.data; }
  get hash(): string { return this.props.hash; }
  get prevHash(): string { return this.props.prevHash; }
  get timestamp(): string { return this.props.timestamp; }
  get tenantId(): string { return this.props.tenantId; }

  static calculateHash(blockNumber: number, prevHash: string, data: any, timestamp: string): string {
    const payload = `${blockNumber}:${prevHash}:${JSON.stringify(data)}:${timestamp}`;
    return createHash('sha256').update(payload).digest('hex');
  }

  verify(): boolean {
    const recalculated = AuditBlock.calculateHash(
      this.blockNumber,
      this.prevHash,
      this.data,
      this.timestamp
    );
    return this.hash === recalculated;
  }

  toJSON(): AuditBlockProps {
    return { ...this.props };
  }
}
