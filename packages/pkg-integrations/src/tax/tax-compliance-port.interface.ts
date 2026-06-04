export interface ITaxCompliancePort {
  generateEInvoice(invoiceId: string, payload: any): Promise<any>;
  cancelEInvoice(invoiceId: string, reason: string): Promise<boolean>;
}
