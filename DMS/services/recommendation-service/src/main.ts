import { RecommendationPgRepository } from './infrastructure/database/repositories/recommendation.pg-repository.js';
import { RecommendationAuditService } from './infrastructure/audit/recommendation.audit.js';
import { CreateRecommendationUseCase } from './application/usecases/create-recommendation.usecase.js';
import { GetRecommendationUseCase } from './application/usecases/get-recommendation.usecase.js';
import { UpdateRecommendationUseCase } from './application/usecases/update-recommendation.usecase.js';
import { ListRecommendationsUseCase } from './application/usecases/list-recommendations.usecase.js';
import { RecommendationController } from './presentation/rest/controllers/recommendation.controller.js';

const repository = new RecommendationPgRepository();
const auditService = new RecommendationAuditService();

const createUseCase = new CreateRecommendationUseCase(repository, auditService);
const getUseCase = new GetRecommendationUseCase(repository);
const updateUseCase = new UpdateRecommendationUseCase(repository, auditService);
const listUseCase = new ListRecommendationsUseCase(repository);

const controller = new RecommendationController(createUseCase, getUseCase, updateUseCase, listUseCase);

async function bootstrap(): Promise<void> {
  process.stdout.write('\n=== RECOMMENDATION-SERVICE BOOTSTRAP ===\n');

  const createRes = await controller.handleCreate({
    headers: { 'content-type': 'application/json', 'x-tenant-id': '00000000-0000-0000-0000-000000000001' },
    body: {
      title: 'bootstrap_cross_sell',
      targetId: '00000000-0000-0000-0000-000000000002',
      recommendationType: 'CROSS_SELL',
      score: 0.88
    }
  });

  process.stdout.write(`\n🛒 Recommendation Created (status=${createRes.statusCode}): ${JSON.stringify(createRes.body)}\n`);

  const listRes = await controller.handleList({
    headers: { 'x-tenant-id': '00000000-0000-0000-0000-000000000001' },
    query: { page: 1, pageSize: 10 }
  });

  process.stdout.write(`\n📋 Recommendations List (status=${listRes.statusCode}, total=${listRes.body.total}): ${JSON.stringify(listRes.body.recommendations)}\n`);

  process.stdout.write('\n=== RECOMMENDATION-SERVICE BOOTSTRAP COMPLETE ===\n');
}

bootstrap();
