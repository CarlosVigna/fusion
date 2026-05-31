import { useEffect, useState } from "react";

import { Link } from "react-router-dom";

import { realtimeService } from "../services/realtime/realtimeService";

import { useGridStore } from "../store/gridStore";

import StatusBadge from "../components/ui/StatusBadge";
import PlatformBadge from "../components/ui/PlatformBadge";
import OperationalFlags from "../components/ui/OperationalFlags";

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

export default function Grid() {

  const {

    vehicles,

    loading,

    loadGrid,

    prependRealtimeEvent,

  } = useGridStore();

  const [plate, setPlate] =
    useState("");

  const [status, setStatus] =
    useState("");

  const [lastUpdate, setLastUpdate] =
    useState(null);

  useEffect(() => {

    loadOperationalGrid();

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

          loadOperationalGrid();

        }
      );

    return () => {

      unsubscribe();

    };

  }, [status]);

  async function loadOperationalGrid(
    customPlate
  ) {

    try {

      await loadGrid({

        plate:
          customPlate ?? plate,

        status,

      });

      setLastUpdate(
        new Date().toLocaleTimeString()
      );

    } catch (error) {

      console.error(error);

    }

  }

  function handleSearch(e) {

    e.preventDefault();

    loadOperationalGrid(plate);

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
              {lastUpdate || "--"}
            </p>

          </div>

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

                <th className="px-4 py-4">
                  Status
                </th>

                <th className="px-4 py-4">
                  Indicadores
                </th>

                <th
                  className="
                    sticky left-0 z-20
                    bg-zinc-950 px-4 py-4
                  "
                >
                  Placa
                </th>

                <th className="px-4 py-4">
                  Segurado
                </th>

                <th className="px-4 py-4">
                  Plataforma
                </th>

                <th className="px-4 py-4">
                  Bateria
                </th>

                <th className="px-4 py-4">
                  Dispositivo
                </th>

                <th className="px-4 py-4">
                  Linha
                </th>

                <th className="px-4 py-4">
                  Operadora
                </th>

                <th className="px-4 py-4">
                  Realtime
                </th>

              </tr>

            </thead>

            <tbody>

              {loading ? (

                <tr>

                  <td
                    colSpan={10}
                    className="
                      px-6 py-10 text-center
                      text-zinc-500
                    "
                  >
                    Carregando grid operacional...
                  </td>

                </tr>

              ) : vehicles.length === 0 ? (

                <tr>

                  <td
                    colSpan={10}
                    className="
                      px-6 py-10 text-center
                      text-zinc-500
                    "
                  >
                    Nenhum veículo encontrado
                  </td>

                </tr>

              ) : (

                vehicles.map((vehicle) => (

                  <tr
                    key={vehicle.plate}
                    className={`
                      border-t border-zinc-800
                      transition
                      ${rowStyles[vehicle.status]}
                    `}
                  >

                    <td className="px-4 py-4">

                      <StatusBadge
                        status={
                          vehicle.status
                        }
                      />

                    </td>

                    <td className="px-4 py-4">

                      <OperationalFlags
                        vehicle={vehicle}
                      />

                    </td>

                    <td
                      className="
                        sticky left-0
                        bg-zinc-900
                        px-4 py-4
                        font-mono
                        font-semibold
                      "
                    >

                      <Link
                        to={`/vehicles/${vehicle.plate}`}
                        className="
                          transition
                          hover:text-white
                        "
                      >
                        {vehicle.plate}
                      </Link>

                    </td>

                    <td className="px-4 py-4">
                      {vehicle.insuredName}
                    </td>

                    <td className="px-4 py-4">

                      <PlatformBadge
                        platform={
                          vehicle.platform
                        }
                      />

                    </td>

                    <td className="px-4 py-4">
                      {vehicle.batteryLevel}%
                    </td>

                    <td className="px-4 py-4">
                      {vehicle.activeDevice}
                    </td>

                    <td className="px-4 py-4">
                      {vehicle.lineNumber}
                    </td>

                    <td className="px-4 py-4">
                      {vehicle.operator}
                    </td>

                    <td className="px-4 py-4">

                      {vehicle.realtimeEvent && (

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

                      )}

                    </td>

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