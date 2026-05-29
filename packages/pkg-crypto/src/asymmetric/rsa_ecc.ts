import { generateKeyPairSync, publicEncrypt, privateDecrypt } from 'crypto';

export class RsaEccEnvelope {
  static generateRsaKeyPair(): { publicKey: string; privateKey: string } {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    return { publicKey, privateKey };
  }

  static encryptWithPublicKey(publicKey: string, data: string): string {
    const buffer = Buffer.from(data, 'utf8');
    const encrypted = publicEncrypt(publicKey, buffer);
    return encrypted.toString('base64');
  }

  static decryptWithPrivateKey(privateKey: string, base64Data: string): string {
    const buffer = Buffer.from(base64Data, 'base64');
    const decrypted = privateDecrypt(privateKey, buffer);
    return decrypted.toString('utf8');
  }
}
