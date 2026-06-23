import { Fragment, useEffect, useMemo, useState } from "react";

import { Link } from "react-router-dom";

import toast from "react-hot-toast";

import { Check, Download, Mail, Pencil, Wrench } from "lucide-react";

import {
  getSignalControl,
} from "../services/signalControlService";

import {
  checkObservation,
  getObservationHistory,
} from "../services/observationService";

import { formatDelay } from "../utils/formatDelay";

import {
  exportRowsToXlsx,
  formatDateTimeForExport,
  formatDelayDaysHours,
  todayForFilename,
} from "../utils/exportXlsx";

import SignalStageBadge from "../components/signalcontrol/SignalStageBadge";
import ObservationModal from "../components/observations/ObservationModal";

function formatDateTime(value) {

  if (!value) {
    return "--";
  }

  return new Date(value).toLocaleString("pt-BR");

}

export default function SignalControl() {

  const [vehicles, setVehicles] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [stageFilter, setStageFilter] =
    useState("");

  const [plateFilter, setPlateFilter] =
    useState("");

  const [insuredFilter, setInsuredFilter] =
    useState("");

  const [expandedPlate, setExpandedPlate] =
    useState(null);

  const [history, setHistory] =
    useState({});

  const [modalPlate, setModalPlate] =
    useState(null);

  const modalVehicle = vehicles.find(
    (v) => v.plate === modalPlate
  );

  const [checkingId, setCheckingId] =
    useState(null);

  async function load() {

    setLoading(true);

    try {

      const data = await getSignalControl();

      setVehicles(data);

    } catch (error) {

      console.error(error);

      toast.error("Erro ao carregar Controle de Sinais");

    } finally {

      setLoading(false);

    }

  }

  useEffect(() => {

    load();

  }, []);

  const counters = useMemo(() => {

    const counters = {
      total: vehicles.length,
      awaitingCommand: 0,
      contactInsured: 0,
      pending: 0,
    };

    vehicles.forEach((vehicle) => {

      if (vehicle.suggestedStage === "AWAITING_COMMAND") {
        counters.awaitingCommand++;
      } else if (vehicle.suggestedStage === "CONTACT_INSURED") {
        counters.contactInsured++;
      } else if (
        vehicle.suggestedStage === "SUSPENSION_PENDING" ||
        vehicle.suggestedStage === "MAINTENANCE_PENDING"
      ) {
        counters.pending++;
      }

    });

    return counters;

  }, [vehicles]);

  const filteredVehicles = useMemo(() => {

    return vehicles.filter((vehicle) => {

      const matchesStage =
        !stageFilter || vehicle.suggestedStage === stageFilter;

      const matchesPlate =
        !plateFilter ||
        vehicle.plate
          ?.toLowerCase()
          .includes(plateFilter.toLowerCase());

      const matchesInsured =
        !insuredFilter ||
        vehicle.insuredName
          ?.toLowerCase()
          .includes(insuredFilter.toLowerCase());

      return matchesStage && matchesPlate && matchesInsured;

    });

  }, [vehicles, stageFilter, plateFilter, insuredFilter]);

  async function toggleExpand(plate) {

    if (expandedPlate === plate) {

      setExpandedPlate(null);

      return;

    }

    setExpandedPlate(plate);

    if (!history[plate]) {

      try {

        const data = await getObservationHistory(plate);

        setHistory((current) => ({
          ...current,
          [plate]: data,
        }));

      } catch (error) {

        console.error(error);

      }

    }

  }

  async function handleCheck(observationId) {

    setCheckingId(observationId);

    try {

      await checkObservation(observationId);

      toast.success("Marcado como conferido");

      await load();

    } catch (error) {

      console.error(error);

      toast.error("Erro ao marcar como conferido");

    } finally {

      setCheckingId(null);

    }

  }

  function handleExport() {

    const headers = [
      "PLACA",
      "LINHA",
      "ULTIMA ATUALIZAÇÃO",
      "TEMPO ATRASADO",
      "OBS",
    ];

    const rows = filteredVehicles.map((vehicle) => [
      vehicle.plate,
      vehicle.lineNumber || "SEM LINHA",
      formatDateTimeForExport(vehicle.lastCommunicationAt),
      formatDelayDaysHours(vehicle.signalDelayMinutes),
      vehicle.lastObservation?.text || "",
    ]);

    exportRowsToXlsx(
      `SINAIS_${todayForFilename()}.xlsx`,
      headers,
      rows
    );

  }

  function handleObservationSaved(plate) {

    setHistory((current) => {

      const next = { ...current };

      delete next[plate];

      return next;

    });

    load();

  }

  return (
    <div className="space-y-6">

      <div>

        <h1 className="text-3xl font-bold">
          Controle de Sinais
        </h1>

        <p className="mt-1 text-zinc-400">
          Veículos sem comunicação há mais de 24h — fluxo de atendimento
        </p>

      </div>

      <div className="grid gap-4 lg:grid-cols-4">

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-500">TOTAL &gt;24H SEM SINAL</p>
          <h2 className="mt-3 text-4xl font-bold">{counters.total}</h2>
        </div>

        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-6">
          <p className="text-sm text-zinc-400">1-2 DIAS</p>
          <h2 className="mt-3 text-4xl font-bold">{counters.awaitingCommand}</h2>
        </div>

        <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-6">
          <p className="text-sm text-zinc-400">3-4 DIAS</p>
          <h2 className="mt-3 text-4xl font-bold">{counters.contactInsured}</h2>
        </div>

        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6">
          <p className="text-sm text-zinc-400">5+ DIAS</p>
          <h2 className="mt-3 text-4xl font-bold">{counters.pending}</h2>
        </div>

      </div>

      <div
        className="
          flex flex-col gap-4
          rounded-2xl border border-zinc-800
          bg-zinc-900 p-4
          lg:flex-row
        "
      >

        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="
            rounded-xl border border-zinc-800
            bg-zinc-950 px-4 py-2.5 text-sm outline-none
          "
        >
          <option value="">Todas as etapas</option>
          <option value="AWAITING_COMMAND">1-2 dias</option>
          <option value="CONTACT_INSURED">3-4 dias</option>
          <option value="SUSPENSION_PENDING">5+ dias — suspensão</option>
          <option value="MAINTENANCE_PENDING">5+ dias — manutenção</option>
          <option value="SIGNAL_RETURNED">Sinal retornou</option>
        </select>

        <input
          type="text"
          placeholder="Filtrar por placa..."
          value={plateFilter}
          onChange={(e) => setPlateFilter(e.target.value)}
          className="
            flex-1 rounded-xl border border-zinc-800
            bg-zinc-950 px-4 py-2.5 text-sm outline-none
            placeholder:text-zinc-600
          "
        />

        <input
          type="text"
          placeholder="Filtrar por segurado..."
          value={insuredFilter}
          onChange={(e) => setInsuredFilter(e.target.value)}
          className="
            flex-1 rounded-xl border border-zinc-800
            bg-zinc-950 px-4 py-2.5 text-sm outline-none
            placeholder:text-zinc-600
          "
        />

        <button
          onClick={handleExport}
          className="
            flex items-center justify-center gap-2
            rounded-xl border border-zinc-700
            bg-zinc-950 px-5 py-2.5
            text-sm font-semibold
            transition hover:bg-zinc-800
          "
        >
          <Download size={16} />
          Exportar
        </button>

      </div>

      <div
        className="
          overflow-hidden rounded-2xl
          border border-zinc-800 bg-zinc-900
        "
      >

        <div className="overflow-x-auto">

          <table className="min-w-full">

            <thead className="bg-zinc-950">
              <tr className="text-left text-sm text-zinc-400">
                <th className="px-4 py-4">Etapa</th>
                <th className="px-4 py-4">Placa</th>
                <th className="px-4 py-4">Segurado</th>
                <th className="px-4 py-4">Última comunicação</th>
                <th className="px-4 py-4">Atraso</th>
                <th className="px-4 py-4">Última observação</th>
                <th className="px-4 py-4">Conferido</th>
                <th className="px-4 py-4">Ações</th>
              </tr>
            </thead>

            <tbody>

              {loading ? (

                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-zinc-500">
                    Carregando...
                  </td>
                </tr>

              ) : filteredVehicles.length === 0 ? (

                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-zinc-500">
                    Nenhum veículo nessas condições
                  </td>
                </tr>

              ) : (

                filteredVehicles.map((vehicle) => (

                  <Fragment key={vehicle.plate}>

                    <tr
                      onClick={() => toggleExpand(vehicle.plate)}
                      className="
                        cursor-pointer border-t border-zinc-800
                        transition hover:bg-zinc-800
                      "
                    >

                      <td className="px-4 py-4">
                        <SignalStageBadge stage={vehicle.suggestedStage} />
                      </td>

                      <td className="px-4 py-4 font-mono font-semibold">
                        {vehicle.plate}
                      </td>

                      <td className="px-4 py-4">
                        {vehicle.insuredName || "--"}
                      </td>

                      <td className="px-4 py-4 text-zinc-400">
                        {formatDateTime(vehicle.lastCommunicationAt)}
                      </td>

                      <td
                        className="px-4 py-4"
                        title={
                          vehicle.signalDelayMinutes != null
                            ? `${vehicle.signalDelayMinutes} min`
                            : undefined
                        }
                      >
                        {formatDelay(vehicle.signalDelayMinutes)}
                      </td>

                      <td className="max-w-xs truncate px-4 py-4 text-zinc-400">
                        {vehicle.lastObservation?.text || "--"}
                      </td>

                      <td className="px-4 py-4">
                        {vehicle.lastCheck ? (
                          <span
                            title={`${vehicle.lastCheck.checkedBy} em ${formatDateTime(vehicle.lastCheck.checkedAt)}`}
                            className="text-green-400"
                          >
                            <Check size={16} />
                          </span>
                        ) : (
                          "--"
                        )}
                      </td>

                      <td
                        className="px-4 py-4"
                        onClick={(e) => e.stopPropagation()}
                      >

                        <div className="flex gap-2">

                          <button
                            onClick={() => setModalPlate(vehicle.plate)}
                            title="Nova observação"
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
                            title="Marcar conferido"
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

                    {expandedPlate === vehicle.plate && (

                      <tr className="border-t border-zinc-800 bg-zinc-950/40">

                        <td colSpan={8} className="px-6 py-4">

                          {(vehicle.activeLetterId || vehicle.openMaintenanceId) && (

                            <div className="mb-4 flex flex-wrap gap-2">

                              {vehicle.activeLetterId && (
                                <Link
                                  to="/letters"
                                  onClick={(e) => e.stopPropagation()}
                                  className="
                                    flex items-center gap-2
                                    rounded-xl border border-red-500/30
                                    bg-red-500/10 px-3 py-2
                                    text-xs font-semibold text-red-400
                                    transition hover:bg-red-500/20
                                  "
                                >
                                  <Mail size={14} />
                                  Carta de suspensão ativa — ver em Cartas
                                </Link>
                              )}

                              {vehicle.openMaintenanceId && (
                                <Link
                                  to="/maintenance"
                                  onClick={(e) => e.stopPropagation()}
                                  className="
                                    flex items-center gap-2
                                    rounded-xl border border-blue-500/30
                                    bg-blue-500/10 px-3 py-2
                                    text-xs font-semibold text-blue-400
                                    transition hover:bg-blue-500/20
                                  "
                                >
                                  <Wrench size={14} />
                                  Manutenção aberta — ver em Manutenção
                                </Link>
                              )}

                            </div>

                          )}

                          <p className="mb-2 text-xs font-semibold text-zinc-500">
                            HISTÓRICO DE OBSERVAÇÕES
                          </p>

                          {!history[vehicle.plate] ? (

                            <p className="text-sm text-zinc-500">
                              Carregando...
                            </p>

                          ) : history[vehicle.plate].length === 0 ? (

                            <p className="text-sm text-zinc-500">
                              Nenhuma observação registrada
                            </p>

                          ) : (

                            <ul className="space-y-3">

                              {history[vehicle.plate].map((obs) => (

                                <li
                                  key={obs.id}
                                  className="
                                    rounded-xl border border-zinc-700
                                    bg-zinc-900 p-3 text-sm
                                    shadow-sm
                                  "
                                >

                                  <p>{obs.text}</p>

                                  <p className="mt-2 border-t border-zinc-800 pt-2 text-xs text-zinc-500">
                                    {obs.createdBy} em {formatDateTime(obs.createdAt)}
                                    {obs.checkedOff ? (
                                      <>
                                        {" · conferido por "}
                                        {obs.checkedBy}
                                        {" em "}
                                        {formatDateTime(obs.checkedAt)}
                                      </>
                                    ) : (
                                      " · não conferido"
                                    )}
                                  </p>

                                </li>

                              ))}

                            </ul>

                          )}

                        </td>

                      </tr>

                    )}

                  </Fragment>

                ))

              )}

            </tbody>

          </table>

        </div>

      </div>

      {modalPlate && (

        <ObservationModal
          plate={modalPlate}
          lastObservation={modalVehicle?.lastObservation}
          onClose={() => setModalPlate(null)}
          onSaved={() => handleObservationSaved(modalPlate)}
        />

      )}

    </div>
  );
}
