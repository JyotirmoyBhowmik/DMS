import { RequirePermissions } from '@dms/pkg-rbac';
import { loadConfigSync } from '@dms/pkg-config';
import { ResilientHttpClient } from '@dms/pkg-http';

const config = loadConfigSync();
const AI_SERVICE_URL = config.endpoints.aiServiceUrl;
const httpClient = new ResilientHttpClient();

export class AIController {

  @RequirePermissions('ai:read')
  async generateSql(query: string): Promise<any> {
    const response = await httpClient.request(`${AI_SERVICE_URL}/api/ai/sql-generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });
    return response.data;
  }

  @RequirePermissions('ai:read')
  async analyzePlanogram(fileBlob: Blob, fileName: string): Promise<any> {
    const formData = new FormData();
    formData.append('file', fileBlob, fileName);

    const response = await httpClient.request(`${AI_SERVICE_URL}/api/ai/planogram`, {
      method: 'POST',
      body: formData,
    });
    return response.data;
  }

  @RequirePermissions('ai:read')
  async getRecommendations(user_id: string): Promise<any> {
    const response = await httpClient.request(`${AI_SERVICE_URL}/api/ai/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id }),
    });
    return response.data;
  }

  @RequirePermissions('ai:read')
  async getChurnScore(user_id: string): Promise<any> {
    const response = await httpClient.request(`${AI_SERVICE_URL}/api/ai/churn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id }),
    });
    return response.data;
  }
}
