import { createHmac } from 'crypto';

export class HmacSigner {
  static sign(data: string, secret: string): string {
    return createHmac('sha256', secret).update(data).digest('hex');
  }

  static verify(data: string, signature: string, secret: string): boolean {
    const expected = this.sign(data, secret);
    return expected === signature;
  }
}
