export class DistributorOnboardingWorkflow {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly distributorId: string;
  private _currentStage: 'DRAFT' | 'KYC_PENDING' | 'CREDIT_CHECK' | 'CONTRACT_SIGNATURE' | 'ACTIVE';
  private _kycStatus: string;
  private _creditCheckStatus: string;
  private _contractSigned: boolean;
  private _approvedBy: string | null;
  private _version: number;

  constructor(
    id: string,
    tenantId: string,
    distributorId: string,
    currentStage: 'DRAFT' | 'KYC_PENDING' | 'CREDIT_CHECK' | 'CONTRACT_SIGNATURE' | 'ACTIVE',
    kycStatus: string,
    creditCheckStatus: string,
    contractSigned: boolean,
    approvedBy: string | null,
    version: number
  ) {
    this.id = id;
    this.tenantId = tenantId;
    this.distributorId = distributorId;
    this._currentStage = currentStage;
    this._kycStatus = kycStatus;
    this._creditCheckStatus = creditCheckStatus;
    this._contractSigned = contractSigned;
    this._approvedBy = approvedBy;
    this._version = version;
  }

  get currentStage() { return this._currentStage; }
  get kycStatus() { return this._kycStatus; }
  get creditCheckStatus() { return this._creditCheckStatus; }
  get contractSigned() { return this._contractSigned; }
  get approvedBy() { return this._approvedBy; }
  get version() { return this._version; }

  static create(props: {
    id: string;
    tenantId: string;
    distributorId: string;
  }): DistributorOnboardingWorkflow {
    return new DistributorOnboardingWorkflow(
      props.id,
      props.tenantId,
      props.distributorId,
      'DRAFT',
      'PENDING',
      'PENDING',
      false,
      null,
      1
    );
  }

  submitForKYC(): void {
    if (this._currentStage !== 'DRAFT') {
      throw new Error('Can only submit for KYC from DRAFT stage');
    }
    this._currentStage = 'KYC_PENDING';
    this.incrementVersion();
  }

  approveKYC(): void {
    if (this._currentStage !== 'KYC_PENDING') {
      throw new Error('Not in KYC_PENDING stage');
    }
    this._kycStatus = 'APPROVED';
    this._currentStage = 'CREDIT_CHECK';
    this.incrementVersion();
  }

  approveCreditCheck(): void {
    if (this._currentStage !== 'CREDIT_CHECK') {
      throw new Error('Not in CREDIT_CHECK stage');
    }
    this._creditCheckStatus = 'APPROVED';
    this._currentStage = 'CONTRACT_SIGNATURE';
    this.incrementVersion();
  }

  signContract(): void {
    if (this._currentStage !== 'CONTRACT_SIGNATURE') {
      throw new Error('Not in CONTRACT_SIGNATURE stage');
    }
    this._contractSigned = true;
    this.incrementVersion();
  }

  activate(approvedBy: string): void {
    if (this._currentStage !== 'CONTRACT_SIGNATURE' || !this._contractSigned) {
      throw new Error('Cannot activate unless contract is signed');
    }
    this._currentStage = 'ACTIVE';
    this._approvedBy = approvedBy;
    this.incrementVersion();
  }

  private incrementVersion(): void {
    this._version += 1;
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      distributorId: this.distributorId,
      currentStage: this._currentStage,
      kycStatus: this._kycStatus,
      creditCheckStatus: this._creditCheckStatus,
      contractSigned: this._contractSigned,
      approvedBy: this._approvedBy,
      version: this._version,
    };
  }
}
