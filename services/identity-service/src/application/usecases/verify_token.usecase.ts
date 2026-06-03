import { createVerify } from 'node:crypto';
import { StructuredLogger } from '@dms/pkg-logger';
import { KeyManager } from './key_manager.js';

export interface DecodedClaims {
  sub: string;
  email: string;
  tenantId: string;
  roles: string[];
  iat: number;
  exp: number;
}

export class VerifyTokenUseCase {
  private logger = new StructuredLogger('VerifyTokenUseCase');

  async execute(token: string): Promise<DecodedClaims> {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];
    const signatureInput = `${headerB64}.${payloadB64}`;

    // Decode header to extract Key ID (kid)
    let kid: string | undefined;
    try {
      const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
      kid = header.kid;
    } catch {
      // Tolerate parsing errors
    }

    // Lookup public key by kid or fallback to the current active key
    let publicKey = kid ? KeyManager.getInstance().getPublicKey(kid) : null;
    if (!publicKey) {
      publicKey = KeyManager.getInstance().getSigningKey().publicKey;
    }

    const verifier = createVerify('RSA-SHA256');
    verifier.update(signatureInput);
    
    const isValid = verifier.verify(publicKey, signatureB64, 'base64url');
    if (!isValid) {
      throw new Error('Invalid JWT signature');
    }

    // Decode and parse payload claims
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as DecodedClaims;

    // Check expiration boundaries
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      throw new Error('JWT token has expired');
    }

    return payload;
  }
}
