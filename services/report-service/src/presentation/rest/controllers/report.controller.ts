import { randomUUID } from 'node:crypto';

// ── Domain Entities ────────────────────────────────────────────
export type ReportType = 'sales_summary' | 'visit_compliance' | 'inventory_movement' | 'collection_aging' | 'distributor_performance' | 'custom';
export type ReportFormat = 'pdf' | 'xlsx' | 'csv' | 'json';
export type ReportStatus = 'queued' | 'generating' | 'completed' | 'failed' | 'expired';

export interface ReportProps {
  id: string; tenantId: string; name: string; type: ReportType;
  parameters: Record<string, unknown>; format: ReportFormat; status: ReportStatus;
  outputUrl: string | null; generatedAt: string | null; expiresAt: string | null;
  requestedBy: string; scheduleId: string | null; createdAt: string;
}

export class Report {
  private props: ReportProps;
  private constructor(props: ReportProps) { this.props = { ...props }; }

  static create(input: {
    tenantId: string; name: string; type: ReportType; parameters: Record<string, unknown>;
    format: ReportFormat; requestedBy: string; scheduleId?: string;
  }): Report {
    return new Report({
      ...input, id: randomUUID(), status: 'queued', outputUrl: null,
      generatedAt: null, expiresAt: null, scheduleId: input.scheduleId ?? null, createdAt: new Date().toISOString(),
    });
  }

  static reconstitute(props: ReportProps): Report { return new Report(props); }

  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get type(): ReportType { return this.props.type; }
  get format(): ReportFormat { return this.props.format; }
  get status(): ReportStatus { return this.props.status; }
  get parameters(): Record<string, unknown> { return this.props.parameters; }

  markGenerating(): void { this.props.status = 'generating'; }

  markCompleted(outputUrl: string): void {
    this.props.status = 'completed';
    this.props.outputUrl = outputUrl;
    this.props.generatedAt = new Date().toISOString();
    this.props.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  }

  markFailed(reason: string): void {
    this.props.status = 'failed';
    this.props.outputUrl = `error://${reason}`;
  }

  toJSON(): Record<string, unknown> { return { ...this.props }; }
}

export interface DashboardWidget {
  id: string; tenantId: string; widgetType: 'kpi_card' | 'chart' | 'table' | 'map' | 'funnel';
  title: string; dataSource: string; refreshInterval: number;
}

// ── Data Source / Export ────────────────────────────────────────
interface TabularRow { [column: string]: string | number | boolean | null; }

class MockDataSource {
  query(reportType: ReportType, params: Record<string, unknown>): TabularRow[] {
    switch (reportType) {
      case 'sales_summary':
        return this.generateSalesSummary(params);
      case 'visit_compliance':
        return this.generateVisitCompliance();
      case 'inventory_movement':
        return this.generateInventoryMovement();
      case 'collection_aging':
        return this.generateCollectionAging();
      case 'distributor_performance':
        return this.generateDistributorPerformance();
      default:
        return [{ message: 'Custom report', timestamp: new Date().toISOString() }];
    }
  }

  private generateSalesSummary(params: Record<string, unknown>): TabularRow[] {
    const period = (params.period as string) ?? 'monthly';
    const rows: TabularRow[] = [];
    const distributors = ['Metro Distributors', 'City FMCG', 'Rural Connect', 'Premium Wholesale'];
    for (const dist of distributors) {
      rows.push({
        distributor: dist,
        totalOrders: Math.floor(Math.random() * 500) + 100,
        totalRevenue: Math.floor(Math.random() * 5_000_000) + 500_000,
        avgOrderValue: Math.floor(Math.random() * 15_000) + 5_000,
        returnRate: Math.round(Math.random() * 5 * 100) / 100,
        growth: Math.round((Math.random() * 30 - 10) * 100) / 100,
        period,
      });
    }
    return rows;
  }

  private generateVisitCompliance(): TabularRow[] {
    return [
      { agent: 'Rajesh Kumar', planned: 25, completed: 22, compliance: 88, avgDuration: 35 },
      { agent: 'Priya Sharma', planned: 30, completed: 28, compliance: 93, avgDuration: 28 },
      { agent: 'Amit Patel', planned: 20, completed: 15, compliance: 75, avgDuration: 42 },
      { agent: 'Sneha Gupta', planned: 28, completed: 27, compliance: 96, avgDuration: 30 },
    ];
  }

  private generateInventoryMovement(): TabularRow[] {
    return [
      { sku: 'SKU-A', product: 'Rice 5kg', opening: 1000, received: 500, dispatched: 450, closing: 1050, turnover: 4.2 },
      { sku: 'SKU-B', product: 'Oil 1L', opening: 800, received: 300, dispatched: 350, closing: 750, turnover: 5.1 },
      { sku: 'SKU-C', product: 'Atta 10kg', opening: 600, received: 400, dispatched: 380, closing: 620, turnover: 3.8 },
    ];
  }

  private generateCollectionAging(): TabularRow[] {
    return [
      { outlet: 'ABC Store', total: 150000, current: 80000, overdue30: 40000, overdue60: 20000, overdue90: 10000 },
      { outlet: 'XYZ Mart', total: 200000, current: 120000, overdue30: 50000, overdue60: 20000, overdue90: 10000 },
    ];
  }

  private generateDistributorPerformance(): TabularRow[] {
    return [
      { distributor: 'Metro Distributors', score: 92, orderFillRate: 96, onTimeDelivery: 89, returnRate: 2.1, outletCoverage: 85 },
      { distributor: 'City FMCG', score: 87, orderFillRate: 91, onTimeDelivery: 84, returnRate: 3.5, outletCoverage: 78 },
    ];
  }
}

class CsvExporter {
  export(rows: TabularRow[]): string {
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(',')];
    for (const row of rows) {
      lines.push(headers.map((h) => {
        const val = row[h];
        if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return String(val ?? '');
      }).join(','));
    }
    return lines.join('\n');
  }
}

class JsonExporter {
  export(rows: TabularRow[]): string {
    return JSON.stringify({ data: rows, generatedAt: new Date().toISOString(), totalRows: rows.length }, null, 2);
  }
}

// ── Repository ────────────────────────────────────────────────
class InMemoryReportRepository {
  private store = new Map<string, ReportProps>();

  async save(report: Report): Promise<void> {
    this.store.set(report.id, report.toJSON() as unknown as ReportProps);
  }

  async findById(id: string): Promise<Report | null> {
    const data = this.store.get(id);
    return data ? Report.reconstitute(data) : null;
  }

  async findByTenant(tenantId: string, limit = 20): Promise<Report[]> {
    return Array.from(this.store.values())
      .filter((r) => r.tenantId === tenantId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)
      .map((r) => Report.reconstitute(r));
  }
}

// ── Controller ────────────────────────────────────────────────
export class ReportController {
  private readonly repo: InMemoryReportRepository;
  private readonly dataSource: MockDataSource;
  private readonly csvExporter: CsvExporter;
  private readonly jsonExporter: JsonExporter;
  private readonly generatedOutputs: Map<string, string>;

  constructor() {
    this.repo = new InMemoryReportRepository();
    this.dataSource = new MockDataSource();
    this.csvExporter = new CsvExporter();
    this.jsonExporter = new JsonExporter();
    this.generatedOutputs = new Map();
  }

  async handleGenerateReport(body: {
    tenantId: string; name: string; type: ReportType;
    parameters: Record<string, unknown>; format: ReportFormat; requestedBy: string;
  }): Promise<{ status: number; body: Record<string, unknown> }> {
    const report = Report.create(body);
    report.markGenerating();

    try {
      const rows = this.dataSource.query(body.type, body.parameters);
      let output: string;

      switch (body.format) {
        case 'csv':
          output = this.csvExporter.export(rows);
          break;
        case 'json':
          output = this.jsonExporter.export(rows);
          break;
        case 'xlsx':
          output = `[XLSX binary placeholder — ${rows.length} rows]`;
          break;
        case 'pdf':
          output = `[PDF binary placeholder — ${rows.length} rows]`;
          break;
        default:
          output = this.jsonExporter.export(rows);
      }

      const outputUrl = `https://dms-reports.s3.amazonaws.com/${report.tenantId}/${report.id}.${body.format}`;
      this.generatedOutputs.set(report.id, output);
      report.markCompleted(outputUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      report.markFailed(message);
    }

    await this.repo.save(report);
    return { status: 201, body: report.toJSON() };
  }

  async handleGetReport(id: string): Promise<{ status: number; body: Record<string, unknown> }> {
    const report = await this.repo.findById(id);
    if (!report) return { status: 404, body: { error: 'Report not found' } };
    return { status: 200, body: report.toJSON() };
  }

  async handleDownloadReport(id: string): Promise<{ status: number; body: Record<string, unknown> }> {
    const report = await this.repo.findById(id);
    if (!report) return { status: 404, body: { error: 'Report not found' } };
    if (report.status !== 'completed') return { status: 400, body: { error: `Report not ready (status=${report.status})` } };

    const content = this.generatedOutputs.get(id) ?? '';
    return { status: 200, body: { reportId: id, format: report.format, contentLength: content.length, preview: content.slice(0, 500) } };
  }

  async handleListReports(tenantId: string): Promise<{ status: number; body: Record<string, unknown> }> {
    const reports = await this.repo.findByTenant(tenantId);
    return { status: 200, body: { items: reports.map((r) => r.toJSON()), count: reports.length } };
  }

  handleGetDashboardWidgets(tenantId: string): { status: number; body: Record<string, unknown> } {
    const widgets: DashboardWidget[] = [
      { id: 'w1', tenantId, widgetType: 'kpi_card', title: 'Total Revenue', dataSource: 'sales_summary', refreshInterval: 300 },
      { id: 'w2', tenantId, widgetType: 'chart', title: 'Sales Trend', dataSource: 'sales_summary', refreshInterval: 600 },
      { id: 'w3', tenantId, widgetType: 'table', title: 'Top Distributors', dataSource: 'distributor_performance', refreshInterval: 900 },
      { id: 'w4', tenantId, widgetType: 'funnel', title: 'Order Pipeline', dataSource: 'sales_summary', refreshInterval: 300 },
      { id: 'w5', tenantId, widgetType: 'map', title: 'Outlet Coverage', dataSource: 'visit_compliance', refreshInterval: 1800 },
    ];
    return { status: 200, body: { widgets, count: widgets.length } };
  }
}
