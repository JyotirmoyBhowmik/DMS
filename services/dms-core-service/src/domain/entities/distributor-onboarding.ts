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

  public readonly domainEvents: Array<{ type: string; payload: any }> = [];

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
    const workflow = new DistributorOnboardingWorkflow(
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
    workflow.domainEvents.push({
      type: 'distributor.onboarding.created',
      payload: { onboardingId: props.id, distributorId: props.distributorId }
    });
    return workflow;
  }

  submitForKYC(): void {
    if (this._currentStage !== 'DRAFT') {
      throw new Error('Can only submit for KYC from DRAFT stage');
    }
    this._currentStage = 'KYC_PENDING';
    this.incrementVersion();
    this.domainEvents.push({
      type: 'distributor.onboarding.stage_updated',
      payload: { onboardingId: this.id, distributorId: this.distributorId, stage: 'KYC_PENDING' }
    });
  }

  approveKYC(): void {
    if (this._currentStage !== 'KYC_PENDING') {
      throw new Error('Not in KYC_PENDING stage');
    }
    this._kycStatus = 'APPROVED';
    this._currentStage = 'CREDIT_CHECK';
    this.incrementVersion();
    this.domainEvents.push({
      type: 'distributor.onboarding.stage_updated',
      payload: { onboardingId: this.id, distributorId: this.distributorId, stage: 'CREDIT_CHECK', kycStatus: 'APPROVED' }
    });
  }

  approveCreditCheck(): void {
    if (this._currentStage !== 'CREDIT_CHECK') {
      throw new Error('Not in CREDIT_CHECK stage');
    }
    this._creditCheckStatus = 'APPROVED';
    this._currentStage = 'CONTRACT_SIGNATURE';
    this.incrementVersion();
    this.domainEvents.push({
      type: 'distributor.onboarding.stage_updated',
      payload: { onboardingId: this.id, distributorId: this.distributorId, stage: 'CONTRACT_SIGNATURE', creditCheckStatus: 'APPROVED' }
    });
  }

  signContract(): void {
    if (this._currentStage !== 'CONTRACT_SIGNATURE') {
      throw new Error('Not in CONTRACT_SIGNATURE stage');
    }
    this._contractSigned = true;
    this.incrementVersion();
    this.domainEvents.push({
      type: 'distributor.onboarding.contract_signed',
      payload: { onboardingId: this.id, distributorId: this.distributorId }
    });
  }

  activate(approvedBy: string): void {
    if (this._currentStage !== 'CONTRACT_SIGNATURE' || !this._contractSigned) {
      throw new Error('Cannot activate unless contract is signed');
    }
    this._currentStage = 'ACTIVE';
    this._approvedBy = approvedBy;
    this.incrementVersion();
    this.domainEvents.push({
      type: 'distributor.onboarding.activated',
      payload: { onboardingId: this.id, distributorId: this.distributorId, approvedBy }
    });
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
