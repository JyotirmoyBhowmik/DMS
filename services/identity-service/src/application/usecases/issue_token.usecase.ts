import { generateKeyPairSync, createSign } from 'node:crypto';
import { StructuredLogger } from '@dms/pkg-logger';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Generate an ephemeral RSA keypair for RS256 signing (keys would normally load from Vault/HSM)
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

export const JWKS_PUBLIC_KEY = publicKey;

export class IssueTokenUseCase {
  private logger = new StructuredLogger('IssueTokenUseCase');

  async execute(tenantId: string, email: string, roles: string[]): Promise<TokenPair> {
    this.logger.info('Issuing RS256 JWT token pair for user', { email, tenantId });

    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600; // 1 hour access token

    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      sub: email,
      email,
      tenantId,
      roles,
      iat,
      exp,
      jti: Math.random().toString(36).substring(2, 15),
    })).toString('base64url');

    const signatureInput = `${header}.${payload}`;
    const signer = createSign('RSA-SHA256');
    signer.update(signatureInput);
    const signature = signer.sign(privateKey, 'base64url');

    const accessToken = `${signatureInput}.${signature}`;

    // Refresh token can be a secure random token family identifier
    const refreshToken = 'rt-' + Math.random().toString(36).substring(2, 15) + '-' + Math.random().toString(36).substring(2, 15);

    this.logger.info('Token pair generated successfully', { email });

    return {
      accessToken,
      refreshToken,
      expiresIn: 3600,
    };
  }
}
