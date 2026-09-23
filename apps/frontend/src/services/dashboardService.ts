import { request } from './apiClient';
import type { Dashboard } from '../types/models';

export const dashboardService = {
  /** GET /dashboard — agregaciones reales de la empresa del token. */
  get(): Promise<Dashboard> {
    return request<Dashboard>('/dashboard');
  },
};
