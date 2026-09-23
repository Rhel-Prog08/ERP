import { request } from './apiClient';
import type { Paginated, QueryParams } from '../types/api';
import type { Branch } from '../types/models';

export interface BranchInput {
  name: string;
  address?: string;
  phone?: string;
  status?: Branch['status'];
}

export const branchesService = {
  list(params?: QueryParams): Promise<Paginated<Branch>> {
    return request<Paginated<Branch>>('/branches', { query: params });
  },

  get(id: string): Promise<Branch> {
    return request<Branch>(`/branches/${id}`);
  },

  create(input: BranchInput): Promise<Branch> {
    return request<Branch>('/branches', { method: 'POST', body: input });
  },

  update(id: string, input: Partial<BranchInput>): Promise<Branch> {
    return request<Branch>(`/branches/${id}`, { method: 'PATCH', body: input });
  },

  deactivate(id: string): Promise<Branch> {
    return request<Branch>(`/branches/${id}`, { method: 'DELETE' });
  },
};
