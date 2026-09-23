/** Formateo en español: moneda EUR, fechas es-ES. Sin datos ficticios. */

const currencyFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
});

const numberFormatter = new Intl.NumberFormat('es-ES', {
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat('es-ES', {
  style: 'percent',
  maximumFractionDigits: 2,
});

export function formatCurrency(value?: number | null): string {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return '—';
  return currencyFormatter.format(Number(value));
}

export function formatNumber(value?: number | null, maximumFractionDigits = 2): string {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits }).format(Number(value));
}

/** taxRate (0.21) → "21 %" */
export function formatPercent(rate?: number | null): string {
  if (rate === undefined || rate === null || Number.isNaN(Number(rate))) return '—';
  return percentFormatter.format(Number(rate));
}

export function formatDate(value?: string | number | Date | null): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-ES');
}

export function formatDateTime(value?: string | number | Date | null): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** '2026-09-23T10:00:00.000Z' → '23/09' (etiquetas de gráfico). */
export function formatDayShort(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
}

export function formatTimeAgo(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
