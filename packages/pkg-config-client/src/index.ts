export class ConfigClient {
  getFeatureFlag(key: string, tenantId: string): boolean {
    const fallbackFlags: Record<string, boolean> = {
      'enable-ai-recommendations': true,
      'strict-offline-integrity': false,
    };
    return fallbackFlags[key] ?? false;
  }
}
