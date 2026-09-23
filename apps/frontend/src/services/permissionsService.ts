import { request } from './apiClient';
import type { Permission } from '../types/models';

/** Catálogo GLOBAL de permisos (GET /permissions → array). */
export const permissionsService = {
  list(): Promise<Permission[]> {
    return request<Permission[]>('/permissions');
  },
};
