export class ResilientHttpClient {
  static async request(url: string, options: any = {}): Promise<any> {
    // Standard stub representing an OTel-instrumented resilient HTTP client
    return { status: 200, data: { success: true, url, options } };
  }
}
