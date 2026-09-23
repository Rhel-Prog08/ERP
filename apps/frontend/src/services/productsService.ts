import { request } from './apiClient';
import type { Paginated, QueryParams } from '../types/api';
import type { Product, Unit } from '../types/models';

export interface ProductInput {
  sku: string;
  name: string;
  description?: string;
  categoryId: string;
  supplierId?: string | null;
  purchasePrice: number;
  salePrice: number;
  stockMin?: number;
  unit?: Unit;
  status?: Product['status'];
}

export const productsService = {
  list(params?: QueryParams): Promise<Paginated<Product>> {
    return request<Paginated<Product>>('/products', { query: params });
  },

  get(id: string): Promise<Product> {
    return request<Product>(`/products/${id}`);
  },

  create(input: ProductInput): Promise<Product> {
    return request<Product>('/products', { method: 'POST', body: input });
  },

  update(id: string, input: Partial<ProductInput>): Promise<Product> {
    return request<Product>(`/products/${id}`, { method: 'PATCH', body: input });
  },

  deactivate(id: string): Promise<Product> {
    return request<Product>(`/products/${id}`, { method: 'DELETE' });
  },
};
