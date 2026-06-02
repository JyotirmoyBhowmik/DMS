import { DmsController } from './presentation/rest/controllers/dms.controller.js';

const controller = new DmsController();
const tenantId = 'tenant-uuid-1111';

async function bootstrap(): Promise<void> {
  process.stdout.write('\n=== DMS-CORE-SERVICE BOOTSTRAP ===\n');

  // 1. Fetch Product Catalog
  const catalog = await controller.handleGetProducts(tenantId);
  process.stdout.write(`\n📦 Product Catalog (status=${catalog.status}): ${(catalog.body as any).count} registered\n`);
  const products = (catalog.body as any).items;
  if (products) {
    for (const p of products) {
      process.stdout.write(`  - SKU: ${p.sku} | Name: ${p.name} | Price: $${p.price}\n`);
    }
  }

  // 2. Perform safety stock alert sweep
  const alerts = await controller.handleGetLowStockAlerts(tenantId);
  process.stdout.write(`\n⚠️ Stock Safety Alerts (status=${alerts.status}): ${(alerts.body as any).count} active alerts\n`);
  const activeAlerts = (alerts.body as any).alerts;
  if (activeAlerts) {
    for (const a of activeAlerts) {
      process.stdout.write(`  [ALERT] SKU: ${a.sku} | Stock: ${a.stock} units | Threshold: ${a.minThreshold} units\n`);
    }
  }

  // 3. Onboard a new Distributor
  const onboard = await controller.handleOnboardDistributor({
    tenantId,
    name: 'Apex Wholesale & Retail Group',
    region: 'Eastern Region',
    creditLimit: 75000
  });
  process.stdout.write(`\n🏢 Onboarded Distributor (status=${onboard.status}):\n${JSON.stringify(onboard.body, null, 2)}\n`);

  // 4. Verify geofence visit check-in for sales agents
  // Delhi coordinates: 28.6139, 77.2090
  const outletId = 'o-001'; // Delhi Outlet
  const agentLatValid = 28.6140; // ~11 meters away (Compliant)
  const agentLatInvalid = 28.6190; // ~560 meters away (Non-compliant)

  const verifyValid = await controller.handleVerifyOutletGeofence(outletId, agentLatValid, 77.2090);
  process.stdout.write(`\n📍 Agent Check-in 1: Compliant Coordinates (status=${verifyValid.status}):\n`);
  process.stdout.write(`  Outlet: ${(verifyValid.body as any).outletName} | Compliant: ${(verifyValid.body as any).compliant} | Distance: ${(verifyValid.body as any).agentDistanceMeters}m\n`);

  const verifyInvalid = await controller.handleVerifyOutletGeofence(outletId, agentLatInvalid, 77.2090);
  process.stdout.write(`\n📍 Agent Check-in 2: Distant Coordinates (status=${verifyInvalid.status}):\n`);
  process.stdout.write(`  Outlet: ${(verifyInvalid.body as any).outletName} | Compliant: ${(verifyInvalid.body as any).compliant} | Distance: ${(verifyInvalid.body as any).agentDistanceMeters}m\n`);

  process.stdout.write('\n=== DMS-CORE-SERVICE BOOTSTRAP COMPLETE ===\n');
}

bootstrap();
