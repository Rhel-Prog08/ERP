import { request } from './apiClient';
import type { Paginated, QueryParams } from '../types/api';
import type { Supplier } from '../types/models';

export interface SupplierInput {
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: string;
  status?: Supplier['status'];
}

export const suppliersService = {
  list(params?: QueryParams): Promise<Paginated<Supplier>> {
    return request<Paginated<Supplier>>('/suppliers', { query: params });
  },

  get(id: string): Promise<Supplier> {
    return request<Supplier>(`/suppliers/${id}`);
  },

  create(input: SupplierInput): Promise<Supplier> {
    return request<Supplier>('/suppliers', { method: 'POST', body: input });
  },

  update(id: string, input: Partial<SupplierInput>): Promise<Supplier> {
    return request<Supplier>(`/suppliers/${id}`, { method: 'PATCH', body: input });
  },

  deactivate(id: string): Promise<Supplier> {
    return request<Supplier>(`/suppliers/${id}`, { method: 'DELETE' });
  },
};
