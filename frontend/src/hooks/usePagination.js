import { useMemo, useState } from "react";

const DEFAULT_PAGE_SIZE = 20;

// Padroniza paginacao client-side: mesmo tamanho de pagina e mesmo
// comportamento em todas as listagens do sistema. A pagina e' "presa"
// (clamped) ao total atual durante o render, em vez de corrigida via
// efeito — evita ficar numa pagina vazia depois de um filtro reduzir
// a lista, sem precisar de setState dentro de useEffect.
export function usePagination(items, pageSize = DEFAULT_PAGE_SIZE) {

  const [page, setPage] = useState(1);

  const totalPages = Math.max(
    1,
    Math.ceil(items.length / pageSize)
  );

  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {

    const start = (safePage - 1) * pageSize;

    return items.slice(start, start + pageSize);

  }, [items, safePage, pageSize]);

  return {
    page: safePage,
    setPage,
    totalPages,
    pageItems,
    pageSize,
    totalItems: items.length,
  };

}
