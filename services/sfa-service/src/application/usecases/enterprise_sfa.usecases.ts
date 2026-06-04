import { BeatRoute } from '../../domain/entities/beat-route.js';
import { Attendance } from '../../domain/entities/attendance.js';
import { GeoCheckIn } from '../../domain/entities/geo-checkin.js';
import { OutletCensus } from '../../domain/entities/outlet-census.js';
import { VanSale } from '../../domain/entities/van-sale.js';
import { OrderApproval } from '../../domain/entities/order-approval.js';
import { MerchandisingAudit } from '../../domain/entities/merchandising-audit.js';
import { GeoPoint } from '../../domain/value-objects/geo-point.js';
import { Money } from '../../domain/value-objects/money.js';
import { StructuredLogger } from '@dms/pkg-logger';

export class EnterpriseSfaUseCases {
  private logger = new StructuredLogger('EnterpriseSfaUseCases');

  // Simple in-memory stores for fallback if PG is not configured
  private static beatRoutes = new Map<string, BeatRoute>();
  private static attendances = new Map<string, Attendance>();
  private static checkIns = new Map<string, GeoCheckIn>();
  private static censuses = new Map<string, OutletCensus>();
  private static vanSales = new Map<string, VanSale>();
  private static approvals = new Map<string, OrderApproval>();
  private static audits = new Map<string, MerchandisingAudit>();

  static clearStores() {
    this.beatRoutes.clear();
    this.attendances.clear();
    this.checkIns.clear();
    this.censuses.clear();
    this.vanSales.clear();
    this.approvals.clear();
    this.audits.clear();
  }

  // ── BeatRoute Use Cases ─────────────────────────────────────────
  async createBeatRoute(input: {
    id: string;
    tenantId: string;
    name: string;
    region: string;
    assignedAgentIds?: string[];
    outlets?: Array<{ outletId: string; sequence: number; lat: number; lng: number }>;
    frequency?: 'daily' | 'weekly' | 'monthly';
  }): Promise<BeatRoute> {
    this.logger.info('Creating beat route', { name: input.name, region: input.region });
    const beatRoute = BeatRoute.create({
      id: input.id,
      tenantId: input.tenantId,
      name: input.name,
      region: input.region,
      assignedAgentIds: input.assignedAgentIds,
      outlets: input.outlets,
      frequency: input.frequency,
    });
    EnterpriseSfaUseCases.beatRoutes.set(beatRoute.id, beatRoute);
    return beatRoute;
  }

  async getBeatRoute(id: string, tenantId: string): Promise<BeatRoute | null> {
    const route = EnterpriseSfaUseCases.beatRoutes.get(id);
    if (route && route.tenantId === tenantId) {
      return route;
    }
    return null;
  }

  // ── Attendance Use Cases ────────────────────────────────────────
  async checkInAttendance(input: {
    id: string;
    tenantId: string;
    agentId: string;
    date: string;
    lat: number;
    lng: number;
  }): Promise<Attendance> {
    this.logger.info('Agent checking in for attendance', { agentId: input.agentId, date: input.date });
    let attendance = EnterpriseSfaUseCases.attendances.get(input.id);
    if (!attendance) {
      attendance = Attendance.create({
        id: input.id,
        tenantId: input.tenantId,
        agentId: input.agentId,
        date: input.date,
      });
    }
    attendance.checkIn(GeoPoint.create(input.lat, input.lng));
    EnterpriseSfaUseCases.attendances.set(attendance.id, attendance);
    return attendance;
  }

  async checkOutAttendance(id: string, tenantId: string, lat: number, lng: number): Promise<Attendance> {
    this.logger.info('Agent checking out for attendance', { id, tenantId });
    const attendance = EnterpriseSfaUseCases.attendances.get(id);
    if (!attendance || attendance.tenantId !== tenantId) {
      throw new Error('Attendance record not found');
    }
    attendance.checkOut(GeoPoint.create(lat, lng));
    attendance.approve(); // Auto approve on check-out for simple workflow
    return attendance;
  }

  // ── GeoCheckIn Use Cases ────────────────────────────────────────
  async recordGeoCheckIn(input: {
    id: string;
    tenantId: string;
    agentId: string;
    outletId: string;
    visitId: string;
    lat: number;
    lng: number;
    outletLat: number;
    outletLng: number;
    deviceInfo?: { model: string; os: string; batteryLevel: number };
  }): Promise<GeoCheckIn> {
    this.logger.info('Recording geofenced check-in', { agentId: input.agentId, outletId: input.outletId });
    const checkIn = GeoCheckIn.create({
      id: input.id,
      tenantId: input.tenantId,
      agentId: input.agentId,
      outletId: input.outletId,
      visitId: input.visitId,
      checkInCoords: GeoPoint.create(input.lat, input.lng),
      outletCoords: GeoPoint.create(input.outletLat, input.outletLng),
      deviceInfo: input.deviceInfo ?? { model: 'Unknown', os: 'Unknown', batteryLevel: 100 },
    });
    EnterpriseSfaUseCases.checkIns.set(checkIn.id, checkIn);
    return checkIn;
  }

  // ── OutletCensus Use Cases ──────────────────────────────────────
  async submitCensus(input: {
    id: string;
    tenantId: string;
    outletId: string;
    agentId: string;
    outletName: string;
    outletType: 'kirana' | 'supermarket' | 'pharmacy' | 'general';
    ownerName: string;
    ownerPhone: string;
    address: string;
    lat: number;
    lng: number;
  }): Promise<OutletCensus> {
    this.logger.info('Submitting outlet census data', { name: input.outletName, owner: input.ownerName });
    const census = OutletCensus.create({
      id: input.id,
      tenantId: input.tenantId,
      outletId: input.outletId,
      agentId: input.agentId,
      censusDate: new Date().toISOString().split('T')[0]!,
      outletName: input.outletName,
      outletType: input.outletType,
      ownerName: input.ownerName,
      ownerPhone: input.ownerPhone,
      address: input.address,
      geoCoords: GeoPoint.create(input.lat, input.lng),
      tradeCategory: 'General Retail',
    });
    census.submit();
    EnterpriseSfaUseCases.censuses.set(census.id, census);
    return census;
  }

  async verifyCensus(id: string, tenantId: string, verified: boolean): Promise<OutletCensus> {
    const census = EnterpriseSfaUseCases.censuses.get(id);
    if (!census || census.tenantId !== tenantId) {
      throw new Error('Census document not found');
    }
    if (verified) {
      census.verify();
      census.approve();
    } else {
      census.reject();
    }
    return census;
  }

  // ── VanSale Use Cases ───────────────────────────────────────────
  async loadVanInventory(input: {
    id: string;
    tenantId: string;
    agentId: string;
    vehicleId: string;
    routeId: string;
    loadedItems: Array<{ skuId: string; qty: number; batchNumber: string }>;
  }): Promise<VanSale> {
    this.logger.info('Loading van sales stock', { vehicleId: input.vehicleId, agentId: input.agentId });
    const vanSale = VanSale.create({
      id: input.id,
      tenantId: input.tenantId,
      agentId: input.agentId,
      vehicleId: input.vehicleId,
      routeId: input.routeId,
      date: new Date().toISOString().split('T')[0]!,
      loadedItems: input.loadedItems,
    });
    EnterpriseSfaUseCases.vanSales.set(vanSale.id, vanSale);
    return vanSale;
  }

  async recordSpotSale(
    id: string,
    tenantId: string,
    outletId: string,
    saleItems: Array<{ skuId: string; qty: number; unitPrice: number }>,
    paymentCollected: number,
  ): Promise<VanSale> {
    this.logger.info('Recording spot van sale transaction', { outletId });
    const vanSale = EnterpriseSfaUseCases.vanSales.get(id);
    if (!vanSale || vanSale.tenantId !== tenantId) {
      throw new Error('Van sale session not found');
    }
    vanSale.startTransit();
    vanSale.startSelling();
    for (const item of saleItems) {
      vanSale.recordSale({
        skuId: item.skuId,
        qty: item.qty,
        unitPrice: item.unitPrice,
        outletId,
      });
    }
    vanSale.startReconciliation();
    vanSale.collectCash(Money.of(paymentCollected, 'INR'));
    vanSale.close();
    return vanSale;
  }

  // ── OrderApproval Use Cases ─────────────────────────────────────
  async requestOrderApproval(input: {
    id: string;
    tenantId: string;
    orderId: string;
    requestedBy: string;
    amount: number;
    thresholdAmount: number;
  }): Promise<OrderApproval> {
    this.logger.info('Submitting order for approval threshold verification', { orderId: input.orderId });
    const approval = OrderApproval.create({
      id: input.id,
      tenantId: input.tenantId,
      orderId: input.orderId,
      requestedBy: input.requestedBy,
      thresholdAmount: Money.of(input.thresholdAmount, 'INR'),
      orderAmount: Money.of(input.amount, 'INR'),
    });
    EnterpriseSfaUseCases.approvals.set(approval.id, approval);
    return approval;
  }

  async approveOrder(id: string, tenantId: string, approvedBy: string): Promise<OrderApproval> {
    const approval = EnterpriseSfaUseCases.approvals.get(id);
    if (!approval || approval.tenantId !== tenantId) {
      throw new Error('Approval request not found');
    }
    approval.approve(approvedBy, 'Approved by regional manager');
    return approval;
  }

  // ── MerchandisingAudit Use Cases ────────────────────────────────
  async submitMerchandisingAudit(input: {
    id: string;
    tenantId: string;
    agentId: string;
    outletId: string;
    visitId: string;
    photos: Array<{ photoUrl: string; category: string }>;
    complianceScore: number;
  }): Promise<MerchandisingAudit> {
    this.logger.info('Submitting planogram merchandising audit report', { outletId: input.outletId });
    const audit = MerchandisingAudit.create({
      id: input.id,
      tenantId: input.tenantId,
      agentId: input.agentId,
      outletId: input.outletId,
      visitId: input.visitId,
      auditDate: new Date().toISOString().split('T')[0]!,
      shelfPhotos: input.photos.map(p => ({ ...p, timestamp: new Date() })),
      planogramCompliance: input.complianceScore,
    });
    EnterpriseSfaUseCases.audits.set(audit.id, audit);
    return audit;
  }
}
export * from './delivery-confirmation/create-delivery-confirmation.usecase'; 
export * from './competitor-capture/create-competitor-capture.usecase'; 

export * from './sales-target/sales-target.usecases.js';
export * from './survey/survey.usecases.js';
