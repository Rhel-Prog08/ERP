import { request } from './apiClient';
import type { Paginated, QueryParams } from '../types/api';
import type { Customer } from '../types/models';

export interface CustomerInput {
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: string;
  status?: Customer['status'];
}

export const customersService = {
  list(params?: QueryParams): Promise<Paginated<Customer>> {
    return request<Paginated<Customer>>('/customers', { query: params });
  },

  get(id: string): Promise<Customer> {
    return request<Customer>(`/customers/${id}`);
  },

  create(input: CustomerInput): Promise<Customer> {
    return request<Customer>('/customers', { method: 'POST', body: input });
  },

  update(id: string, input: Partial<CustomerInput>): Promise<Customer> {
    return request<Customer>(`/customers/${id}`, { method: 'PATCH', body: input });
  },

  deactivate(id: string): Promise<Customer> {
    return request<Customer>(`/customers/${id}`, { method: 'DELETE' });
  },
};
