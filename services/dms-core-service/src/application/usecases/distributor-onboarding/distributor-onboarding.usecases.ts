import { DistributorOnboardingWorkflow } from '../../../domain/entities/distributor-onboarding.js';
import { IDistributorOnboardingRepository } from '../../../domain/repositories/distributor-onboarding.repository.js';
import { StructuredLogger } from '@dms/pkg-logger';

export class DistributorOnboardingUseCases {
  private logger = new StructuredLogger('DistributorOnboardingUseCases');

  constructor(private repository: IDistributorOnboardingRepository) {}

  async createOnboarding(input: {
    id: string;
    tenantId: string;
    distributorId: string;
  }): Promise<DistributorOnboardingWorkflow> {
    this.logger.info('Creating onboarding workflow', { id: input.id, distributorId: input.distributorId });
    const workflow = DistributorOnboardingWorkflow.create(input);
    await this.repository.save(workflow);
    return workflow;
  }

  async submitForKYC(id: string, tenantId: string): Promise<DistributorOnboardingWorkflow> {
    this.logger.info('Submitting onboarding for KYC', { id });
    const workflow = await this.repository.findById(id, tenantId);
    if (!workflow) throw new Error('Workflow not found');
    workflow.submitForKYC();
    await this.repository.save(workflow);
    return workflow;
  }

  async approveKYC(id: string, tenantId: string): Promise<DistributorOnboardingWorkflow> {
    this.logger.info('Approving KYC for onboarding', { id });
    const workflow = await this.repository.findById(id, tenantId);
    if (!workflow) throw new Error('Workflow not found');
    workflow.approveKYC();
    await this.repository.save(workflow);
    return workflow;
  }

  async approveCreditCheck(id: string, tenantId: string): Promise<DistributorOnboardingWorkflow> {
    this.logger.info('Approving Credit Check for onboarding', { id });
    const workflow = await this.repository.findById(id, tenantId);
    if (!workflow) throw new Error('Workflow not found');
    workflow.approveCreditCheck();
    await this.repository.save(workflow);
    return workflow;
  }

  async signContract(id: string, tenantId: string): Promise<DistributorOnboardingWorkflow> {
    this.logger.info('Signing contract for onboarding', { id });
    const workflow = await this.repository.findById(id, tenantId);
    if (!workflow) throw new Error('Workflow not found');
    workflow.signContract();
    await this.repository.save(workflow);
    return workflow;
  }

  async activate(id: string, tenantId: string, approvedBy: string): Promise<DistributorOnboardingWorkflow> {
    this.logger.info('Activating onboarding', { id });
    const workflow = await this.repository.findById(id, tenantId);
    if (!workflow) throw new Error('Workflow not found');
    workflow.activate(approvedBy);
    await this.repository.save(workflow);
    return workflow;
  }
}
