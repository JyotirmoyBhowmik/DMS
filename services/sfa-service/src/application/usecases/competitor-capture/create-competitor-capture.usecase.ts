import { ICompetitorCaptureRepository } from '../../../domain/repositories/competitor-capture.repository';
import { CompetitorCapture } from '../../../domain/entities/competitor-capture';
import { Money } from '../../../domain/value-objects/money';
import { makeEnvelope } from '@dms/pkg-events';
import { getCorrelation } from '@dms/pkg-logger';
import { randomUUID } from 'node:crypto';

export interface CreateCompetitorCaptureDTO {
  tenantId: string;
  outletId: string;
  brand: string;
  skuId: string;
  observedPrice: number;
  observedPriceCurrency: string;
  promotionDetails?: string;
  photoUrl?: string;
}

export class CreateCompetitorCaptureUseCase {
  constructor(
    private readonly repo: ICompetitorCaptureRepository
  ) {}

  async execute(dto: CreateCompetitorCaptureDTO): Promise<CompetitorCapture> {
    const capture = CompetitorCapture.create({
      id: randomUUID(),
      tenantId: dto.tenantId,
      outletId: dto.outletId,
      brand: dto.brand,
      skuId: dto.skuId,
      observedPrice: Money.of(dto.observedPrice, dto.observedPriceCurrency),
      promotionDetails: dto.promotionDetails,
      photoUrl: dto.photoUrl,
    });

    await this.repo.save(capture);

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'sfa.competitor_capture.created',
      'v1',
      {
        id: capture.id,
        tenantId: capture.tenantId,
        outletId: capture.outletId,
        brand: capture.brand,
      },
      {
        tenantId: capture.tenantId,
        correlationId: activeCtx?.correlationId ?? 'correlation-uuid-mock',
        producer: 'sfa-service',
        partitionKey: capture.id,
        causationId: activeCtx?.causationId,
      }
    );

    // Event could be published to an outbox repo here

    return capture;
  }
}
