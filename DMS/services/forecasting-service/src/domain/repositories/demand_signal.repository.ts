import { DemandSignalAggregate, DemandSignalType, DemandSignalStatus } from '../entities/demand_signal.entity.js';

export interface DemandSignalFilter {
  tenantId: string;
  signalName?: string;
  signalType?: DemandSignalType;
  status?: DemandSignalStatus;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'signalName';
  sortOrder?: 'asc' | 'desc';
}

export interface DemandSignalRepository {
  save(signal: DemandSignalAggregate): Promise<DemandSignalAggregate>;
  findById(id: string, tenantId: string): Promise<DemandSignalAggregate | null>;
  findByName(signalName: string, tenantId: string): Promise<DemandSignalAggregate | null>;
  findAll(filter: DemandSignalFilter): Promise<{ signals: DemandSignalAggregate[]; total: number; page: number; pageSize: number }>;
  delete(id: string, tenantId: string): Promise<boolean>;
}
