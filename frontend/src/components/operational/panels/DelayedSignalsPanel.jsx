import { useEffect, useRef, useState } from "react";

import { Link } from "react-router-dom";

import toast from "react-hot-toast";

import { Check, Pencil } from "lucide-react";

import { getSignalControl } from "../../../services/signalControlService";

import { checkObservation } from "../../../services/observationService";

import { formatDelay } from "../../../utils/formatDelay";

import { calculateDelayMinutes, formatLocalDateTime } from "../../../utils/dateUtils";

import ObservationModal from "../../observations/ObservationModal";

export default function DelayedSignalsPanel({ onChanged }) {

  const [vehicles, setVehicles] =
    useState([]);

  const [totalDelayed, setTotalDelayed] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [modalPlate, setModalPlate] =
    useState(null);

  const [checkingId, setCheckingId] =
    useState(null);

  const [, setDelayTick] = useState(0);

  const modalVehicle = vehicles.find(
    (v) => v.plate === modalPlate
  );

  async function load() {

    setLoading(true);

    try {

      const data = await getSignalControl();

      setTotalDelayed(data.length);

      // Fila de trabalho: só os ainda não conferidos por um operador.
      // O total (data.length) é preservado para exibir o contexto completo.
      setVehicles(
        data.filter((v) => !v.lastCheck)
      );

    } catch (error) {

      console.error(error);

      toast.error("Erro ao carregar sinais atrasados");

    } finally {

      setLoading(false);

    }

  }

  useEffect(() => {

    load();

  }, []);

  useEffect(() => {
    const interval = setInterval(
      () => setDelayTick((n) => n + 1),
      60000
    );
    return () => clearInterval(interval);
  }, []);

  async function handleCheck(observationId) {

    setCheckingId(observationId);

    try {

      await checkObservation(observationId);

      toast.success("Marcado como tratado");

      await load();

      onChanged?.();

    } catch (error) {

      console.error(error);

      toast.error("Erro ao marcar como tratado");

    } finally {

      setCheckingId(null);

    }

  }

  function handleObservationSaved() {

    setModalPlate(null);

    load();

    onChanged?.();

  }

  if (loading) {
    return (
      <p className="py-10 text-center text-zinc-500">
        Carregando...
      </p>
    );
  }

  if (vehicles.length === 0) {
    return (
      <p className="py-10 text-center text-zinc-500">
        Nenhum sinal atrasado pendente de tratamento 🎉
      </p>
    );
  }

  return (
    <>

      <p className="mb-3 text-sm text-zinc-500">
        {vehicles.length} pendentes de tratamento
        {totalDelayed > vehicles.length && (
          <> · {totalDelayed} com sinal atrasado no total</>
        )}
      </p>

      <div className="max-h-[28rem] overflow-y-auto rounded-2xl border border-zinc-800">

        <table className="min-w-full">

          <thead className="sticky top-0 bg-zinc-950">
            <tr className="text-left text-sm text-zinc-400">
              <th className="px-4 py-3">Placa</th>
              <th className="px-4 py-3">Segurado</th>
              <th className="px-4 py-3">Última comunicação</th>
              <th className="px-4 py-3">Atraso</th>
              <th className="px-4 py-3">Última observação</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>

          <tbody>

            {vehicles.map((vehicle) => (

              <tr
                key={vehicle.plate}
                className="border-t border-zinc-800 transition hover:bg-zinc-900"
              >

                <td className="px-4 py-3 font-mono font-semibold">
                  <Link
                    to={`/vehicles/${vehicle.plate}`}
                    className="transition hover:text-white"
                  >
                    {vehicle.plate}
                  </Link>
                </td>

                <td className="px-4 py-3">
                  {vehicle.insuredName || "--"}
                </td>

                <td className="px-4 py-3 text-zinc-400">
                  {formatLocalDateTime(vehicle.lastCommunicationAt)}
                </td>

                <td className="px-4 py-3">
                  {formatDelay(calculateDelayMinutes(vehicle.lastCommunicationAt))}
                </td>

                <td className="max-w-xs truncate px-4 py-3 text-zinc-400">
                  {vehicle.lastObservation?.text || "--"}
                </td>

                <td className="px-4 py-3">

                  <div className="flex gap-2">

                    <button
                      onClick={() => setModalPlate(vehicle.plate)}
                      title="Adicionar observação"
                      className="
                        rounded-xl border border-zinc-700
                        bg-zinc-950 p-2
                        transition hover:bg-zinc-800
                      "
                    >
                      <Pencil size={14} />
                    </button>

                    <button
                      onClick={() =>
                        vehicle.lastObservation &&
                        handleCheck(vehicle.lastObservation.id)
                      }
                      disabled={
                        !vehicle.lastObservation ||
                        checkingId === vehicle.lastObservation?.id
                      }
                      title="Marcar como tratado"
                      className="
                        rounded-xl border border-zinc-700
                        bg-zinc-950 p-2
                        transition hover:bg-zinc-800
                        disabled:opacity-40
                      "
                    >
                      <Check size={14} />
                    </button>

                  </div>

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

      {modalPlate && (

        <ObservationModal
          plate={modalPlate}
          lastObservation={modalVehicle?.lastObservation}
          onClose={() => setModalPlate(null)}
          onSaved={handleObservationSaved}
        />

      )}

    </>
  );
}
