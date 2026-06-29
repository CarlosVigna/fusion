import { useEffect, useState } from "react";

import { Link } from "react-router-dom";

import toast from "react-hot-toast";

import {
  getActiveSignalReturnAlerts,
  markSignalReturnAlertAsBaixa,
} from "../../../services/signalReturnAlertService";

import { formatDelay } from "../../../utils/formatDelay";

import { formatLocalDateTime } from "../../../utils/dateUtils";

export default function LettersReturnedPanel({ onChanged }) {

  const [alerts, setAlerts] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [processingId, setProcessingId] =
    useState(null);

  async function load() {

    setLoading(true);

    try {

      const data = await getActiveSignalReturnAlerts();

      setAlerts(data);

    } catch (error) {

      console.error(error);

      toast.error("Erro ao carregar retornos de sinal");

    } finally {

      setLoading(false);

    }

  }

  useEffect(() => {

    load();

  }, []);

  async function handleBaixa(id) {

    setProcessingId(id);

    try {

      await markSignalReturnAlertAsBaixa(id);

      toast.success("Baixa dada na carta");

      await load();

      onChanged?.();

    } catch (error) {

      console.error(error);

      toast.error("Erro ao dar baixa");

    } finally {

      setProcessingId(null);

    }

  }

  if (loading) {
    return (
      <p className="py-10 text-center text-zinc-500">
        Carregando...
      </p>
    );
  }

  if (alerts.length === 0) {
    return (
      <p className="py-10 text-center text-zinc-500">
        Nenhuma carta com sinal retornado
      </p>
    );
  }

  return (
    <div className="max-h-[28rem] space-y-3 overflow-y-auto">

      {alerts.map((alert) => (

        <div
          key={alert.id}
          className="
            rounded-2xl border border-zinc-800
            bg-zinc-900 p-4
          "
        >

          <div className="flex flex-wrap items-start justify-between gap-3">

            <div>

              <p className="font-mono font-semibold">
                🟢{" "}
                <Link
                  to={`/vehicles/${alert.vehiclePlate}`}
                  className="transition hover:text-white"
                >
                  {alert.vehiclePlate}
                </Link>
                {alert.insuredName && ` — ${alert.insuredName}`}
              </p>

              <p className="mt-1 text-sm text-zinc-400">
                Sinal retornou em{" "}
                {formatLocalDateTime(alert.detectedAt)}{" "}
                após {formatDelay(alert.previousDelayMinutes)}{" "}
                de ausência
              </p>

              {alert.lastObservationText && (
                <p className="mt-1 text-xs text-zinc-500">
                  Última obs: {alert.lastObservationText}
                  {alert.lastObservationBy &&
                    ` — por ${alert.lastObservationBy}`}
                </p>
              )}

            </div>

            <button
              onClick={() => handleBaixa(alert.id)}
              disabled={processingId === alert.id}
              className="
                rounded-xl bg-white px-4 py-2
                text-xs font-semibold text-black
                transition hover:opacity-90
                disabled:opacity-50
              "
            >
              Dar baixa
            </button>

          </div>

        </div>

      ))}

    </div>
  );
}
