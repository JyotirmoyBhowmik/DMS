/**
 * DistributorHierarchy Domain Entity.
 * Models the parent-child relationship in the distribution network.
 * Levels: SUPER_STOCKIST > CNF > DISTRIBUTOR > SUB_DISTRIBUTOR
 */

export type HierarchyLevel = 'SUPER_STOCKIST' | 'CNF' | 'DISTRIBUTOR' | 'SUB_DISTRIBUTOR';

const HIERARCHY_RANK: Record<HierarchyLevel, number> = {
  SUPER_STOCKIST: 1,
  CNF: 2,
  DISTRIBUTOR: 3,
  SUB_DISTRIBUTOR: 4,
};

const MAX_DEPTH = 4;

export interface DistributorHierarchyProps {
  id: string;
  tenantId: string;
  parentDistributorId: string;
  childDistributorId: string;
  hierarchyLevel: HierarchyLevel;
  territory: string;
  effectiveFrom: string; // ISO-8601 date
  effectiveTo?: string;
  isActive?: boolean;
  version?: number;
}

export class DistributorHierarchy {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly parentDistributorId: string;
  public readonly childDistributorId: string;
  public readonly hierarchyLevel: HierarchyLevel;
  public readonly territory: string;
  public readonly effectiveFrom: string;
  private _effectiveTo?: string;
  private _isActive: boolean;
  private _version: number;

  public readonly domainEvents: Array<{ type: string; payload: any }> = [];

  constructor(props: DistributorHierarchyProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.parentDistributorId = props.parentDistributorId;
    this.childDistributorId = props.childDistributorId;
    this.hierarchyLevel = props.hierarchyLevel;
    this.territory = props.territory;
    this.effectiveFrom = props.effectiveFrom;
    this._effectiveTo = props.effectiveTo;
    this._isActive = props.isActive ?? true;
    this._version = props.version ?? 1;
  }

  get effectiveTo(): string | undefined { return this._effectiveTo; }
  get isActive(): boolean { return this._isActive; }
  get version(): number { return this._version; }

  static create(props: DistributorHierarchyProps): DistributorHierarchy {
    // Business rule: no self-reference
    if (props.parentDistributorId === props.childDistributorId) {
      throw new Error('A distributor cannot be its own parent');
    }
    const h = new DistributorHierarchy(props);
    h.domainEvents.push({
      type: 'distributor.hierarchy.created',
      payload: { hierarchyId: h.id, parentDistributorId: h.parentDistributorId, childDistributorId: h.childDistributorId, hierarchyLevel: h.hierarchyLevel }
    });
    return h;
  }

  /**
   * Validates that the parent level is higher (numerically lower rank) than child level.
   */
  static validateParentLevel(parentLevel: HierarchyLevel, childLevel: HierarchyLevel): void {
    if (HIERARCHY_RANK[parentLevel] >= HIERARCHY_RANK[childLevel]) {
      throw new Error(`Parent level ${parentLevel} (rank ${HIERARCHY_RANK[parentLevel]}) must be higher than child level ${childLevel} (rank ${HIERARCHY_RANK[childLevel]})`);
    }
  }

  /**
   * Validates max depth constraint.
   * existingDepth = number of ancestors the parent already has.
   */
  static validateMaxDepth(existingDepth: number): void {
    if (existingDepth + 1 >= MAX_DEPTH) {
      throw new Error(`Maximum hierarchy depth of ${MAX_DEPTH} levels exceeded`);
    }
  }

  /**
   * Detect circular hierarchy. Pass the full ancestor chain of the parent.
   */
  static detectCircular(childId: string, ancestorIds: string[]): void {
    if (ancestorIds.includes(childId)) {
      throw new Error(`Circular hierarchy detected: child ${childId} is already an ancestor`);
    }
  }

  static getLevelRank(level: HierarchyLevel): number {
    return HIERARCHY_RANK[level];
  }

  deactivate(): void {
    this._isActive = false;
    this._effectiveTo = new Date().toISOString().split('T')[0];
    this._version++;
    this.domainEvents.push({
      type: 'distributor.hierarchy.deactivated',
      payload: { hierarchyId: this.id, parentDistributorId: this.parentDistributorId, childDistributorId: this.childDistributorId }
    });
  }

  activate(): void {
    this._isActive = true;
    this._effectiveTo = undefined;
    this._version++;
    this.domainEvents.push({
      type: 'distributor.hierarchy.activated',
      payload: { hierarchyId: this.id, parentDistributorId: this.parentDistributorId, childDistributorId: this.childDistributorId }
    });
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      parentDistributorId: this.parentDistributorId,
      childDistributorId: this.childDistributorId,
      hierarchyLevel: this.hierarchyLevel,
      territory: this.territory,
      effectiveFrom: this.effectiveFrom,
      effectiveTo: this._effectiveTo,
      isActive: this._isActive,
      version: this._version,
    };
  }
}
