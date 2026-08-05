/**
 * DistributorHierarchy Repository Interface (Port).
 */
import { DistributorHierarchy, HierarchyLevel } from '../entities/distributor-hierarchy.js';

export abstract class DistributorHierarchyRepository {
  abstract save(hierarchy: DistributorHierarchy): Promise<void>;
  abstract findById(tenantId: string, id: string): Promise<DistributorHierarchy | null>;
  abstract findByChildDistributor(tenantId: string, childDistributorId: string): Promise<DistributorHierarchy | null>;
  abstract findByParentDistributor(tenantId: string, parentDistributorId: string): Promise<DistributorHierarchy[]>;
  abstract findByLevel(tenantId: string, level: HierarchyLevel): Promise<DistributorHierarchy[]>;
  abstract findAncestors(tenantId: string, distributorId: string): Promise<DistributorHierarchy[]>;
  abstract findDescendants(tenantId: string, distributorId: string): Promise<DistributorHierarchy[]>;
  abstract findAll(tenantId: string): Promise<DistributorHierarchy[]>;
  abstract delete(tenantId: string, id: string): Promise<void>;
}
