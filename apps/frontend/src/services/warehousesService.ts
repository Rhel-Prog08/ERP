import { request } from './apiClient';
import type { Paginated, QueryParams } from '../types/api';
import type { Warehouse } from '../types/models';

export interface WarehouseInput {
  name: string;
  branchId?: string | null;
  status?: Warehouse['status'];
}

export const warehousesService = {
  list(params?: QueryParams): Promise<Paginated<Warehouse>> {
    return request<Paginated<Warehouse>>('/warehouses', { query: params });
  },

  get(id: string): Promise<Warehouse> {
    return request<Warehouse>(`/warehouses/${id}`);
  },

  create(input: WarehouseInput): Promise<Warehouse> {
    return request<Warehouse>('/warehouses', { method: 'POST', body: input });
  },

  update(id: string, input: Partial<WarehouseInput>): Promise<Warehouse> {
    return request<Warehouse>(`/warehouses/${id}`, { method: 'PATCH', body: input });
  },

  deactivate(id: string): Promise<Warehouse> {
    return request<Warehouse>(`/warehouses/${id}`, { method: 'DELETE' });
  },
};
