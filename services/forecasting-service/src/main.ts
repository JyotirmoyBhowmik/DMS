import { ForecastController } from './presentation/rest/controllers/forecast.controller.js';

const controller = new ForecastController();

async function bootstrap(): Promise<void> {
  process.stdout.write('\n=== FORECASTING-SERVICE BOOTSTRAP ===\n');

  // Generate a demand forecast for SKU-A at outlet-001
  const result = await controller.handleGenerateForecast({
    tenantId: 'tenant-uuid-1111', skuId: 'SKU-A', outletId: 'outlet-001',
    distributorId: 'dist-uuid-3333', forecastType: 'demand', horizon: '14d',
    granularity: 'daily', model: 'exponential_smoothing', confidenceLevel: 0.95,
  });

  process.stdout.write(`\n📈 Forecast Generated (status=${result.status}):\n`);
  const body = result.body as Record<string, unknown>;
  process.stdout.write(`  Model: ${body.modelUsed}\n`);
  process.stdout.write(`  Horizon: ${body.horizon} | Confidence: ${body.confidenceLevel}\n`);
  const points = body.dataPoints as Array<Record<string, unknown>>;
  process.stdout.write(`  Data Points: ${points.length}\n`);
  process.stdout.write(`  First: ${JSON.stringify(points[0])}\n`);
  process.stdout.write(`  Last:  ${JSON.stringify(points[points.length - 1])}\n`);

  // Evaluate accuracy with mock actuals
  const forecastId = body.id as string;
  const evaluation = await controller.handleEvaluateAccuracy(forecastId, [
    { date: points[0].date as string, actual: (points[0].predicted as number) + 5 },
    { date: points[1].date as string, actual: (points[1].predicted as number) - 3 },
    { date: points[2].date as string, actual: (points[2].predicted as number) + 8 },
  ]);

  process.stdout.write(`\n📊 Accuracy Evaluation:\n${JSON.stringify(evaluation.body, null, 2)}\n`);

  // SMA model comparison
  const smaResult = await controller.handleGenerateForecast({
    tenantId: 'tenant-uuid-1111', skuId: 'SKU-A', outletId: 'outlet-001',
    distributorId: 'dist-uuid-3333', forecastType: 'demand', horizon: '7d',
    granularity: 'daily', model: 'sma',
  });
  process.stdout.write(`\n📉 SMA Model Forecast: ${(smaResult.body as Record<string, unknown>).modelUsed} | ${((smaResult.body as Record<string, unknown>).dataPoints as unknown[]).length} points\n`);

  process.stdout.write('\n=== FORECASTING-SERVICE BOOTSTRAP COMPLETE ===\n');
}

bootstrap();
