import { request } from './apiClient';
import type { Paginated, QueryParams } from '../types/api';
import type { DocumentCreateInput, Sale } from '../types/models';

export const salesService = {
  list(params?: QueryParams): Promise<Paginated<Sale>> {
    return request<Paginated<Sale>>('/sales', { query: params });
  },

  get(id: string): Promise<Sale> {
    return request<Sale>(`/sales/${id}`);
  },

  /** Crea borrador (DRAFT); totales los recalcula el servidor. */
  create(input: DocumentCreateInput): Promise<Sale> {
    return request<Sale>('/sales', { method: 'POST', body: input });
  },

  /** DRAFT → CONFIRMED (descuenta inventario). */
  confirm(id: string): Promise<Sale> {
    return request<Sale>(`/sales/${id}/confirm`, { method: 'POST' });
  },

  /** CONFIRMED → COMPLETED. */
  complete(id: string): Promise<Sale> {
    return request<Sale>(`/sales/${id}/complete`, { method: 'POST' });
  },

  /** Cancela con motivo obligatorio; revierte inventario si estaba confirmada. */
  cancel(id: string, cancelReason: string): Promise<Sale> {
    return request<Sale>(`/sales/${id}/cancel`, { method: 'POST', body: { cancelReason } });
  },
};
