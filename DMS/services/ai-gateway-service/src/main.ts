import { InferenceController } from './presentation/rest/controllers/inference.controller.js';

const controller = new InferenceController();

async function bootstrap(): Promise<void> {
  process.stdout.write('\n=== AI-GATEWAY-SERVICE BOOTSTRAP ===\n');

  // List available models
  const modelsResult = await controller.handleListModels();
  process.stdout.write(`\n📋 Available Models: ${JSON.stringify(modelsResult.body, null, 2)}\n`);

  // Run an inference through the OpenAI mock
  const inferenceResult = await controller.handleRunInference({
    tenantId: 'tenant-uuid-1111',
    modelId: 'gpt-4',
    prompt: 'Based on the last 30 days of sales data, forecast demand for SKU-A in the Northern region.',
    systemPrompt: 'You are a demand forecasting assistant for an FMCG distribution company.',
    temperature: 0.5,
    maxOutputTokens: 1024,
    requestedBy: 'agent-uuid-2222',
  });

  process.stdout.write(`\n🤖 Inference Result (status=${inferenceResult.status}):\n${JSON.stringify(inferenceResult.body, null, 2)}\n`);

  // Retrieve the inference by ID
  const id = (inferenceResult.body as Record<string, unknown>).id as string;
  const retrieved = await controller.handleGetInference(id);
  process.stdout.write(`\n🔍 Retrieved Inference: status=${retrieved.status}\n`);

  process.stdout.write('\n=== AI-GATEWAY-SERVICE BOOTSTRAP COMPLETE ===\n');
}

bootstrap();
