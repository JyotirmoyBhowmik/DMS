import { RecommendationController } from './presentation/rest/controllers/recommendation.controller.js';

const controller = new RecommendationController();

async function bootstrap(): Promise<void> {
  process.stdout.write('\n=== RECOMMENDATION-SERVICE BOOTSTRAP ===\n');

  // Generate cross-sell recommendations using collaborative filtering
  const crossSell = await controller.handleGenerate({
    tenantId: 'tenant-uuid-1111', targetId: 'outlet-001', type: 'cross_sell',
  });
  process.stdout.write(`\n🛒 Cross-sell (status=${crossSell.status}):\n`);
  const items = (crossSell.body as Record<string, unknown>).items as Array<Record<string, unknown>>;
  if (items) {
    for (const item of items) {
      process.stdout.write(`  ${item.priority}. ${item.skuName} (score: ${item.score}) — ${item.reason}\n`);
    }
  }

  // Generate next-best-action using rule engine
  const nba = await controller.handleGenerate({
    tenantId: 'tenant-uuid-1111', targetId: 'outlet-001', type: 'next_best_action',
  });
  process.stdout.write(`\n🎯 Next Best Action (status=${nba.status}):\n`);
  const actions = (nba.body as Record<string, unknown>).items as Array<Record<string, unknown>>;
  if (actions) {
    for (const action of actions) {
      process.stdout.write(`  ${action.priority}. ${action.skuName} (score: ${action.score}) — ${action.reason}\n`);
    }
  }

  // Record an interaction
  const recId = (crossSell.body as Record<string, unknown>).id as string;
  if (recId) {
    const interaction = await controller.handleInteraction(recId, 'accepted');
    process.stdout.write(`\n✅ Interaction recorded: ${JSON.stringify(interaction.body)}\n`);
  }

  process.stdout.write('\n=== RECOMMENDATION-SERVICE BOOTSTRAP COMPLETE ===\n');
}

bootstrap();
