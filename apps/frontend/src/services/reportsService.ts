import { downloadCsv, request, requestCsv } from './apiClient';
import type { CsvDownload } from './apiClient';
import type { QueryParams } from '../types/api';
import type { ReportKey, ReportResult } from '../types/models';

/** Los 8 reportes del backend bajo /reports/<tipo>. */
export const REPORT_KEYS: ReportKey[] = [
  'sales',
  'purchases',
  'inventory',
  'movements',
  'products',
  'customers',
  'suppliers',
  'audit',
];

export const REPORT_LABELS: Record<ReportKey, string> = {
  sales: 'Ventas',
  purchases: 'Compras',
  inventory: 'Inventario',
  movements: 'Movimientos',
  products: 'Productos',
  customers: 'Clientes',
  suppliers: 'Proveedores',
  audit: 'Auditoría',
};

function path(key: ReportKey): string {
  return `/reports/${key}`;
}

export const reportsService = {
  /** JSON por defecto: { report, count, rows }. */
  run(key: ReportKey, params?: QueryParams): Promise<ReportResult> {
    return request<ReportResult>(path(key), { query: params });
  },

  /** ?format=csv (exige reports.export) → blob listo para descargar. */
  download(key: ReportKey, params?: QueryParams): Promise<CsvDownload> {
    return requestCsv(path(key), params);
  },

  /** Atajo: descarga y dispara el guardado en el navegador. */
  exportCsv(key: ReportKey, params?: QueryParams): Promise<boolean> {
    return reportsService.download(key, params).then(downloadCsv);
  },
};
