import { DistributorOnboardingWorkflow } from '../entities/distributor-onboarding.js';

export interface IDistributorOnboardingRepository {
  save(workflow: DistributorOnboardingWorkflow): Promise<void>;
  findById(id: string, tenantId: string): Promise<DistributorOnboardingWorkflow | null>;
}
