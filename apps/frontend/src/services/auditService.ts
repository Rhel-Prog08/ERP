import { request } from './apiClient';
import type { Paginated, QueryParams } from '../types/api';
import type { AuditLog } from '../types/models';

/**
 * Bitácora de SOLO LECTURA (GET /audit, permiso audit.read).
 * El backend no expone escritura: los registros los genera recordAudit().
 * Filtros admitidos: action, module, entity, entityId, userId, dateFrom, dateTo.
 */
export const auditService = {
  list(params?: QueryParams): Promise<Paginated<AuditLog>> {
    return request<Paginated<AuditLog>>('/audit', { query: params });
  },
};
