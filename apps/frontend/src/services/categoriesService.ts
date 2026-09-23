import { request } from './apiClient';
import type { Paginated, QueryParams } from '../types/api';
import type { Category } from '../types/models';

export interface CategoryInput {
  name: string;
  description?: string;
  status?: Category['status'];
}

export const categoriesService = {
  list(params?: QueryParams): Promise<Paginated<Category>> {
    return request<Paginated<Category>>('/categories', { query: params });
  },

  get(id: string): Promise<Category> {
    return request<Category>(`/categories/${id}`);
  },

  create(input: CategoryInput): Promise<Category> {
    return request<Category>('/categories', { method: 'POST', body: input });
  },

  update(id: string, input: Partial<CategoryInput>): Promise<Category> {
    return request<Category>(`/categories/${id}`, { method: 'PATCH', body: input });
  },

  deactivate(id: string): Promise<Category> {
    return request<Category>(`/categories/${id}`, { method: 'DELETE' });
  },
};
