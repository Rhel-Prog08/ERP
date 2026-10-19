import { request } from './apiClient';
import type { Settings } from '../types/models';

export interface SettingsUpdateInput {
  taxRate?: number;
  allowNegativeStock?: boolean;
}

/** Singleton por empresa: GET /settings (find-or-create) y PATCH /settings. */
export const settingsService = {
  get(): Promise<Settings> {
    return request<Settings>('/settings');
  },

  update(input: SettingsUpdateInput): Promise<Settings> {
    return request<Settings>('/settings', { method: 'PATCH', body: input });
  },
};
