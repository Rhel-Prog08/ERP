import { request } from './apiClient';
import type { Paginated, QueryParams } from '../types/api';
import type { Balance, Movement, MovementInput } from '../types/models';

export const inventoryService = {
  /** GET /inventory — balances por almacén (q, warehouseId, lowStock, sort). */
  listBalances(params?: QueryParams): Promise<Paginated<Balance>> {
    return request<Paginated<Balance>>('/inventory', { query: params });
  },

  /** GET /inventory/movements — historial (type, warehouse, fechas). */
  listMovements(params?: QueryParams): Promise<Paginated<Movement>> {
    return request<Paginated<Movement>>('/inventory/movements', { query: params });
  },

  /** POST /inventory/movements — permiso según tipo (entry/exit/adjust). */
  createMovement(input: MovementInput): Promise<Movement> {
    return request<Movement>('/inventory/movements', { method: 'POST', body: input });
  },
};
