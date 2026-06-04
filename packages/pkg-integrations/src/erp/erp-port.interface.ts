export interface IERPPort {
  syncMasterData(dataType: string): Promise<any[]>;
  postTransaction(transactionId: string, payload: any): Promise<boolean>;
}
