export class VaultClient {
  private vaultUrl: string;
  private token: string;

  constructor(vaultUrl = 'http://localhost:8200', token = 'root') {
    this.vaultUrl = vaultUrl;
    this.token = token;
  }

  async getSecret(path: string): Promise<Record<string, any>> {
    // Standard mock structure matching HashiCorp Vault dynamic database credentials
    // Path: secret/data/dms-core
    return {
      key: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', // mock 256-bit key
      client_secret: `mock-client-secret-for-${path}`
    };
  }
}
