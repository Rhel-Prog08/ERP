import { request } from './apiClient';
import type { Paginated, QueryParams } from '../types/api';
import type { DocumentCreateInput, Purchase } from '../types/models';

export const purchasesService = {
  list(params?: QueryParams): Promise<Paginated<Purchase>> {
    return request<Paginated<Purchase>>('/purchases', { query: params });
  },

  get(id: string): Promise<Purchase> {
    return request<Purchase>(`/purchases/${id}`);
  },

  /** Crea borrador (DRAFT). */
  create(input: DocumentCreateInput): Promise<Purchase> {
    return request<Purchase>('/purchases', { method: 'POST', body: input });
  },

  /** DRAFT → CONFIRMED. */
  confirm(id: string): Promise<Purchase> {
    return request<Purchase>(`/purchases/${id}/confirm`, { method: 'POST' });
  },

  /** CONFIRMED → RECEIVED: incrementa inventario (movimiento ENTRY). */
  receive(id: string): Promise<Purchase> {
    return request<Purchase>(`/purchases/${id}/receive`, { method: 'POST' });
  },

  /** Cancela con motivo obligatorio; revierte stock si estaba recibida. */
  cancel(id: string, cancelReason: string): Promise<Purchase> {
    return request<Purchase>(`/purchases/${id}/cancel`, {
      method: 'POST',
      body: { cancelReason },
    });
  },
};
