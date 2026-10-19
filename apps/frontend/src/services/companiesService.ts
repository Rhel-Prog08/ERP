import { request } from './apiClient';
import type { Company } from '../types/models';

export interface CompanyUpdateInput {
  name?: string;
  legalName?: string;
  taxId?: string;
  phone?: string;
  email?: string;
  address?: string;
}

/**
 * Companies NO es un CRUD estándar:
 * - GET /companies devuelve siempre la empresa del token.
 * - PATCH /companies/:id edita únicamente la empresa propia (otra → 404).
 * El alta de empresas (POST) se omite a propósito: es una operación de
 * aprovisionamiento que no forma parte de los módulos del ERP web.
 */
export const companiesService = {
  get(): Promise<Company> {
    return request<Company>('/companies');
  },

  updateOwn(id: string, input: CompanyUpdateInput): Promise<Company> {
    return request<Company>(`/companies/${id}`, { method: 'PATCH', body: input });
  },
};
