import { SalesTargetRepository } from '../../../domain/repositories/sales-target.repository.js';
import { SalesTarget } from '../../../domain/entities/sales-target.js';
import { Money } from '../../../domain/value-objects/money.js';

export class CreateSalesTargetUseCase {
  constructor(private readonly repo: SalesTargetRepository) {}

  async execute(input: {
    id: string;
    tenantId: string;
    agentId: string;
    periodMonth: number;
    periodYear: number;
    targetAmount: number;
    currency?: string;
    targetType: string;
  }): Promise<SalesTarget> {
    const target = SalesTarget.create({
      id: input.id,
      tenantId: input.tenantId,
      agentId: input.agentId,
      periodMonth: input.periodMonth,
      periodYear: input.periodYear,
      targetAmount: Money.of(input.targetAmount, input.currency || 'INR'),
      targetType: input.targetType,
    });
    return this.repo.save(target, input.tenantId);
  }
}

export class UpdateSalesTargetProgressUseCase {
  constructor(private readonly repo: SalesTargetRepository) {}

  async execute(input: {
    id: string;
    tenantId: string;
    amount: number;
    currency?: string;
  }): Promise<SalesTarget> {
    const target = await this.repo.findById(input.id, input.tenantId);
    target.addAchievement(Money.of(input.amount, input.currency || 'INR'));
    return this.repo.update(target, input.tenantId);
  }
}

export class GetAgentSalesTargetsUseCase {
  constructor(private readonly repo: SalesTargetRepository) {}

  async execute(
    agentId: string,
    periodMonth: number,
    periodYear: number,
    tenantId: string
  ): Promise<SalesTarget[]> {
    return this.repo.findByAgentAndPeriod(agentId, periodMonth, periodYear, tenantId);
  }
}
