import { randomUUID } from 'node:crypto';

// ── Domain Entities ────────────────────────────────────────────
export type ForecastType = 'demand' | 'sales' | 'inventory_depletion' | 'revenue';
export type Granularity = 'daily' | 'weekly' | 'monthly';
export type ForecastStatus = 'generating' | 'ready' | 'expired' | 'invalidated';

export interface ForecastDataPoint {
  date: string;
  predicted: number;
  lowerBound: number;
  upperBound: number;
  actual: number | null;
}

export interface AccuracyMetrics {
  mape: number; // Mean Absolute Percentage Error
  rmse: number; // Root Mean Square Error
  mae: number;  // Mean Absolute Error
}

export interface ForecastProps {
  id: string; tenantId: string; skuId: string; outletId: string; distributorId: string;
  forecastType: ForecastType; horizon: string; granularity: Granularity;
  dataPoints: ForecastDataPoint[]; confidenceLevel: number; modelUsed: string;
  accuracy: AccuracyMetrics | null; generatedAt: string; expiresAt: string; status: ForecastStatus;
}

export class Forecast {
  private props: ForecastProps;
  private constructor(props: ForecastProps) { this.props = { ...props }; }

  static create(input: Omit<ForecastProps, 'id' | 'status' | 'generatedAt' | 'expiresAt' | 'accuracy'>): Forecast {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return new Forecast({ ...input, id: randomUUID(), status: 'ready', accuracy: null, generatedAt: now.toISOString(), expiresAt: expiresAt.toISOString() });
  }

  static reconstitute(props: ForecastProps): Forecast { return new Forecast(props); }

  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get skuId(): string { return this.props.skuId; }
  get outletId(): string { return this.props.outletId; }
  get status(): ForecastStatus { return this.props.status; }
  get dataPoints(): ForecastDataPoint[] { return this.props.dataPoints; }
  get accuracy(): AccuracyMetrics | null { return this.props.accuracy; }

  setAccuracy(metrics: AccuracyMetrics): void { this.props.accuracy = metrics; }
  invalidate(): void { this.props.status = 'invalidated'; }
  expire(): void { this.props.status = 'expired'; }

  toJSON(): Record<string, unknown> { return { ...this.props }; }
}

// ── Historical Data ────────────────────────────────────────────
export interface HistoricalSalesData {
  skuId: string; outletId: string; date: string; quantity: number; revenue: number; returns: number; promotionActive: boolean;
}

// ── ML Models ────────────────────────────────────────────────
class SimpleMovingAverageModel {
  predict(history: HistoricalSalesData[], horizonDays: number, confidenceLevel: number): ForecastDataPoint[] {
    const windowSize = Math.min(history.length, 7);
    const recentValues = history.slice(-windowSize).map((h) => h.quantity);
    const avg = recentValues.reduce((sum, v) => sum + v, 0) / recentValues.length;
    const stdDev = Math.sqrt(recentValues.reduce((sum, v) => sum + (v - avg) ** 2, 0) / recentValues.length);
    const z = confidenceLevel >= 0.95 ? 1.96 : confidenceLevel >= 0.90 ? 1.645 : 1.28;

    const points: ForecastDataPoint[] = [];
    const lastDate = new Date(history[history.length - 1].date);

    for (let i = 1; i <= horizonDays; i++) {
      const date = new Date(lastDate.getTime() + i * 86_400_000);
      const dayOfWeek = date.getDay();
      const seasonalFactor = dayOfWeek === 0 || dayOfWeek === 6 ? 0.7 : 1.0 + (dayOfWeek === 5 ? 0.15 : 0);
      const predicted = Math.round(avg * seasonalFactor);
      const margin = Math.round(stdDev * z * seasonalFactor);

      points.push({
        date: date.toISOString().slice(0, 10),
        predicted: Math.max(0, predicted),
        lowerBound: Math.max(0, predicted - margin),
        upperBound: predicted + margin,
        actual: null,
      });
    }

    return points;
  }
}

class ExponentialSmoothingModel {
  predict(history: HistoricalSalesData[], horizonDays: number, confidenceLevel: number): ForecastDataPoint[] {
    const alpha = 0.3; // smoothing factor
    const beta = 0.1;  // trend factor
    const values = history.map((h) => h.quantity);

    let level = values[0];
    let trend = values.length > 1 ? values[1] - values[0] : 0;

    for (let i = 1; i < values.length; i++) {
      const prevLevel = level;
      level = alpha * values[i] + (1 - alpha) * (level + trend);
      trend = beta * (level - prevLevel) + (1 - beta) * trend;
    }

    const residuals = values.map((v, i) => {
      let l = values[0], t = values.length > 1 ? values[1] - values[0] : 0;
      for (let j = 1; j <= i; j++) {
        const pl = l;
        l = alpha * values[j] + (1 - alpha) * (l + t);
        t = beta * (l - pl) + (1 - beta) * t;
      }
      return v - (l + t);
    });
    const rmse = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / residuals.length);
    const z = confidenceLevel >= 0.95 ? 1.96 : 1.645;

    const points: ForecastDataPoint[] = [];
    const lastDate = new Date(history[history.length - 1].date);

    for (let i = 1; i <= horizonDays; i++) {
      const date = new Date(lastDate.getTime() + i * 86_400_000);
      const predicted = Math.round(level + trend * i);
      const margin = Math.round(rmse * z * Math.sqrt(i));

      points.push({
        date: date.toISOString().slice(0, 10),
        predicted: Math.max(0, predicted),
        lowerBound: Math.max(0, predicted - margin),
        upperBound: predicted + margin,
        actual: null,
      });
    }

    return points;
  }
}

// ── Accuracy Computation ────────────────────────────────────────
function computeAccuracy(points: ForecastDataPoint[]): AccuracyMetrics {
  const withActuals = points.filter((p) => p.actual !== null);
  if (withActuals.length === 0) return { mape: 0, rmse: 0, mae: 0 };

  let sumAPE = 0, sumSE = 0, sumAE = 0;
  for (const p of withActuals) {
    const actual = p.actual!;
    const error = Math.abs(p.predicted - actual);
    sumAE += error;
    sumSE += error * error;
    sumAPE += actual !== 0 ? error / Math.abs(actual) : 0;
  }

  const n = withActuals.length;
  return {
    mape: Math.round((sumAPE / n) * 10000) / 100,
    rmse: Math.round(Math.sqrt(sumSE / n) * 100) / 100,
    mae: Math.round((sumAE / n) * 100) / 100,
  };
}

// ── Repository ────────────────────────────────────────────────
class InMemoryForecastRepository {
  private store = new Map<string, ForecastProps>();

  async save(forecast: Forecast): Promise<void> {
    this.store.set(forecast.id, forecast.toJSON() as unknown as ForecastProps);
  }

  async findById(id: string): Promise<Forecast | null> {
    const data = this.store.get(id);
    return data ? Forecast.reconstitute(data) : null;
  }

  async findBySkuAndOutlet(skuId: string, outletId: string): Promise<Forecast[]> {
    return Array.from(this.store.values())
      .filter((f) => f.skuId === skuId && f.outletId === outletId && f.status === 'ready')
      .map((f) => Forecast.reconstitute(f));
  }
}

class InMemoryHistoricalDataRepository {
  private data: HistoricalSalesData[] = [];

  constructor() { this.seed(); }

  private seed(): void {
    const baseDate = new Date('2024-01-01');
    for (let day = 0; day < 90; day++) {
      const date = new Date(baseDate.getTime() + day * 86_400_000);
      const dayOfWeek = date.getDay();
      const baseDemand = 100 + Math.floor(day * 0.5);
      const seasonalFactor = dayOfWeek === 0 || dayOfWeek === 6 ? 0.6 : 1.0 + (dayOfWeek === 5 ? 0.2 : 0);
      const noise = Math.floor(Math.random() * 20) - 10;
      const qty = Math.max(10, Math.round(baseDemand * seasonalFactor + noise));

      this.data.push({
        skuId: 'SKU-A', outletId: 'outlet-001', date: date.toISOString().slice(0, 10),
        quantity: qty, revenue: qty * 150, returns: Math.floor(qty * 0.02), promotionActive: day % 14 < 3,
      });
    }
  }

  async findBySku(skuId: string, outletId: string): Promise<HistoricalSalesData[]> {
    return this.data.filter((d) => d.skuId === skuId && d.outletId === outletId);
  }
}

// ── Errors ────────────────────────────────────────────────────
export class InsufficientDataError extends Error {
  constructor(skuId: string) { super(`Insufficient historical data for SKU '${skuId}'`); this.name = 'InsufficientDataError'; }
}

// ── Controller ────────────────────────────────────────────────
export class ForecastController {
  private readonly forecastRepo: InMemoryForecastRepository;
  private readonly historyRepo: InMemoryHistoricalDataRepository;
  private readonly smaModel: SimpleMovingAverageModel;
  private readonly esModel: ExponentialSmoothingModel;

  constructor() {
    this.forecastRepo = new InMemoryForecastRepository();
    this.historyRepo = new InMemoryHistoricalDataRepository();
    this.smaModel = new SimpleMovingAverageModel();
    this.esModel = new ExponentialSmoothingModel();
  }

  async handleGenerateForecast(body: {
    tenantId: string; skuId: string; outletId: string; distributorId: string;
    forecastType: ForecastType; horizon: string; granularity: Granularity;
    model?: 'sma' | 'exponential_smoothing'; confidenceLevel?: number;
  }): Promise<{ status: number; body: Record<string, unknown> }> {
    const history = await this.historyRepo.findBySku(body.skuId, body.outletId);
    if (history.length < 7) {
      return { status: 400, body: { error: `Insufficient data for '${body.skuId}': need 7+ days, have ${history.length}`, code: 'INSUFFICIENT_DATA' } };
    }

    const horizonDays = this.parseHorizon(body.horizon);
    const confidence = body.confidenceLevel ?? 0.95;
    const modelName = body.model ?? 'exponential_smoothing';

    const dataPoints = modelName === 'sma'
      ? this.smaModel.predict(history, horizonDays, confidence)
      : this.esModel.predict(history, horizonDays, confidence);

    const forecast = Forecast.create({
      tenantId: body.tenantId, skuId: body.skuId, outletId: body.outletId,
      distributorId: body.distributorId, forecastType: body.forecastType,
      horizon: body.horizon, granularity: body.granularity, dataPoints,
      confidenceLevel: confidence, modelUsed: modelName,
    });

    await this.forecastRepo.save(forecast);
    return { status: 201, body: forecast.toJSON() };
  }

  async handleGetForecast(id: string): Promise<{ status: number; body: Record<string, unknown> }> {
    const forecast = await this.forecastRepo.findById(id);
    if (!forecast) return { status: 404, body: { error: 'Forecast not found' } };
    return { status: 200, body: forecast.toJSON() };
  }

  async handleEvaluateAccuracy(id: string, actuals: { date: string; actual: number }[]): Promise<{ status: number; body: Record<string, unknown> }> {
    const forecast = await this.forecastRepo.findById(id);
    if (!forecast) return { status: 404, body: { error: 'Forecast not found' } };

    const points = forecast.dataPoints;
    for (const a of actuals) {
      const point = points.find((p) => p.date === a.date);
      if (point) point.actual = a.actual;
    }

    const metrics = computeAccuracy(points);
    forecast.setAccuracy(metrics);
    await this.forecastRepo.save(forecast);

    return { status: 200, body: { forecastId: id, metrics, evaluatedPoints: actuals.length } };
  }

  private parseHorizon(horizon: string): number {
    const match = horizon.match(/^(\d+)([dwm])$/);
    if (!match) return 30;
    const [, num, unit] = match;
    switch (unit) {
      case 'd': return parseInt(num, 10);
      case 'w': return parseInt(num, 10) * 7;
      case 'm': return parseInt(num, 10) * 30;
      default: return 30;
    }
  }
}
