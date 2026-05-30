import { ReportController } from './presentation/rest/controllers/report.controller.js';

const controller = new ReportController();

async function bootstrap(): Promise<void> {
  process.stdout.write('\n=== REPORT-SERVICE BOOTSTRAP ===\n');

  // Generate a sales summary report in CSV format
  const salesReport = await controller.handleGenerateReport({
    tenantId: 'tenant-uuid-1111', name: 'March Sales Summary',
    type: 'sales_summary', parameters: { period: 'monthly', month: 3, year: 2024 },
    format: 'csv', requestedBy: 'admin-uuid-5555',
  });
  process.stdout.write(`\n📊 Sales Report (status=${salesReport.status}):\n${JSON.stringify(salesReport.body, null, 2)}\n`);

  // Download the report
  const reportId = (salesReport.body as Record<string, unknown>).id as string;
  const download = await controller.handleDownloadReport(reportId);
  process.stdout.write(`\n📥 Download Preview:\n${(download.body as Record<string, unknown>).preview}\n`);

  // Generate a visit compliance report
  const visitReport = await controller.handleGenerateReport({
    tenantId: 'tenant-uuid-1111', name: 'Visit Compliance Weekly',
    type: 'visit_compliance', parameters: { week: 12 }, format: 'json', requestedBy: 'admin-uuid-5555',
  });
  process.stdout.write(`\n📋 Visit Report (status=${visitReport.status})\n`);

  // Dashboard widgets
  const widgets = controller.handleGetDashboardWidgets('tenant-uuid-1111');
  process.stdout.write(`\n🖥️ Dashboard Widgets: ${(widgets.body as Record<string, unknown>).count}\n`);

  process.stdout.write('\n=== REPORT-SERVICE BOOTSTRAP COMPLETE ===\n');
}

bootstrap();
