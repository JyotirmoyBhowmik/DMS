import { ITaxCompliancePort } from './tax-compliance-port.interface';
import { Logger } from '@dms/pkg-logger';

export class IndiaNicGstAdapter implements ITaxCompliancePort {
  constructor(private readonly logger: Logger) {}

  async generateEInvoice(invoiceId: string, payload: any): Promise<any> {
    this.logger.info(`Generating E-Invoice for ${invoiceId} via India NIC GST API`);
    await this.simulateApiCall();
    
    const irn = `IRN-${Date.now()}-${invoiceId}`;
    this.logger.info(`E-Invoice generated successfully. IRN: ${irn}`);
    
    return {
      invoiceId,
      irn,
      status: 'GENERATED',
      qrCode: 'mock-qr-code-data',
    };
  }

  async cancelEInvoice(invoiceId: string, reason: string): Promise<boolean> {
    this.logger.info(`Cancelling E-Invoice ${invoiceId} via India NIC GST API. Reason: ${reason}`);
    await this.simulateApiCall();
    this.logger.info(`E-Invoice ${invoiceId} cancelled successfully`);
    return true;
  }

  private simulateApiCall(): Promise<void> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.9) {
          reject(new Error('Simulated NIC API failure'));
        } else {
          resolve();
        }
      }, 300);
    });
  }
}
