import { DmsRepository } from '../../../infrastructure/database/dms.repository.js';
import { Distributor } from '../../../domain/entities/distributor.js';
import { StructuredLogger } from '@dms/pkg-logger';

export class DmsController {
  private repo = new DmsRepository();
  private logger = new StructuredLogger('DmsController');

  async handleGetProducts(tenantId: string): Promise<{ status: number; body: Record<string, unknown> }> {
    this.logger.info('Querying product catalogue', { tenantId });
    const products = await this.repo.findAllProducts(tenantId);
    return {
      status: 200,
      body: {
        items: products.map(p => p.toJSON()),
        count: products.length
      }
    };
  }

  async handleGetLowStockAlerts(tenantId: string): Promise<{ status: number; body: Record<string, unknown> }> {
    this.logger.info('Performing warehouse safety threshold checks', { tenantId });
    const alerts = await this.repo.findLowStockInventory(tenantId);
    return {
      status: 200,
      body: {
        alerts: alerts.map(a => ({
          sku: a.product.sku,
          name: a.product.name,
          stock: a.stock,
          minThreshold: a.minThreshold,
          category: a.product.category,
          status: 'LOW_STOCK_WARNING'
        })),
        count: alerts.length
      }
    };
  }

  async handleOnboardDistributor(body: {
    tenantId: string;
    name: string;
    region: string;
    creditLimit: number;
  }): Promise<{ status: number; body: Record<string, unknown> }> {
    this.logger.info('Registering new wholesale distributor account', { tenantId: body.tenantId, name: body.name });
    const distributor = Distributor.create({
      id: `dist-${Math.floor(Math.random() * 1000)}`,
      tenantId: body.tenantId,
      name: body.name,
      region: body.region,
      creditLimit: body.creditLimit
    });
    
    await this.repo.saveDistributor(distributor);
    
    return {
      status: 201,
      body: distributor.toJSON()
    };
  }

  async handleVerifyOutletGeofence(
    outletId: string,
    agentLat: number,
    agentLng: number
  ): Promise<{ status: number; body: Record<string, unknown> }> {
    this.logger.info('Validating agent visit check-in coordinate limits', { outletId, agentLat, agentLng });
    const outlet = await this.repo.findOutletById(outletId);
    if (!outlet) {
      return {
        status: 404,
        body: { error: 'Outlet not found', code: 'OUTLET_NOT_FOUND' }
      };
    }

    const { compliant, distanceMeters } = outlet.isWithinGeofence(agentLat, agentLng);
    
    return {
      status: 200,
      body: {
        outletName: outlet.name,
        geofenceRadiusMeters: outlet.radiusMeters,
        agentDistanceMeters: distanceMeters,
        compliant,
        timestamp: new Date().toISOString()
      }
    };
  }
}
