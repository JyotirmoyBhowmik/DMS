import { makeEnvelope, CorrelationContext } from '@dms/pkg-events';
import { StructuredLogger } from '@dms/pkg-logger';

export interface AssignRoleResult {
  userId: string;
  role: string;
  event: any;
}

export class AssignRoleUseCase {
  private logger = new StructuredLogger('AssignRoleUseCase');

  async execute(
    tenantId: string,
    userId: string,
    role: string,
    ctx: { correlationId: string; causationId?: string }
  ): Promise<AssignRoleResult> {
    this.logger.info('Assigning role to user', { tenantId, userId, role });

    // Mock role assignment persistence logic
    const payload = {
      userId,
      role,
      assignedAt: new Date().toISOString(),
    };

    const eventCtx: CorrelationContext = {
      tenantId,
      correlationId: ctx.correlationId,
      causationId: ctx.causationId,
      producer: 'identity-service',
      partitionKey: userId,
    };

    const event = makeEnvelope(
      'role.assigned',
      'v1',
      payload,
      eventCtx
    );

    this.logger.info('Role assigned and role.assigned.v1 event raised', {
      userId,
      role,
      eventId: event.eventId,
    });

    return {
      userId,
      role,
      event,
    };
  }
}
