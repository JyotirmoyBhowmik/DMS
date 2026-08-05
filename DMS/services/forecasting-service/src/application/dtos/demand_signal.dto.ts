import { DemandSignalType, DemandSignalStatus } from '../../domain/entities/demand_signal.entity.js';

export interface CreateDemandSignalDto {
  id?: string;
  signalName: string;
  signalType?: DemandSignalType;
  signalValue?: number;
  confidenceScore?: number;
  sourceChannel?: string;
  idempotencyKey?: string;
}

export interface UpdateDemandSignalDto {
  action?: 'process' | 'update_value' | 'archive';
  signalValue?: number;
  confidenceScore?: number;
  expectedVersion: number;
}

export interface DemandSignalResponseDto {
  id: string;
  tenantId: string;
  signalName: string;
  signalType: DemandSignalType;
  signalValue: number;
  confidenceScore: number;
  status: DemandSignalStatus;
  sourceChannel: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListDemandSignalsQueryDto {
  signalName?: string;
  signalType?: DemandSignalType;
  status?: DemandSignalStatus;
  page?: number;
  pageSize?: number;
}
