import { IDistributorOnboardingRepository } from '../../../domain/repositories/distributor-onboarding.repository.js';
import { DistributorOnboardingWorkflow } from '../../../domain/entities/distributor-onboarding.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class DistributorOnboardingPgRepository implements IDistributorOnboardingRepository {
  constructor(private db: PostgresDatabaseClient) {}

  async save(workflow: DistributorOnboardingWorkflow): Promise<void> {
    const data = workflow.toJSON();
    const query = `
      INSERT INTO distributor_onboarding_workflows (
        id, tenant_id, distributor_id, current_stage, kyc_status, credit_check_status, contract_signed, approved_by, version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        current_stage = EXCLUDED.current_stage,
        kyc_status = EXCLUDED.kyc_status,
        credit_check_status = EXCLUDED.credit_check_status,
        contract_signed = EXCLUDED.contract_signed,
        approved_by = EXCLUDED.approved_by,
        version = EXCLUDED.version,
        updated_at = CURRENT_TIMESTAMP
    `;
    await this.db.query(query, [
      data.id,
      data.tenantId,
      data.distributorId,
      data.currentStage,
      data.kycStatus,
      data.creditCheckStatus,
      data.contractSigned,
      data.approvedBy,
      data.version
    ], data.tenantId);
  }

  async findById(id: string, tenantId: string): Promise<DistributorOnboardingWorkflow | null> {
    const query = `
      SELECT id, tenant_id, distributor_id, current_stage, kyc_status, credit_check_status, contract_signed, approved_by, version
      FROM distributor_onboarding_workflows
      WHERE id = $1 AND tenant_id = $2
    `;
    const result = await this.db.query<any>(query, [id, tenantId], tenantId);
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return new DistributorOnboardingWorkflow(
      row.id,
      row.tenant_id,
      row.distributor_id,
      row.current_stage,
      row.kyc_status,
      row.credit_check_status,
      row.contract_signed,
      row.approved_by,
      row.version
    );
  }
}
