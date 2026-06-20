import { useEffect, useMemo, useRef, useState } from "react";

import { Link } from "react-router-dom";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Columns3,
} from "lucide-react";

import { realtimeService } from "../services/realtime/realtimeService";

import { useGridStore } from "../store/gridStore";

import StatusBadge from "../components/ui/StatusBadge";
import PlatformBadge from "../components/ui/PlatformBadge";
import OperationalFlags from "../components/ui/OperationalFlags";

import SyncStatusPanel from "../components/operational/SyncStatusPanel";

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
    key: "indicators",
    label: "Indicadores",
    sortable: false,
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
    sortValue: (v) =>
      `${v.positionDate ?? ""} ${v.positionTime ?? ""}`,
  },
  {
    key: "signalDelayMinutes",
    label: "Atraso",
    optional: true,
    sortValue: (v) => v.signalDelayMinutes ?? -1,
  },
  {
    key: "realtime",
    label: "Realtime",
    sortable: false,
  },
];

const OPTIONAL_COLUMNS = ALL_COLUMNS.filter(
  (c) => c.optional
);

const DEFAULT_VISIBLE_COLUMNS = {
  status: true,
  batteryLevel: true,
  signalDelayMinutes: true,
  operator: true,
  manufacturer: false,
  model: false,
  inMaintenance: false,
};

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

export default function Grid() {

  const {

    vehicles,

    loading,

    loadGrid,

    lastLoadedAt,

    prependRealtimeEvent,

  } = useGridStore();

  const [plate, setPlate] =
    useState("");

  const [status, setStatus] =
    useState("");

  const [columnFilters, setColumnFilters] =
    useState({
      plate: "",
      insuredName: "",
      status: "",
      operator: "",
    });

  const [visibleColumns, setVisibleColumns] =
    useState(loadStoredColumns);

  const [columnMenuOpen, setColumnMenuOpen] =
    useState(false);

  const [sortConfig, setSortConfig] =
    useState({ key: null, direction: null });

  const columnMenuRef = useRef(null);

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

  const columns = useMemo(() => {

    return ALL_COLUMNS.filter(
      (col) => !col.optional || visibleColumns[col.key]
    );

  }, [visibleColumns]);

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

      const matchesStatus =
        !columnFilters.status ||
        vehicle.status === columnFilters.status;

      const matchesOperator =
        !columnFilters.operator ||
        vehicle.operator
          ?.toLowerCase()
          .includes(columnFilters.operator.toLowerCase());

      return (
        matchesPlate &&
        matchesInsuredName &&
        matchesStatus &&
        matchesOperator
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

    if (!column?.sortValue) {
      return filteredVehicles;
    }

    return [...filteredVehicles].sort((a, b) => {

      const aVal = column.sortValue(a);
      const bVal = column.sortValue(b);

      const cmp =
        aVal < bVal ? -1 : aVal > bVal ? 1 : 0;

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

  const didMountRef = useRef(false);

  useEffect(() => {

    // Primeira montagem: só recarrega da API se o cache estiver vazio
    // ou tiver mais de 30 minutos — navegar entre páginas e voltar
    // para o Grid não deve disparar uma nova requisição.
    // Mudança de filtro (status) depois disso recarrega normalmente.
    if (!didMountRef.current) {

      didMountRef.current = true;

      useGridStore.getState().loadGridIfStale({
        plate,
        status,
      });

      return;

    }

    loadOperationalGrid();

  }, [status]);

  useEffect(() => {

    // Eventos de alerta só atualizam o indicador "LIVE" da linha
    // (client-side, sem custo). O grid em si só recarrega na carga
    // inicial, no clique manual em "Atualizar agora" ou quando um
    // import for concluído (ver painel de sincronização).
    const unsubscribe =
      realtimeService.onDashboardEvent(
        (event) => {

          if (event.message) {

            const parts =
              event.message.split(
                " - "
              );

            const plate =
              parts[0];

            prependRealtimeEvent(
              plate,
              event.type
            );

          }

        }
      );

    return () => {

      unsubscribe();

    };

  }, []);

  async function loadOperationalGrid(
    customPlate
  ) {

    try {

      await loadGrid({

        plate:
          customPlate ?? plate,

        status,

      });

    } catch (error) {

      console.error(error);

    }

  }

  function handleSearch(e) {

    e.preventDefault();

    loadOperationalGrid(plate);

  }

  function renderSortIcon(col) {

    if (col.sortable === false || !col.sortValue) {
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

      case "indicators":
        return <OperationalFlags vehicle={vehicle} />;

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
        return vehicle.positionDate
          ? `${vehicle.positionDate} ${vehicle.positionTime ?? ""}`
          : "--";

      case "signalDelayMinutes":
        return vehicle.signalDelayMinutes != null
          ? `${vehicle.signalDelayMinutes} min`
          : "--";

      case "realtime":
        return (
          vehicle.realtimeEvent && (
            <div
              className="
                inline-flex rounded-full
                bg-green-500/10
                px-2 py-1
                text-[10px]
                font-semibold
                text-green-400
              "
            >
              LIVE
            </div>
          )
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
      col.key === "operator"
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

      <div>

        <h1 className="text-3xl font-bold">
          Grid Operacional
        </h1>

        <p className="mt-1 text-zinc-400">
          Consolidação operacional realtime
        </p>

      </div>

      <form
        onSubmit={handleSearch}
        className="
          flex flex-col gap-4
          rounded-2xl border border-zinc-800
          bg-zinc-900 p-4
          lg:flex-row
        "
      >

        <input
          type="text"
          placeholder="Buscar por placa..."
          value={plate}
          onChange={(e) =>
            setPlate(e.target.value)
          }
          className="
            flex-1 rounded-2xl border
            border-zinc-800 bg-zinc-950
            px-4 py-3 outline-none
          "
        />

        <select
          value={status}
          onChange={(e) =>
            setStatus(e.target.value)
          }
          className="
            rounded-2xl border border-zinc-800
            bg-zinc-950 px-4 py-3 outline-none
          "
        >

          <option value="">
            Todos os status
          </option>

          <option value="ONLINE">
            ONLINE
          </option>

          <option value="OFFLINE">
            OFFLINE
          </option>

          <option value="STALE">
            STALE
          </option>

          <option value="LOW_BATTERY">
            LOW_BATTERY
          </option>

          <option value="MAINTENANCE">
            MAINTENANCE
          </option>

        </select>

        <button
          className="
            rounded-2xl bg-white
            px-6 py-3 font-semibold
            text-black transition
            hover:opacity-90
          "
        >
          Buscar
        </button>

      </form>

      <SyncStatusPanel onSynced={loadOperationalGrid} />

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
            onClick={() =>
              loadOperationalGrid()
            }
            className="
              rounded-2xl border
              border-zinc-700
              bg-zinc-950 px-5 py-3
              text-sm font-semibold
              transition
              hover:bg-zinc-800
            "
          >
            Atualizar agora
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
                      col.sortValue &&
                      handleSort(col.key)
                    }
                    className={`
                      px-4 py-4
                      ${col.sticky ? "sticky left-0 z-20 bg-zinc-950" : ""}
                      ${col.sortable !== false && col.sortValue ? "cursor-pointer select-none hover:text-white" : ""}
                    `}
                  >

                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {renderSortIcon(col)}
                    </span>

                  </th>

                ))}

              </tr>

              <tr className="border-t border-zinc-800 bg-zinc-950/60 text-xs">

                {columns.map((col) => (

                  <th
                    key={col.key}
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

    </div>
  );
}
