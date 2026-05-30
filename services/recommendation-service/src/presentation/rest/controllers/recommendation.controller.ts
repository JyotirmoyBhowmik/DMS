import { randomUUID } from 'node:crypto';

// ── Domain Entities ────────────────────────────────────────────
export type RecommendationType = 'cross_sell' | 'upsell' | 'next_best_action' | 'assortment' | 'visit_priority';
export type RecommendationStatus = 'generated' | 'presented' | 'accepted' | 'dismissed' | 'expired';

export interface RecommendationItem {
  skuId: string; skuName: string; score: number; reason: string; priority: number;
  metadata: Record<string, unknown>;
}

export interface RecommendationProps {
  id: string; tenantId: string; type: RecommendationType; targetId: string;
  items: RecommendationItem[]; score: number; reason: string; modelVersion: string;
  status: RecommendationStatus; generatedAt: string; expiresAt: string;
}

export class Recommendation {
  private props: RecommendationProps;
  private constructor(props: RecommendationProps) { this.props = { ...props }; }

  static create(input: Omit<RecommendationProps, 'id' | 'status' | 'generatedAt' | 'expiresAt'>): Recommendation {
    const now = new Date();
    return new Recommendation({
      ...input, id: randomUUID(), status: 'generated', generatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  static reconstitute(props: RecommendationProps): Recommendation { return new Recommendation(props); }

  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get type(): RecommendationType { return this.props.type; }
  get targetId(): string { return this.props.targetId; }
  get items(): RecommendationItem[] { return this.props.items; }
  get status(): RecommendationStatus { return this.props.status; }

  present(): void { this.props.status = 'presented'; }
  accept(): void { this.props.status = 'accepted'; }
  dismiss(): void { this.props.status = 'dismissed'; }
  expire(): void { this.props.status = 'expired'; }

  toJSON(): Record<string, unknown> { return { ...this.props }; }
}

export interface InteractionRecord {
  id: string; recommendationId: string; action: 'accepted' | 'dismissed' | 'converted';
  timestamp: string; metadata: Record<string, unknown>;
}

// ── Scoring Adapters ────────────────────────────────────────────

/**
 * Collaborative Filtering scorer using item-based cosine similarity.
 */
class CollaborativeFilteringScorer {
  // Mock purchase matrix: outlet -> SKUs purchased (with quantities)
  private purchaseMatrix: Map<string, Map<string, number>> = new Map([
    ['outlet-001', new Map([['SKU-A', 50], ['SKU-B', 30], ['SKU-C', 20], ['SKU-D', 10]])],
    ['outlet-002', new Map([['SKU-A', 40], ['SKU-B', 45], ['SKU-E', 25], ['SKU-F', 15]])],
    ['outlet-003', new Map([['SKU-B', 35], ['SKU-C', 40], ['SKU-D', 30], ['SKU-G', 20]])],
    ['outlet-004', new Map([['SKU-A', 60], ['SKU-C', 25], ['SKU-E', 35], ['SKU-H', 10]])],
  ]);

  private skuCatalog = new Map<string, string>([
    ['SKU-A', 'Premium Basmati Rice 5kg'], ['SKU-B', 'Refined Sunflower Oil 1L'],
    ['SKU-C', 'Whole Wheat Atta 10kg'], ['SKU-D', 'Toor Dal 1kg'],
    ['SKU-E', 'Sugar 5kg'], ['SKU-F', 'Tea Powder 500g'],
    ['SKU-G', 'Salt 1kg'], ['SKU-H', 'Ghee 500ml'],
  ]);

  score(outletId: string, _type: RecommendationType): RecommendationItem[] {
    const outletPurchases = this.purchaseMatrix.get(outletId);
    if (!outletPurchases) return [];

    const purchasedSkus = new Set(outletPurchases.keys());
    const candidateScores = new Map<string, { score: number; reason: string }>();

    // Find similar outlets and their purchases
    for (const [otherId, otherPurchases] of this.purchaseMatrix) {
      if (otherId === outletId) continue;

      const similarity = this.cosineSimilarity(outletPurchases, otherPurchases);
      if (similarity < 0.1) continue;

      for (const [sku, qty] of otherPurchases) {
        if (purchasedSkus.has(sku)) continue;
        const current = candidateScores.get(sku) ?? { score: 0, reason: '' };
        current.score += similarity * qty;
        current.reason = `Similar outlets purchase this item (similarity: ${(similarity * 100).toFixed(0)}%)`;
        candidateScores.set(sku, current);
      }
    }

    return Array.from(candidateScores.entries())
      .sort(([, a], [, b]) => b.score - a.score)
      .slice(0, 5)
      .map(([skuId, { score, reason }], i) => ({
        skuId, skuName: this.skuCatalog.get(skuId) ?? skuId,
        score: Math.round(score * 100) / 100, reason, priority: i + 1, metadata: {},
      }));
  }

  private cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
    const allKeys = new Set([...a.keys(), ...b.keys()]);
    let dotProduct = 0, magnitudeA = 0, magnitudeB = 0;
    for (const key of allKeys) {
      const va = a.get(key) ?? 0;
      const vb = b.get(key) ?? 0;
      dotProduct += va * vb;
      magnitudeA += va * va;
      magnitudeB += vb * vb;
    }
    const denom = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
    return denom === 0 ? 0 : dotProduct / denom;
  }
}

/**
 * Rule-based scorer for business rules.
 */
class RuleBasedScorer {
  score(outletId: string, type: RecommendationType): RecommendationItem[] {
    if (type === 'next_best_action') {
      return [
        { skuId: 'action-1', skuName: 'Collect pending payment', score: 0.95, reason: 'Payment overdue by 15 days', priority: 1, metadata: { amount: 25000, dueDate: '2024-03-01' } },
        { skuId: 'action-2', skuName: 'Introduce new product line', score: 0.82, reason: 'Outlet category matches target segment', priority: 2, metadata: { productLine: 'Premium Snacks' } },
        { skuId: 'action-3', skuName: 'Review planogram compliance', score: 0.75, reason: 'Last audit was 45 days ago', priority: 3, metadata: { lastAudit: '2024-01-15' } },
      ];
    }

    if (type === 'visit_priority') {
      return [
        { skuId: outletId, skuName: 'High-value outlet visit', score: 0.90, reason: 'Revenue decline detected (-12% MoM)', priority: 1, metadata: { revenueChange: -12 } },
      ];
    }

    return [];
  }
}

// ── Repository ────────────────────────────────────────────────
class InMemoryRecommendationRepository {
  private store = new Map<string, RecommendationProps>();

  async save(rec: Recommendation): Promise<void> {
    this.store.set(rec.id, rec.toJSON() as unknown as RecommendationProps);
  }

  async findById(id: string): Promise<Recommendation | null> {
    const data = this.store.get(id);
    return data ? Recommendation.reconstitute(data) : null;
  }

  async findByTarget(targetId: string, type?: RecommendationType): Promise<Recommendation[]> {
    return Array.from(this.store.values())
      .filter((r) => r.targetId === targetId && (!type || r.type === type) && r.status !== 'expired')
      .map((r) => Recommendation.reconstitute(r));
  }
}

class InMemoryInteractionRepository {
  private records: InteractionRecord[] = [];

  async save(record: InteractionRecord): Promise<void> { this.records.push(record); }

  async findByRecommendation(recId: string): Promise<InteractionRecord[]> {
    return this.records.filter((r) => r.recommendationId === recId);
  }
}

// ── Controller ────────────────────────────────────────────────
export class RecommendationController {
  private readonly recRepo: InMemoryRecommendationRepository;
  private readonly interactionRepo: InMemoryInteractionRepository;
  private readonly cfScorer: CollaborativeFilteringScorer;
  private readonly ruleScorer: RuleBasedScorer;

  constructor() {
    this.recRepo = new InMemoryRecommendationRepository();
    this.interactionRepo = new InMemoryInteractionRepository();
    this.cfScorer = new CollaborativeFilteringScorer();
    this.ruleScorer = new RuleBasedScorer();
  }

  async handleGenerate(body: {
    tenantId: string; targetId: string; type: RecommendationType;
  }): Promise<{ status: number; body: Record<string, unknown> }> {
    let items: RecommendationItem[];
    let modelVersion: string;

    if (body.type === 'cross_sell' || body.type === 'upsell' || body.type === 'assortment') {
      items = this.cfScorer.score(body.targetId, body.type);
      modelVersion = 'cf-cosine-v1.0';
    } else {
      items = this.ruleScorer.score(body.targetId, body.type);
      modelVersion = 'rule-engine-v1.0';
    }

    if (items.length === 0) {
      return { status: 200, body: { message: 'No recommendations available', items: [] } };
    }

    const overallScore = items.reduce((s, i) => s + i.score, 0) / items.length;

    const rec = Recommendation.create({
      tenantId: body.tenantId, type: body.type, targetId: body.targetId,
      items, score: Math.round(overallScore * 100) / 100,
      reason: `Generated ${items.length} ${body.type} recommendations`, modelVersion,
    });

    await this.recRepo.save(rec);
    return { status: 201, body: rec.toJSON() };
  }

  async handleGetRecommendations(targetId: string, type?: RecommendationType): Promise<{ status: number; body: Record<string, unknown> }> {
    const recs = await this.recRepo.findByTarget(targetId, type);
    return { status: 200, body: { items: recs.map((r) => r.toJSON()), count: recs.length } };
  }

  async handleInteraction(recId: string, action: 'accepted' | 'dismissed'): Promise<{ status: number; body: Record<string, unknown> }> {
    const rec = await this.recRepo.findById(recId);
    if (!rec) return { status: 404, body: { error: 'Recommendation not found' } };

    if (action === 'accepted') rec.accept(); else rec.dismiss();
    await this.recRepo.save(rec);

    const interaction: InteractionRecord = {
      id: randomUUID(), recommendationId: recId, action,
      timestamp: new Date().toISOString(), metadata: {},
    };
    await this.interactionRepo.save(interaction);

    return { status: 200, body: { recommendationId: recId, action, recorded: true } };
  }
}
