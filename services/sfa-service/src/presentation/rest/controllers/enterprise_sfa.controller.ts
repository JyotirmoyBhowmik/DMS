import { EnterpriseSfaUseCases } from '../../../application/usecases/enterprise_sfa.usecases.js';
import { StructuredLogger } from '@dms/pkg-logger';

export class EnterpriseSfaController {
  private useCases = new EnterpriseSfaUseCases();
  private logger = new StructuredLogger('EnterpriseSfaController');

  async handleCreateBeatRoute(body: {
    id: string;
    name: string;
    region: string;
    assignedAgentIds?: string[];
    outlets?: Array<{ outletId: string; sequence: number; lat: number; lng: number }>;
    frequency?: 'daily' | 'weekly' | 'monthly';
  }, headers: Record<string, string | undefined>): Promise<{ statusCode: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    this.logger.info('Create beat route request received', { tenantId, name: body.name });
    
    try {
      const route = await this.useCases.createBeatRoute({ ...body, tenantId });
      return {
        statusCode: 201,
        body: { success: true, beatRoute: route.toJSON() }
      };
    } catch (err: any) {
      return {
        statusCode: 400,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleGetBeatRoute(id: string, headers: Record<string, string | undefined>): Promise<{ statusCode: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    this.logger.info('Get beat route request received', { tenantId, id });

    const route = await this.useCases.getBeatRoute(id, tenantId);
    if (!route) {
      return {
        statusCode: 404,
        body: { success: false, error: 'Beat route not found' }
      };
    }
    return {
      statusCode: 200,
      body: { success: true, beatRoute: route.toJSON() }
    };
  }

  async handleCheckInAttendance(body: {
    id: string;
    agentId: string;
    date: string;
    lat: number;
    lng: number;
  }, headers: Record<string, string | undefined>): Promise<{ statusCode: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    try {
      const attendance = await this.useCases.checkInAttendance({ ...body, tenantId });
      return {
        statusCode: 200,
        body: { success: true, attendance: attendance.toJSON() }
      };
    } catch (err: any) {
      return {
        statusCode: 400,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleCheckOutAttendance(body: {
    id: string;
    lat: number;
    lng: number;
  }, headers: Record<string, string | undefined>): Promise<{ statusCode: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    try {
      const attendance = await this.useCases.checkOutAttendance(body.id, tenantId, body.lat, body.lng);
      return {
        statusCode: 200,
        body: { success: true, attendance: attendance.toJSON() }
      };
    } catch (err: any) {
      return {
        statusCode: 400,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleRecordGeoCheckIn(body: {
    id: string;
    agentId: string;
    outletId: string;
    visitId: string;
    lat: number;
    lng: number;
    outletLat: number;
    outletLng: number;
    deviceInfo?: { model: string; os: string; batteryLevel: number };
  }, headers: Record<string, string | undefined>): Promise<{ statusCode: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    try {
      const checkIn = await this.useCases.recordGeoCheckIn({ ...body, tenantId });
      return {
        statusCode: 201,
        body: { success: true, checkIn: checkIn.toJSON() }
      };
    } catch (err: any) {
      return {
        statusCode: 400,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleSubmitCensus(body: {
    id: string;
    outletId: string;
    agentId: string;
    outletName: string;
    outletType: 'kirana' | 'supermarket' | 'pharmacy' | 'general';
    ownerName: string;
    ownerPhone: string;
    address: string;
    lat: number;
    lng: number;
  }, headers: Record<string, string | undefined>): Promise<{ statusCode: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    try {
      const census = await this.useCases.submitCensus({ ...body, tenantId });
      return {
        statusCode: 201,
        body: { success: true, census: census.toJSON() }
      };
    } catch (err: any) {
      return {
        statusCode: 400,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleVerifyCensus(body: {
    id: string;
    verified: boolean;
  }, headers: Record<string, string | undefined>): Promise<{ statusCode: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    try {
      const census = await this.useCases.verifyCensus(body.id, tenantId, body.verified);
      return {
        statusCode: 200,
        body: { success: true, census: census.toJSON() }
      };
    } catch (err: any) {
      return {
        statusCode: 400,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleLoadVanInventory(body: {
    id: string;
    agentId: string;
    vehicleId: string;
    routeId: string;
    loadedItems: Array<{ skuId: string; qty: number; batchNumber: string }>;
  }, headers: Record<string, string | undefined>): Promise<{ statusCode: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    try {
      const vanSale = await this.useCases.loadVanInventory({ ...body, tenantId });
      return {
        statusCode: 201,
        body: { success: true, vanSale: vanSale.toJSON() }
      };
    } catch (err: any) {
      return {
        statusCode: 400,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleRecordSpotSale(body: {
    id: string;
    outletId: string;
    saleItems: Array<{ skuId: string; qty: number; unitPrice: number }>;
    paymentCollected: number;
  }, headers: Record<string, string | undefined>): Promise<{ statusCode: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    try {
      const vanSale = await this.useCases.recordSpotSale(body.id, tenantId, body.outletId, body.saleItems, body.paymentCollected);
      return {
        statusCode: 200,
        body: { success: true, vanSale: vanSale.toJSON() }
      };
    } catch (err: any) {
      return {
        statusCode: 400,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleRequestOrderApproval(body: {
    id: string;
    orderId: string;
    requestedBy: string;
    amount: number;
    thresholdAmount: number;
  }, headers: Record<string, string | undefined>): Promise<{ statusCode: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    try {
      const approval = await this.useCases.requestOrderApproval({ ...body, tenantId });
      return {
        statusCode: 201,
        body: { success: true, approval: approval.toJSON() }
      };
    } catch (err: any) {
      return {
        statusCode: 400,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleApproveOrder(body: {
    id: string;
    approvedBy: string;
  }, headers: Record<string, string | undefined>): Promise<{ statusCode: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    try {
      const approval = await this.useCases.approveOrder(body.id, tenantId, body.approvedBy);
      return {
        statusCode: 200,
        body: { success: true, approval: approval.toJSON() }
      };
    } catch (err: any) {
      return {
        statusCode: 400,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleSubmitMerchandisingAudit(body: {
    id: string;
    agentId: string;
    outletId: string;
    visitId: string;
    photos: Array<{ photoUrl: string; category: string }>;
    complianceScore: number;
  }, headers: Record<string, string | undefined>): Promise<{ statusCode: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    try {
      const audit = await this.useCases.submitMerchandisingAudit({ ...body, tenantId });
      return {
        statusCode: 201,
        body: { success: true, audit: audit.toJSON() }
      };
    } catch (err: any) {
      return {
        statusCode: 400,
        body: { success: false, error: err.message }
      };
    }
  }
}
