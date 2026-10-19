import { useCallback, useEffect, useRef, useState } from 'react';
import { toApiError } from '../services/apiClient';
import type { Paginated, QueryParams } from '../types/api';

export const PAGE_SIZE = 20;

interface UsePaginatedListOptions {
  /** Tamaño de página (por defecto 20). */
  limit?: number;
  /** Filtros estáticos adicionales (module, action, status...). */
  filters?: QueryParams;
}

interface UsePaginatedListResult<T> {
  items: T[];
  page: number;
  total: number;
  totalPages: number;
  loading: boolean;
  /** Mensaje de error (ApiError.message) o null. */
  error: string | null;
  /** Texto de búsqueda (se envía como ?q= con debounce de 350 ms). */
  search: string;
  setSearch: (value: string) => void;
  setPage: (page: number) => void;
  /** Recarga la página actual (p. ej. tras crear/editar un registro). */
  reload: () => void;
}

/**
 * Listado paginado genérico contra los endpoints del backend
 * (GET con ?page=&limit=&q=&filtros). Reinicia a página 1 al cambiar
 * la búsqueda o los filtros.
 */
export function usePaginatedList<T>(
  fetcher: (params: QueryParams) => Promise<Paginated<T>>,
  options: UsePaginatedListOptions = {}
): UsePaginatedListResult<T> {
  const { limit = PAGE_SIZE, filters } = options;

  const [items, setItems] = useState<T[]>([]);
  const [page, setPageState] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearchState] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [reloadToken, setReloadToken] = useState(0);
  const filtersKey = JSON.stringify(filters ?? {});

  // Debounce de la búsqueda (350 ms).
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Búsqueda o filtros cambian → volver a la página 1.
  useEffect(() => {
    setPageState(1);
  }, [debouncedSearch, filtersKey]);

  // Las refs se sincronizan en un effect (nunca durante el render).
  // El fetcher vive en ref: un callback inline no debe re-disparar el
  // efecto de petición (cambiaría de identidad en cada render).
  const filtersRef = useRef(filters);
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    filtersRef.current = filters;
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const params: QueryParams = {
      ...filtersRef.current,
      page,
      limit,
    };
    if (debouncedSearch.trim()) params.q = debouncedSearch.trim();

    fetcherRef.current(params)
      .then((result) => {
        if (!active) return;
        setItems(result.items);
        setTotal(result.pagination.total);
        setTotalPages(result.pagination.totalPages);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(toApiError(err).message);
        setItems([]);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page, debouncedSearch, reloadToken, filtersKey, limit]);

  const setPage = useCallback((next: number) => {
    setPageState(Math.max(1, next));
  }, []);

  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  return {
    items,
    page,
    total,
    totalPages,
    loading,
    error,
    search,
    setSearch: setSearchState,
    setPage,
    reload,
  };
}
