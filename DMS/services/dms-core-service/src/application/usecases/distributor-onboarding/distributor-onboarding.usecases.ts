import { DistributorOnboardingWorkflow } from '../../../domain/entities/distributor-onboarding.js';
import { IDistributorOnboardingRepository } from '../../../domain/repositories/distributor-onboarding.repository.js';
import { DistributorOnboardingPgRepository } from '../../../infrastructure/database/repositories/distributor-onboarding.pg-repository.js';
import { TransactionalDbClient } from '../../../infrastructure/database/transactional-client.js';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { StructuredLogger } from '@dms/pkg-logger';

export class DistributorOnboardingUseCases {
  private logger = new StructuredLogger('DistributorOnboardingUseCases');
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });

  constructor(
    private repository: IDistributorOnboardingRepository,
    private db?: PostgresDatabaseClient
  ) {}

  async createOnboarding(input: {
    id: string;
    tenantId: string;
    distributorId: string;
  }): Promise<DistributorOnboardingWorkflow> {
    this.logger.info('Creating onboarding workflow', { id: input.id, distributorId: input.distributorId });
    const workflow = DistributorOnboardingWorkflow.create(input);

    const event = makeEnvelope(
      'distributor.onboarding.created',
      'v1',
      { onboardingId: workflow.id, distributorId: workflow.distributorId },
      {
        tenantId: input.tenantId,
        correlationId: 'correlation-uuid-mock',
        producer: 'dms-core-service',
        partitionKey: workflow.id,
      }
    );

    if (this.db) {
      await this.db.transaction(async (conn) => {
        const txDb = new TransactionalDbClient(conn);
        const txRepo = new DistributorOnboardingPgRepository(txDb);
        await txRepo.save(workflow);

        await this.outboxRepo.save(conn, {
          eventId: event.eventId,
          tenantId: input.tenantId,
          type: event.type,
          version: 'v1',
          payload: event.payload,
        }, 'DistributorOnboardingWorkflow', workflow.id);
      }, input.tenantId);
    } else {
      await this.repository.save(workflow);
    }

    return workflow;
  }

  async submitForKYC(id: string, tenantId: string): Promise<DistributorOnboardingWorkflow> {
    this.logger.info('Submitting onboarding for KYC', { id });
    const workflow = await this.repository.findById(id, tenantId);
    if (!workflow) throw new Error('Workflow not found');
    workflow.submitForKYC();

    const event = makeEnvelope(
      'distributor.onboarding.stage_updated',
      'v1',
      { onboardingId: workflow.id, distributorId: workflow.distributorId, stage: 'KYC_PENDING' },
      {
        tenantId,
        correlationId: 'correlation-uuid-mock',
        producer: 'dms-core-service',
        partitionKey: workflow.id,
      }
    );

    if (this.db) {
      await this.db.transaction(async (conn) => {
        const txDb = new TransactionalDbClient(conn);
        const txRepo = new DistributorOnboardingPgRepository(txDb);
        await txRepo.save(workflow);

        await this.outboxRepo.save(conn, {
          eventId: event.eventId,
          tenantId,
          type: event.type,
          version: 'v1',
          payload: event.payload,
        }, 'DistributorOnboardingWorkflow', workflow.id);
      }, tenantId);
    } else {
      await this.repository.save(workflow);
    }

    return workflow;
  }

  async approveKYC(id: string, tenantId: string): Promise<DistributorOnboardingWorkflow> {
    this.logger.info('Approving KYC for onboarding', { id });
    const workflow = await this.repository.findById(id, tenantId);
    if (!workflow) throw new Error('Workflow not found');
    workflow.approveKYC();

    const event = makeEnvelope(
      'distributor.onboarding.stage_updated',
      'v1',
      { onboardingId: workflow.id, distributorId: workflow.distributorId, stage: 'CREDIT_CHECK', kycStatus: 'APPROVED' },
      {
        tenantId,
        correlationId: 'correlation-uuid-mock',
        producer: 'dms-core-service',
        partitionKey: workflow.id,
      }
    );

    if (this.db) {
      await this.db.transaction(async (conn) => {
        const txDb = new TransactionalDbClient(conn);
        const txRepo = new DistributorOnboardingPgRepository(txDb);
        await txRepo.save(workflow);

        await this.outboxRepo.save(conn, {
          eventId: event.eventId,
          tenantId,
          type: event.type,
          version: 'v1',
          payload: event.payload,
        }, 'DistributorOnboardingWorkflow', workflow.id);
      }, tenantId);
    } else {
      await this.repository.save(workflow);
    }

    return workflow;
  }

  async approveCreditCheck(id: string, tenantId: string): Promise<DistributorOnboardingWorkflow> {
    this.logger.info('Approving Credit Check for onboarding', { id });
    const workflow = await this.repository.findById(id, tenantId);
    if (!workflow) throw new Error('Workflow not found');
    workflow.approveCreditCheck();

    const event = makeEnvelope(
      'distributor.onboarding.stage_updated',
      'v1',
      { onboardingId: workflow.id, distributorId: workflow.distributorId, stage: 'CONTRACT_SIGNATURE', creditCheckStatus: 'APPROVED' },
      {
        tenantId,
        correlationId: 'correlation-uuid-mock',
        producer: 'dms-core-service',
        partitionKey: workflow.id,
      }
    );

    if (this.db) {
      await this.db.transaction(async (conn) => {
        const txDb = new TransactionalDbClient(conn);
        const txRepo = new DistributorOnboardingPgRepository(txDb);
        await txRepo.save(workflow);

        await this.outboxRepo.save(conn, {
          eventId: event.eventId,
          tenantId,
          type: event.type,
          version: 'v1',
          payload: event.payload,
        }, 'DistributorOnboardingWorkflow', workflow.id);
      }, tenantId);
    } else {
      await this.repository.save(workflow);
    }

    return workflow;
  }

  async signContract(id: string, tenantId: string): Promise<DistributorOnboardingWorkflow> {
    this.logger.info('Signing contract for onboarding', { id });
    const workflow = await this.repository.findById(id, tenantId);
    if (!workflow) throw new Error('Workflow not found');
    workflow.signContract();

    const event = makeEnvelope(
      'distributor.onboarding.contract_signed',
      'v1',
      { onboardingId: workflow.id, distributorId: workflow.distributorId },
      {
        tenantId,
        correlationId: 'correlation-uuid-mock',
        producer: 'dms-core-service',
        partitionKey: workflow.id,
      }
    );

    if (this.db) {
      await this.db.transaction(async (conn) => {
        const txDb = new TransactionalDbClient(conn);
        const txRepo = new DistributorOnboardingPgRepository(txDb);
        await txRepo.save(workflow);

        await this.outboxRepo.save(conn, {
          eventId: event.eventId,
          tenantId,
          type: event.type,
          version: 'v1',
          payload: event.payload,
        }, 'DistributorOnboardingWorkflow', workflow.id);
      }, tenantId);
    } else {
      await this.repository.save(workflow);
    }

    return workflow;
  }

  async activate(id: string, tenantId: string, approvedBy: string): Promise<DistributorOnboardingWorkflow> {
    this.logger.info('Activating onboarding', { id });
    const workflow = await this.repository.findById(id, tenantId);
    if (!workflow) throw new Error('Workflow not found');
    workflow.activate(approvedBy);

    const event = makeEnvelope(
      'distributor.onboarding.activated',
      'v1',
      { onboardingId: workflow.id, distributorId: workflow.distributorId, approvedBy },
      {
        tenantId,
        correlationId: 'correlation-uuid-mock',
        producer: 'dms-core-service',
        partitionKey: workflow.id,
      }
    );

    if (this.db) {
      await this.db.transaction(async (conn) => {
        const txDb = new TransactionalDbClient(conn);
        const txRepo = new DistributorOnboardingPgRepository(txDb);
        await txRepo.save(workflow);

        await this.outboxRepo.save(conn, {
          eventId: event.eventId,
          tenantId,
          type: event.type,
          version: 'v1',
          payload: event.payload,
        }, 'DistributorOnboardingWorkflow', workflow.id);
      }, tenantId);
    } else {
      await this.repository.save(workflow);
    }

    return workflow;
  }
}
