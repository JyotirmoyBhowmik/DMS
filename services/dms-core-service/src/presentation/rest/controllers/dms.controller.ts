import { DmsRepository } from '../../../infrastructure/database/dms.repository.js';
import { Distributor } from '../../../domain/entities/distributor.js';
import { ClaimAggregate } from '../../../domain/entities/claim_aggregate.js';
import { InventoryAggregate } from '../../../domain/entities/inventory_aggregate.js';
import { PricingPolicy } from '../../../domain/policies/pricing_policy.js';
import { StructuredLogger } from '@dms/pkg-logger';

export class DmsController {
  private repo = new DmsRepository();
  private logger = new StructuredLogger('DmsController');

  // In-memory store for dynamic claim aggregates
  private static claimsStore = new Map<string, ClaimAggregate>();
  // In-memory store for inventory aggregates
  private static inventoryStore = new Map<string, InventoryAggregate>();

  static clearStore() {
    this.claimsStore.clear();
    this.inventoryStore.clear();
  }

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

  // ── Claims, Returns, and Pricing Endpoints ────────────────────

  async handlePostClaim(body: {
    id: string;
    tenantId: string;
    distributorId: string;
    items: Array<{ category: string; amount: number; description?: string }>;
  }): Promise<{ status: number; body: Record<string, unknown> }> {
    this.logger.info('Creating a new claim accrual request', { distributorId: body.distributorId });
    const claim = new ClaimAggregate(body.id, body.tenantId, body.distributorId);
    for (const item of body.items) {
      claim.accrue(item.category, item.amount, item.description);
    }
    claim.submit();

    DmsController.claimsStore.set(body.id, claim);

    return {
      status: 201,
      body: {
        id: claim.id,
        state: claim.getState(),
        totalAmount: claim.getTotalAmount(),
        details: claim.getDetails(),
      }
    };
  }

  async handleValidateClaim(body: {
    claimId: string;
    systemCalculatedAmount: number;
    tolerancePct?: number;
  }): Promise<{ status: number; body: Record<string, unknown> }> {
    this.logger.info('Validating accrued distributor claim', { claimId: body.claimId });
    const claim = DmsController.claimsStore.get(body.claimId);
    if (!claim) {
      return { status: 404, body: { error: 'Claim not found' } };
    }

    try {
      claim.validate(body.systemCalculatedAmount, body.tolerancePct);
      return {
        status: 200,
        body: {
          id: claim.id,
          state: claim.getState(),
          totalAmount: claim.getTotalAmount(),
          rejectionReason: claim.getRejectionReason(),
        }
      };
    } catch (err: any) {
      return { status: 400, body: { error: err.message } };
    }
  }

  async handleSettleClaim(body: {
    claimId: string;
    paymentRef: string;
  }): Promise<{ status: number; body: Record<string, unknown> }> {
    this.logger.info('Settling validated claim', { claimId: body.claimId });
    const claim = DmsController.claimsStore.get(body.claimId);
    if (!claim) {
      return { status: 404, body: { error: 'Claim not found' } };
    }

    try {
      claim.settle(body.paymentRef);
      return {
        status: 200,
        body: {
          id: claim.id,
          state: claim.getState(),
          settlementRef: claim.getSettlementRef(),
        }
      };
    } catch (err: any) {
      return { status: 400, body: { error: err.message } };
    }
  }

  async handlePostReturn(body: {
    tenantId: string;
    distributorId: string;
    productId: string;
    quantity: number;
    batchNumber: string;
    expiryDate: string;
    reason: string;
  }): Promise<{ status: number; body: Record<string, unknown> }> {
    this.logger.info('Processing returning product shipment', { productId: body.productId, quantity: body.quantity });
    
    // Increment stock batch inside inventory aggregate
    const invKey = `${body.tenantId}-${body.productId}`;
    let inv = DmsController.inventoryStore.get(invKey);
    if (!inv) {
      inv = new InventoryAggregate(`inv-${invKey}`, body.tenantId, body.productId, 'wh-001');
      DmsController.inventoryStore.set(invKey, inv);
    }

    inv.adjustStock(body.batchNumber, body.quantity, body.expiryDate);

    // Automatically accrue a return refund claim
    const claimId = `claim-ret-${Math.floor(Math.random() * 10000)}`;
    const refundClaim = new ClaimAggregate(claimId, body.tenantId, body.distributorId);
    
    // Mock refund calculations ($10 per unit return value)
    const refundAmount = body.quantity * 1000;
    refundClaim.accrue('RETURNS_REFUND', refundAmount, `Refund for returning ${body.quantity} units due to: ${body.reason}`);
    refundClaim.submit();
    
    DmsController.claimsStore.set(claimId, refundClaim);

    return {
      status: 200,
      body: {
        success: true,
        refundClaimId: claimId,
        refundAmount,
        totalStock: inv.totalStock,
      }
    };
  }

  async handleGetPriceList(query: {
    listPrice: number;
    quantity: number;
    taxRuleKey?: string;
  }): Promise<{ status: number; body: Record<string, unknown> }> {
    this.logger.info('Evaluating price-list calculations');
    try {
      const pricing = PricingPolicy.calculate(query.listPrice, query.quantity, query.taxRuleKey);
      return {
        status: 200,
        body: pricing as any
      };
    } catch (err: any) {
      return { status: 400, body: { error: err.message } };
    }
  }
}
