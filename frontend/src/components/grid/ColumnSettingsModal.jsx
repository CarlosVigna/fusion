import { useState } from "react";

import { GripVertical, X } from "lucide-react";

const DEFAULT_WIDTH = 150;

export default function ColumnSettingsModal({
  allColumns,
  order,
  visibility,
  widths,
  defaultOrder,
  defaultVisibility,
  onClose,
  onSave,
}) {

  const [localOrder, setLocalOrder] =
    useState(order);

  const [localVisibility, setLocalVisibility] =
    useState(visibility);

  const [localWidths, setLocalWidths] =
    useState(widths);

  const [draggedKey, setDraggedKey] =
    useState(null);

  const columnsByKey = Object.fromEntries(
    allColumns.map((col) => [col.key, col])
  );

  function toggleVisible(key) {

    setLocalVisibility((current) => ({
      ...current,
      [key]: !current[key],
    }));

  }

  function setWidth(key, value) {

    const numeric = Number(value);

    setLocalWidths((current) => ({
      ...current,
      [key]: Number.isFinite(numeric) && numeric > 0
        ? numeric
        : current[key],
    }));

  }

  function handleDragStart(key) {

    setDraggedKey(key);

  }

  function handleDragOver(e, overKey) {

    e.preventDefault();

    if (!draggedKey || draggedKey === overKey) {
      return;
    }

    const col = columnsByKey[overKey];

    if (col?.sticky) {
      return;
    }

    setLocalOrder((current) => {

      const next = current.filter((k) => k !== draggedKey);

      const overIndex = next.indexOf(overKey);

      next.splice(overIndex, 0, draggedKey);

      return next;

    });

  }

  function handleDragEnd() {

    setDraggedKey(null);

  }

  function handleRestoreDefault() {

    setLocalOrder(defaultOrder);

    setLocalVisibility(defaultVisibility);

    setLocalWidths({});

  }

  function handleSave() {

    onSave({
      order: localOrder,
      visibility: localVisibility,
      widths: localWidths,
    });

  }

  return (
    <div
      className="
        fixed inset-0 z-50
        flex items-center justify-center
        bg-black/60 p-4
      "
      onClick={onClose}
    >

      <div
        onClick={(e) => e.stopPropagation()}
        className="
          w-full max-w-lg rounded-2xl
          border border-zinc-800
          bg-zinc-900 p-6
        "
      >

        <div className="flex items-center justify-between">

          <div>

            <h2 className="text-lg font-semibold">
              Configurar colunas
            </h2>

            <p className="text-sm text-zinc-500">
              Arraste para reordenar, marque para mostrar/ocultar e ajuste a largura
            </p>

          </div>

          <button
            onClick={onClose}
            className="
              rounded-xl p-2 text-zinc-400
              transition hover:bg-zinc-800 hover:text-white
            "
          >
            <X size={18} />
          </button>

        </div>

        <ul className="mt-4 max-h-96 space-y-1 overflow-y-auto pr-1">

          {localOrder.map((key) => {

            const col = columnsByKey[key];

            if (!col) {
              return null;
            }

            const isSticky = !!col.sticky;

            const isVisible = !col.optional || !!localVisibility[key];

            return (
              <li
                key={key}
                draggable={!isSticky}
                onDragStart={() => handleDragStart(key)}
                onDragOver={(e) => handleDragOver(e, key)}
                onDragEnd={handleDragEnd}
                className={`
                  flex items-center gap-3
                  rounded-xl border border-zinc-800
                  bg-zinc-950 px-3 py-2.5
                  ${draggedKey === key ? "opacity-50" : ""}
                `}
              >

                <span
                  className={`
                    text-zinc-600
                    ${isSticky ? "opacity-30" : "cursor-grab"}
                  `}
                  title={isSticky ? "Coluna fixa" : "Arrastar"}
                >
                  <GripVertical size={16} />
                </span>

                <input
                  type="checkbox"
                  checked={isVisible}
                  disabled={!col.optional}
                  onChange={() => toggleVisible(key)}
                  className="rounded border-zinc-700 disabled:opacity-40"
                />

                <span className="flex-1 text-sm">
                  {col.label}
                  {isSticky && (
                    <span className="ml-1 text-xs text-zinc-600">
                      (fixa)
                    </span>
                  )}
                </span>

                <input
                  type="number"
                  min={60}
                  value={localWidths[key] ?? DEFAULT_WIDTH}
                  onChange={(e) => setWidth(key, e.target.value)}
                  className="
                    w-20 rounded-lg border border-zinc-800
                    bg-zinc-900 px-2 py-1.5 text-right
                    text-xs outline-none
                  "
                />

                <span className="text-xs text-zinc-600">px</span>

              </li>
            );

          })}

        </ul>

        <div className="mt-6 flex items-center justify-between gap-3">

          <button
            onClick={handleRestoreDefault}
            className="
              rounded-2xl border border-zinc-700
              px-5 py-3 text-sm font-semibold
              text-zinc-400 transition
              hover:bg-zinc-800 hover:text-white
            "
          >
            Restaurar padrão
          </button>

          <div className="flex gap-3">

            <button
              onClick={onClose}
              className="
                rounded-2xl border border-zinc-700
                px-5 py-3 text-sm font-semibold
                text-zinc-400 transition
                hover:bg-zinc-800 hover:text-white
              "
            >
              Cancelar
            </button>

            <button
              onClick={handleSave}
              className="
                rounded-2xl bg-white px-6 py-3
                text-sm font-semibold text-black
                transition hover:opacity-90
              "
            >
              Salvar
            </button>

          </div>

        </div>

      </div>

    </div>
  );
}
