import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}) {

  if (totalItems === 0) {
    return null;
  }

  const start = (page - 1) * pageSize + 1;

  const end = Math.min(page * pageSize, totalItems);

  return (
    <div
      className="
        flex flex-wrap items-center justify-between gap-3
        border-t border-zinc-800 px-4 py-3
        text-sm text-zinc-400
      "
    >

      <span>
        {start}–{end} de {totalItems}
      </span>

      <div className="flex items-center gap-2">

        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="
            rounded-xl border border-zinc-800
            bg-zinc-950 p-2
            transition hover:bg-zinc-800
            disabled:opacity-40
          "
        >
          <ChevronLeft size={14} />
        </button>

        <span className="text-zinc-300">
          Página {page} de {totalPages}
        </span>

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="
            rounded-xl border border-zinc-800
            bg-zinc-950 p-2
            transition hover:bg-zinc-800
            disabled:opacity-40
          "
        >
          <ChevronRight size={14} />
        </button>

      </div>

    </div>
  );
}
