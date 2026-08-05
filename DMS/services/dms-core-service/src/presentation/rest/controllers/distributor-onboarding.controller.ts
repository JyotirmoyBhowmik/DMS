import { DistributorOnboardingUseCases } from '../../../application/usecases/distributor-onboarding/distributor-onboarding.usecases.js';

export class DistributorOnboardingController {
  constructor(private useCases: DistributorOnboardingUseCases) {}

  async handleCreateOnboarding(body: {
    id: string;
    distributorId: string;
  }, headers: Record<string, string | undefined>): Promise<{ status: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    try {
      const workflow = await this.useCases.createOnboarding({ ...body, tenantId });
      return {
        status: 201,
        body: { success: true, workflow: workflow.toJSON() }
      };
    } catch (err: any) {
      return {
        status: 400,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleSubmitForKYC(body: { id: string }, headers: Record<string, string | undefined>): Promise<{ status: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    try {
      const workflow = await this.useCases.submitForKYC(body.id, tenantId);
      return {
        status: 200,
        body: { success: true, workflow: workflow.toJSON() }
      };
    } catch (err: any) {
      return {
        status: 400,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleApproveKYC(body: { id: string }, headers: Record<string, string | undefined>): Promise<{ status: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    try {
      const workflow = await this.useCases.approveKYC(body.id, tenantId);
      return {
        status: 200,
        body: { success: true, workflow: workflow.toJSON() }
      };
    } catch (err: any) {
      return {
        status: 400,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleApproveCreditCheck(body: { id: string }, headers: Record<string, string | undefined>): Promise<{ status: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    try {
      const workflow = await this.useCases.approveCreditCheck(body.id, tenantId);
      return {
        status: 200,
        body: { success: true, workflow: workflow.toJSON() }
      };
    } catch (err: any) {
      return {
        status: 400,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleSignContract(body: { id: string }, headers: Record<string, string | undefined>): Promise<{ status: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    try {
      const workflow = await this.useCases.signContract(body.id, tenantId);
      return {
        status: 200,
        body: { success: true, workflow: workflow.toJSON() }
      };
    } catch (err: any) {
      return {
        status: 400,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleActivate(body: { id: string, approvedBy: string }, headers: Record<string, string | undefined>): Promise<{ status: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    try {
      const workflow = await this.useCases.activate(body.id, tenantId, body.approvedBy);
      return {
        status: 200,
        body: { success: true, workflow: workflow.toJSON() }
      };
    } catch (err: any) {
      return {
        status: 400,
        body: { success: false, error: err.message }
      };
    }
  }
}
