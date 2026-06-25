import { useEffect, useMemo, useRef, useState } from "react";

import { Link } from "react-router-dom";

import toast from "react-hot-toast";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Columns3,
  RefreshCw,
  Settings,
} from "lucide-react";

import { useGridStore } from "../store/gridStore";

import { triggerImport } from "../services/importStatusService";

import {
  getPreference,
  savePreference,
} from "../services/preferencesService";

import StatusBadge from "../components/ui/StatusBadge";
import PlatformBadge from "../components/ui/PlatformBadge";
import ObservationModal from "../components/observations/ObservationModal";
import ColumnSettingsModal from "../components/grid/ColumnSettingsModal";

import { formatDelay } from "../utils/formatDelay";
import { specialFirstCompare } from "../utils/specialFirstCompare";
import { formatLocalDateTime } from "../utils/dateUtils";

const rowStyles = {
  ONLINE:
    "hover:bg-green-500/5",

  OFFLINE:
    "hover:bg-red-500/5",

  STALE:
    "hover:bg-red-500/5",

  LOW_BATTERY:
    "hover:bg-yellow-500/5",

  MAINTENANCE:
    "hover:bg-blue-500/5",
};

const COLUMN_STORAGE_KEY = "fusion_grid_columns";
const COLUMN_WIDTHS_STORAGE_KEY = "fusion_grid_col_widths";
const COLUMN_ORDER_STORAGE_KEY = "fusion_grid_column_order";
const MIN_COLUMN_WIDTH = 60;
const GRID_COLUMNS_PREFERENCE_KEY = "grid_columns";
const PREFERENCE_SAVE_DEBOUNCE_MS = 1000;

// Colunas fixas não podem ser ocultadas. Colunas opcionais
// (optional: true) podem ser togadas pelo usuário e persistem
// no localStorage.
const ALL_COLUMNS = [
  {
    key: "status",
    label: "Status",
    optional: true,
    sortValue: (v) => v.status ?? "",
  },
  {
    key: "plate",
    label: "Placa",
    sticky: true,
    sortValue: (v) => v.plate ?? "",
  },
  {
    key: "insuredName",
    label: "Segurado",
    sortValue: (v) => v.insuredName ?? "",
  },
  {
    key: "platform",
    label: "Plataforma",
    sortValue: (v) => v.platform ?? "",
  },
  {
    key: "batteryLevel",
    label: "Bateria",
    optional: true,
    sortValue: (v) => v.batteryLevel ?? -1,
  },
  {
    key: "activeDevice",
    label: "Dispositivo",
    sortValue: (v) => v.activeDevice ?? "",
  },
  {
    key: "lineNumber",
    label: "Linha",
    sortValue: (v) => v.lineNumber ?? "",
  },
  {
    key: "operator",
    label: "Operadora",
    optional: true,
    sortValue: (v) => v.operator ?? "",
  },
  {
    key: "manufacturer",
    label: "Fabricante",
    optional: true,
    sortValue: (v) => v.manufacturer ?? "",
  },
  {
    key: "model",
    label: "Modelo",
    optional: true,
    sortValue: (v) => v.model ?? "",
  },
  {
    key: "inMaintenance",
    label: "Em Manutenção",
    optional: true,
    sortValue: (v) => (v.inMaintenance ? 1 : 0),
  },
  {
    key: "position",
    label: "Última Posição",
    sortValue: (v) => v.lastCommunicationAt ?? "",
  },
  {
    key: "signalDelayMinutes",
    label: "Atraso",
    optional: true,
    sortValue: (v) => v.signalDelayMinutes ?? -1,
  },
  {
    key: "observation",
    label: "Obs",
    optional: true,
    compare: (a, b) =>
      specialFirstCompare(
        a.lastObservationText,
        b.lastObservationText
      ),
  },
];

const OPTIONAL_COLUMNS = ALL_COLUMNS.filter(
  (c) => c.optional
);

const DEFAULT_VISIBLE_COLUMNS = {
  status: true,
  batteryLevel: true,
  signalDelayMinutes: true,
  observation: true,
  operator: true,
  manufacturer: false,
  model: false,
  inMaintenance: false,
};

const DEFAULT_COLUMN_ORDER = ALL_COLUMNS.map((c) => c.key);

function loadStoredColumns() {

  try {

    const saved = JSON.parse(
      localStorage.getItem(COLUMN_STORAGE_KEY) || "null"
    );

    return saved || DEFAULT_VISIBLE_COLUMNS;

  } catch {

    return DEFAULT_VISIBLE_COLUMNS;

  }

}

function loadStoredWidths() {

  try {

    return JSON.parse(
      localStorage.getItem(COLUMN_WIDTHS_STORAGE_KEY) || "{}"
    );

  } catch {

    return {};

  }

}

function loadStoredOrder() {

  try {

    const saved = JSON.parse(
      localStorage.getItem(COLUMN_ORDER_STORAGE_KEY) || "null"
    );

    if (!Array.isArray(saved) || saved.length === 0) {
      return DEFAULT_COLUMN_ORDER;
    }

    const known = new Set(DEFAULT_COLUMN_ORDER);

    const filtered = saved.filter((key) => known.has(key));

    const missing = DEFAULT_COLUMN_ORDER.filter(
      (key) => !filtered.includes(key)
    );

    return [...filtered, ...missing];

  } catch {

    return DEFAULT_COLUMN_ORDER;

  }

}

function buildColumnPreferencePayload(order, visibility, widths) {

  return JSON.stringify({
    columns: order.map((key) => {

      const column = ALL_COLUMNS.find((c) => c.key === key);

      return {
        key,
        visible: column?.optional ? !!visibility[key] : true,
        width: widths[key] ?? null,
      };

    }),
  });

}

function applyColumnPreference(raw) {

  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed?.columns)) {
    return null;
  }

  const known = new Set(DEFAULT_COLUMN_ORDER);

  const savedOrder = parsed.columns
    .map((c) => c.key)
    .filter((key) => known.has(key));

  const missing = DEFAULT_COLUMN_ORDER.filter(
    (key) => !savedOrder.includes(key)
  );

  const order = [...savedOrder, ...missing];

  const visibility = { ...DEFAULT_VISIBLE_COLUMNS };

  const widths = {};

  parsed.columns.forEach((c) => {

    if (!known.has(c.key)) {
      return;
    }

    if (c.visible != null) {
      visibility[c.key] = c.visible;
    }

    if (c.width != null) {
      widths[c.key] = c.width;
    }

  });

  return { order, visibility, widths };

}

export default function Grid() {

  const {

    vehicles,

    loading,

    loadGrid,

    lastLoadedAt,

  } = useGridStore();

  const [refreshing, setRefreshing] =
    useState(false);

  const [observationModalPlate, setObservationModalPlate] =
    useState(null);

  const observationModalVehicle = vehicles.find(
    (v) => v.plate === observationModalPlate
  );

  const [columnFilters, setColumnFilters] =
    useState({
      plate: "",
      insuredName: "",
      platform: "",
      status: "",
      operator: "",
      observation: "",
    });

  const [visibleColumns, setVisibleColumns] =
    useState(loadStoredColumns);

  const [columnOrder, setColumnOrder] =
    useState(loadStoredOrder);

  const [columnMenuOpen, setColumnMenuOpen] =
    useState(false);

  const [columnSettingsOpen, setColumnSettingsOpen] =
    useState(false);

  const [preferencesLoaded, setPreferencesLoaded] =
    useState(false);

  const [sortConfig, setSortConfig] =
    useState({ key: null, direction: null });

  const columnMenuRef = useRef(null);

  const [columnWidths, setColumnWidths] =
    useState(loadStoredWidths);

  const resizingRef = useRef(null);

  const preferenceSaveTimeoutRef = useRef(null);

  useEffect(() => {

    async function loadColumnPreferences() {

      try {

        const raw = await getPreference(
          GRID_COLUMNS_PREFERENCE_KEY
        );

        const applied = raw ? applyColumnPreference(raw) : null;

        if (applied) {

          setColumnOrder(applied.order);

          setVisibleColumns(applied.visibility);

          setColumnWidths(applied.widths);

        }

      } catch (error) {

        console.error(error);

      } finally {

        setPreferencesLoaded(true);

      }

    }

    loadColumnPreferences();

  }, []);

  useEffect(() => {

    localStorage.setItem(
      COLUMN_WIDTHS_STORAGE_KEY,
      JSON.stringify(columnWidths)
    );

  }, [columnWidths]);

  useEffect(() => {

    localStorage.setItem(
      COLUMN_ORDER_STORAGE_KEY,
      JSON.stringify(columnOrder)
    );

  }, [columnOrder]);

  // Salva no banco com debounce de 1s para não disparar uma
  // requisição a cada pixel arrastado durante o resize de coluna.
  useEffect(() => {

    if (!preferencesLoaded) {
      return;
    }

    if (preferenceSaveTimeoutRef.current) {
      clearTimeout(preferenceSaveTimeoutRef.current);
    }

    preferenceSaveTimeoutRef.current = setTimeout(() => {

      savePreference(
        GRID_COLUMNS_PREFERENCE_KEY,
        buildColumnPreferencePayload(
          columnOrder,
          visibleColumns,
          columnWidths
        )
      ).catch((error) => console.error(error));

    }, PREFERENCE_SAVE_DEBOUNCE_MS);

    return () => clearTimeout(preferenceSaveTimeoutRef.current);

  }, [columnOrder, visibleColumns, columnWidths, preferencesLoaded]);

  function handleResizeMove(e) {

    const resizing = resizingRef.current;

    if (!resizing) {
      return;
    }

    const delta = e.clientX - resizing.startX;

    const newWidth = Math.max(
      MIN_COLUMN_WIDTH,
      resizing.startWidth + delta
    );

    setColumnWidths((current) => ({
      ...current,
      [resizing.key]: newWidth,
    }));

  }

  function handleResizeEnd() {

    resizingRef.current = null;

    document.removeEventListener(
      "mousemove",
      handleResizeMove
    );

    document.removeEventListener(
      "mouseup",
      handleResizeEnd
    );

  }

  function handleResizeStart(e, key) {

    e.preventDefault();

    e.stopPropagation();

    const th = e.currentTarget.closest("th");

    const startWidth =
      columnWidths[key] ?? th.offsetWidth;

    resizingRef.current = {
      key,
      startX: e.clientX,
      startWidth,
    };

    document.addEventListener(
      "mousemove",
      handleResizeMove
    );

    document.addEventListener(
      "mouseup",
      handleResizeEnd
    );

  }

  useEffect(() => {

    localStorage.setItem(
      COLUMN_STORAGE_KEY,
      JSON.stringify(visibleColumns)
    );

  }, [visibleColumns]);

  useEffect(() => {

    function handleClickOutside(e) {

      if (
        columnMenuRef.current &&
        !columnMenuRef.current.contains(e.target)
      ) {

        setColumnMenuOpen(false);

      }

    }

    document.addEventListener("mousedown", handleClickOutside);

    return () =>
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );

  }, []);

  function toggleColumn(key) {

    setVisibleColumns((current) => ({
      ...current,
      [key]: !current[key],
    }));

  }

  function handleColumnSettingsSave({ order, visibility, widths }) {

    setColumnOrder(order);

    setVisibleColumns(visibility);

    setColumnWidths(widths);

    setColumnSettingsOpen(false);

    if (preferenceSaveTimeoutRef.current) {
      clearTimeout(preferenceSaveTimeoutRef.current);
    }

    savePreference(
      GRID_COLUMNS_PREFERENCE_KEY,
      buildColumnPreferencePayload(order, visibility, widths)
    )
      .then(() => toast.success("Preferências de colunas salvas"))
      .catch((error) => {
        console.error(error);
        toast.error("Erro ao salvar preferências de colunas");
      });

  }

  const columnsByKey = useMemo(
    () =>
      Object.fromEntries(
        ALL_COLUMNS.map((col) => [col.key, col])
      ),
    []
  );

  const columns = useMemo(() => {

    return columnOrder
      .map((key) => columnsByKey[key])
      .filter(
        (col) => col && (!col.optional || visibleColumns[col.key])
      );

  }, [visibleColumns, columnOrder, columnsByKey]);

  function setColumnFilter(field, value) {

    setColumnFilters((current) => ({
      ...current,
      [field]: value,
    }));

  }

  const filteredVehicles = useMemo(() => {

    return vehicles.filter((vehicle) => {

      const matchesPlate =
        !columnFilters.plate ||
        vehicle.plate
          ?.toLowerCase()
          .includes(columnFilters.plate.toLowerCase());

      const matchesInsuredName =
        !columnFilters.insuredName ||
        vehicle.insuredName
          ?.toLowerCase()
          .includes(columnFilters.insuredName.toLowerCase());

      const matchesPlatform =
        !columnFilters.platform ||
        vehicle.platform
          ?.toLowerCase()
          .includes(columnFilters.platform.toLowerCase());

      const matchesStatus =
        !columnFilters.status ||
        vehicle.status === columnFilters.status;

      const matchesOperator =
        !columnFilters.operator ||
        vehicle.operator
          ?.toLowerCase()
          .includes(columnFilters.operator.toLowerCase());

      const matchesObservation =
        !columnFilters.observation ||
        vehicle.lastObservationText
          ?.toLowerCase()
          .includes(columnFilters.observation.toLowerCase());

      return (
        matchesPlate &&
        matchesInsuredName &&
        matchesPlatform &&
        matchesStatus &&
        matchesOperator &&
        matchesObservation
      );

    });

  }, [vehicles, columnFilters]);

  const sortedVehicles = useMemo(() => {

    if (!sortConfig.key) {
      return filteredVehicles;
    }

    const column = ALL_COLUMNS.find(
      (c) => c.key === sortConfig.key
    );

    if (!column?.sortValue && !column?.compare) {
      return filteredVehicles;
    }

    return [...filteredVehicles].sort((a, b) => {

      const cmp = column.compare
        ? column.compare(a, b)
        : (() => {
            const aVal = column.sortValue(a);
            const bVal = column.sortValue(b);

            return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
          })();

      return sortConfig.direction === "asc" ? cmp : -cmp;

    });

  }, [filteredVehicles, sortConfig]);

  function handleSort(key) {

    setSortConfig((prev) =>
      prev.key === key && prev.direction === "desc"
        ? { key: null, direction: null }
        : {
            key,
            direction: prev.key === key ? "desc" : "asc",
          }
    );

  }

  useEffect(() => {

    // Só recarrega da API se o cache estiver vazio ou tiver mais de
    // 30 minutos — navegar entre páginas e voltar para o Grid não
    // deve disparar uma nova requisição.
    useGridStore.getState().loadGridIfStale();

  }, []);

  async function loadOperationalGrid() {

    try {

      await loadGrid();

    } catch (error) {

      console.error(error);

    }

  }

  async function handleRefreshFromEtl() {

    setRefreshing(true);

    try {

      await triggerImport("MULTIPORTAL_OPERATIONAL");

      toast.success("Posições atualizadas com sucesso");

      await loadOperationalGrid();

    } catch (error) {

      console.error(error);

      toast.error(
        "Falha ao atualizar — verifique se o ETL está rodando"
      );

    } finally {

      setRefreshing(false);

    }

  }

  function renderSortIcon(col) {

    if (col.sortable === false || (!col.sortValue && !col.compare)) {
      return null;
    }

    if (sortConfig.key !== col.key) {
      return (
        <ArrowUpDown
          size={12}
          className="text-zinc-600"
        />
      );
    }

    return sortConfig.direction === "asc" ? (
      <ArrowUp size={12} />
    ) : (
      <ArrowDown size={12} />
    );

  }

  function renderCell(col, vehicle) {

    switch (col.key) {

      case "status":
        return (
          <StatusBadge status={vehicle.status} />
        );

      case "plate":
        return (
          <Link
            to={`/vehicles/${vehicle.plate}`}
            className="transition hover:text-white"
          >
            {vehicle.plate}
          </Link>
        );

      case "insuredName":
        return vehicle.insuredName || "--";

      case "platform":
        return <PlatformBadge platform={vehicle.platform} />;

      case "batteryLevel":
        return vehicle.batteryLevel != null
          ? `${vehicle.batteryLevel}%`
          : "--";

      case "activeDevice":
        return vehicle.activeDevice || "--";

      case "lineNumber":
        return vehicle.lineNumber || "--";

      case "operator":
        return vehicle.operator || "--";

      case "manufacturer":
        return vehicle.manufacturer || "--";

      case "model":
        return vehicle.model || "--";

      case "inMaintenance":
        return vehicle.inMaintenance ? "Sim" : "Não";

      case "position":
        return formatLocalDateTime(vehicle.lastCommunicationAt);

      case "signalDelayMinutes":
        return (
          <span
            title={
              vehicle.signalDelayMinutes != null
                ? `${vehicle.signalDelayMinutes} min`
                : undefined
            }
          >
            {formatDelay(vehicle.signalDelayMinutes)}
          </span>
        );

      case "observation":
        return (
          <button
            onClick={() => setObservationModalPlate(vehicle.plate)}
            title={vehicle.lastObservationText || "Adicionar observação"}
            className="
              max-w-[200px] truncate text-left
              text-zinc-400 transition hover:text-white
            "
          >
            {vehicle.lastObservationText || "+ Observação"}
          </button>
        );

      default:
        return null;

    }

  }

  function renderFilterCell(col) {

    if (col.key === "status") {
      return (
        <select
          value={columnFilters.status}
          onChange={(e) =>
            setColumnFilter("status", e.target.value)
          }
          className="
            w-full rounded-lg border border-zinc-800
            bg-zinc-900 px-2 py-1.5 text-xs
            outline-none
          "
        >
          <option value="">Todos</option>
          <option value="ONLINE">ONLINE</option>
          <option value="OFFLINE">OFFLINE</option>
          <option value="STALE">STALE</option>
          <option value="LOW_BATTERY">LOW_BATTERY</option>
          <option value="MAINTENANCE">MAINTENANCE</option>
        </select>
      );
    }

    if (
      col.key === "plate" ||
      col.key === "insuredName" ||
      col.key === "platform" ||
      col.key === "operator" ||
      col.key === "observation"
    ) {
      return (
        <input
          type="text"
          placeholder="Filtrar..."
          value={columnFilters[col.key]}
          onChange={(e) =>
            setColumnFilter(col.key, e.target.value)
          }
          className="
            w-full rounded-lg border border-zinc-800
            bg-zinc-900 px-2 py-1.5 text-xs
            outline-none placeholder:text-zinc-600
          "
        />
      );
    }

    return null;

  }

  return (
    <div className="space-y-6">

      <div
        className="
          flex flex-col items-start
          justify-between gap-4
          rounded-2xl border
          border-zinc-800
          bg-zinc-900 p-4
          lg:flex-row lg:items-center
        "
      >

        <div className="flex items-center gap-6">

          <div>

            <p className="text-xs text-zinc-500">
              TOTAL
            </p>

            <p className="text-lg font-semibold">
              {vehicles.length}
            </p>

          </div>

          <div>

            <p className="text-xs text-zinc-500">
              ÚLTIMA ATUALIZAÇÃO
            </p>

            <p className="text-lg font-semibold">
              {lastLoadedAt
                ? new Date(lastLoadedAt).toLocaleTimeString()
                : "--"}
            </p>

          </div>

        </div>

        <div className="flex items-center gap-3">

          <div
            ref={columnMenuRef}
            className="relative"
          >

            <button
              onClick={() =>
                setColumnMenuOpen((open) => !open)
              }
              className="
                flex items-center gap-2
                rounded-2xl border
                border-zinc-700
                bg-zinc-950 px-5 py-3
                text-sm font-semibold
                transition
                hover:bg-zinc-800
              "
            >
              <Columns3 size={16} />
              Colunas
            </button>

            {columnMenuOpen && (

              <div
                className="
                  absolute right-0 top-full z-30
                  mt-2 w-56 rounded-2xl
                  border border-zinc-800
                  bg-zinc-950 p-3
                  shadow-xl
                "
              >

                {OPTIONAL_COLUMNS.map((col) => (

                  <label
                    key={col.key}
                    className="
                      flex items-center gap-2
                      rounded-lg px-2 py-2
                      text-sm
                      transition hover:bg-zinc-900
                    "
                  >

                    <input
                      type="checkbox"
                      checked={!!visibleColumns[col.key]}
                      onChange={() => toggleColumn(col.key)}
                      className="rounded border-zinc-700"
                    />

                    {col.label}

                  </label>

                ))}

              </div>

            )}

          </div>

          <button
            onClick={() => setColumnSettingsOpen(true)}
            className="
              flex items-center gap-2
              rounded-2xl border
              border-zinc-700
              bg-zinc-950 px-5 py-3
              text-sm font-semibold
              transition
              hover:bg-zinc-800
            "
          >
            <Settings size={16} />
            Configurar colunas
          </button>

          <button
            onClick={handleRefreshFromEtl}
            disabled={refreshing}
            className="
              flex items-center gap-2
              rounded-2xl border
              border-zinc-700
              bg-zinc-950 px-5 py-3
              text-sm font-semibold
              transition
              hover:bg-zinc-800
              disabled:opacity-50
            "
          >
            <RefreshCw
              size={16}
              className={refreshing ? "animate-spin" : ""}
            />
            {refreshing ? "Atualizando..." : "Atualizar agora"}
          </button>

        </div>

      </div>

      <div
        className="
          overflow-hidden rounded-2xl
          border border-zinc-800
          bg-zinc-900
        "
      >

        <div className="overflow-x-auto">

          <table className="min-w-full">

            <thead
              className="
                sticky top-0 z-10
                bg-zinc-950
              "
            >

              <tr className="text-left text-sm text-zinc-400">

                {columns.map((col) => (

                  <th
                    key={col.key}
                    onClick={() =>
                      col.sortable !== false &&
                      (col.sortValue || col.compare) &&
                      handleSort(col.key)
                    }
                    style={
                      columnWidths[col.key]
                        ? {
                            width: columnWidths[col.key],
                            minWidth: columnWidths[col.key],
                            maxWidth: columnWidths[col.key],
                          }
                        : undefined
                    }
                    className={`
                      relative px-4 py-4
                      ${col.sticky ? "sticky left-0 z-20 bg-zinc-950" : ""}
                      ${col.sortable !== false && (col.sortValue || col.compare) ? "cursor-pointer select-none hover:text-white" : ""}
                    `}
                  >

                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {renderSortIcon(col)}
                    </span>

                    <span
                      onMouseDown={(e) =>
                        handleResizeStart(e, col.key)
                      }
                      onClick={(e) => e.stopPropagation()}
                      className="
                        absolute right-0 top-0 z-10
                        h-full w-1.5 cursor-col-resize
                        select-none
                        hover:bg-zinc-700
                      "
                    />

                  </th>

                ))}

              </tr>

              <tr className="border-t border-zinc-800 bg-zinc-950/60 text-xs">

                {columns.map((col) => (

                  <th
                    key={col.key}
                    style={
                      columnWidths[col.key]
                        ? {
                            width: columnWidths[col.key],
                            minWidth: columnWidths[col.key],
                            maxWidth: columnWidths[col.key],
                          }
                        : undefined
                    }
                    className={`
                      px-4 py-2
                      ${col.sticky ? "sticky left-0 z-20 bg-zinc-950/60" : ""}
                    `}
                  >
                    {renderFilterCell(col)}
                  </th>

                ))}

              </tr>

            </thead>

            <tbody>

              {loading ? (

                <tr>

                  <td
                    colSpan={columns.length}
                    className="
                      px-6 py-10 text-center
                      text-zinc-500
                    "
                  >
                    Carregando grid operacional...
                  </td>

                </tr>

              ) : sortedVehicles.length === 0 ? (

                <tr>

                  <td
                    colSpan={columns.length}
                    className="
                      px-6 py-10 text-center
                      text-zinc-500
                    "
                  >
                    Nenhum veículo encontrado
                  </td>

                </tr>

              ) : (

                sortedVehicles.map((vehicle) => (

                  <tr
                    key={vehicle.plate}
                    className={`
                      border-t border-zinc-800
                      transition
                      ${rowStyles[vehicle.status]}
                    `}
                  >

                    {columns.map((col) => (

                      <td
                        key={col.key}
                        style={
                          columnWidths[col.key]
                            ? {
                                width: columnWidths[col.key],
                                minWidth: columnWidths[col.key],
                                maxWidth: columnWidths[col.key],
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }
                            : undefined
                        }
                        className={`
                          px-4 py-4
                          ${col.sticky ? "sticky left-0 bg-zinc-900 font-mono font-semibold" : ""}
                        `}
                      >
                        {renderCell(col, vehicle)}
                      </td>

                    ))}

                  </tr>

                ))

              )}

            </tbody>

          </table>

        </div>

      </div>

      {columnSettingsOpen && (

        <ColumnSettingsModal
          allColumns={ALL_COLUMNS}
          order={columnOrder}
          visibility={visibleColumns}
          widths={columnWidths}
          defaultOrder={DEFAULT_COLUMN_ORDER}
          defaultVisibility={DEFAULT_VISIBLE_COLUMNS}
          onClose={() => setColumnSettingsOpen(false)}
          onSave={handleColumnSettingsSave}
        />

      )}

      {observationModalPlate && (

        <ObservationModal
          plate={observationModalPlate}
          lastObservation={
            observationModalVehicle?.lastObservationText
              ? { text: observationModalVehicle.lastObservationText }
              : null
          }
          onClose={() => setObservationModalPlate(null)}
          onSaved={loadOperationalGrid}
        />

      )}

    </div>
  );
}
