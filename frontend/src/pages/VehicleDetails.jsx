import { useEffect, useMemo, useState } from "react";

import { Link, useParams } from "react-router-dom";

import toast from "react-hot-toast";

import {
  Battery,
  Check,
  Mail,
  Pencil,
  Printer,
  Radio,
  Wrench,
} from "lucide-react";

import PlatformBadge from "../components/ui/PlatformBadge";

import StatusBadge from "../components/ui/StatusBadge";

import ObservationModal from "../components/observations/ObservationModal";

import {
  getVehicleDetail,
} from "../services/vehicleService";

import {
  checkObservation,
  getObservationHistory,
} from "../services/observationService";

import { formatDelay } from "../utils/formatDelay";

import {
  formatLocalDate,
  formatLocalDateTime,
} from "../utils/dateUtils";

function InfoRow({ label, value }) {

  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className="text-right font-medium text-zinc-100">
        {value ?? "--"}
      </span>
    </div>
  );
}

function SectionCard({ icon: Icon, title, children }) {

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">

      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-300">
        {Icon && <Icon size={16} className="text-zinc-500" />}
        {title}
      </div>

      <div className="divide-y divide-zinc-800/60">
        {children}
      </div>

    </div>
  );
}

function buildTimeline(detail, observationHistory) {

  const events = [];

  observationHistory.forEach((obs) => {

    events.push({
      date: obs.createdAt,
      label: `Observação: ${obs.text}`,
      detail: obs.createdBy,
    });

    if (obs.checkedOff && obs.checkedAt) {
      events.push({
        date: obs.checkedAt,
        label: "Observação conferida",
        detail: obs.checkedBy,
      });
    }

  });

  (detail.letterHistory || []).forEach((letter) => {

    events.push({
      date: letter.dataEnvio,
      label: "Carta de suspensão enviada",
      detail: letter.operador,
      dateOnly: true,
    });

    if (letter.dataRetornoSinal && letter.dataRetornoSinal !== "Sem retorno.") {
      events.push({
        date: letter.dataRetornoSinal,
        label: `Sinal retornou / baixa dada (${letter.dataRetornoSinal})`,
        detail: null,
        skipDateFormat: true,
      });
    }

  });

  (detail.maintenanceHistory || []).forEach((maintenance) => {

    events.push({
      date: maintenance.data,
      label: "Manutenção aberta",
      detail: maintenance.operador,
      dateOnly: true,
    });

    if (maintenance.dataEncerramento) {
      events.push({
        date: maintenance.dataEncerramento,
        label: "Manutenção encerrada",
        detail: null,
        dateOnly: true,
      });
    }

  });

  return events
    .filter((event) => event.date)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

}

export default function VehicleDetails() {

  const { plate } = useParams();

  const [detail, setDetail] =
    useState(null);

  const [observationHistory, setObservationHistory] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [modalOpen, setModalOpen] =
    useState(false);

  const [checkingId, setCheckingId] =
    useState(null);

  async function load() {

    setLoading(true);

    try {

      const [detailData, historyData] = await Promise.all([
        getVehicleDetail(plate),
        getObservationHistory(plate),
      ]);

      setDetail(detailData);

      setObservationHistory(historyData);

    } catch (error) {

      console.error(error);

      toast.error("Erro ao carregar veículo");

    } finally {

      setLoading(false);

    }

  }

  useEffect(() => {

    load();

  }, [plate]);

  const timeline = useMemo(() => {

    if (!detail) {
      return [];
    }

    return buildTimeline(detail, observationHistory);

  }, [detail, observationHistory]);

  async function handleCheck(id) {

    setCheckingId(id);

    try {

      await checkObservation(id);

      toast.success("Observação conferida");

      await load();

    } catch (error) {

      console.error(error);

      toast.error("Erro ao conferir observação");

    } finally {

      setCheckingId(null);

    }

  }

  if (loading) {
    return (
      <div className="p-6 text-zinc-500">
        Carregando veículo...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-6 text-zinc-500">
        Veículo não encontrado
      </div>
    );
  }

  const lastObservation = observationHistory[0];

  return (
    <div className="space-y-6 print:text-black">

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 print:border-zinc-300">

        <div className="flex flex-wrap items-start justify-between gap-4">

          <div>

            <h1 className="font-mono text-4xl font-bold">
              {detail.plate}
            </h1>

            <p className="mt-2 text-zinc-400">
              {detail.insuredName || "Segurado não informado"}
            </p>

          </div>

          <div className="flex items-center gap-3 print:hidden">

            <button
              onClick={() => setModalOpen(true)}
              className="
                flex items-center gap-2
                rounded-2xl border border-zinc-700
                bg-zinc-950 px-4 py-2.5
                text-sm font-semibold
                transition hover:bg-zinc-800
              "
            >
              <Pencil size={14} />
              Observação
            </button>

            <button
              onClick={() => window.print()}
              className="
                flex items-center gap-2
                rounded-2xl border border-zinc-700
                bg-zinc-950 px-4 py-2.5
                text-sm font-semibold
                transition hover:bg-zinc-800
              "
            >
              <Printer size={14} />
              Imprimir
            </button>

            <StatusBadge status={detail.status} />

          </div>

        </div>

      </div>

      <div className="grid gap-4 lg:grid-cols-3">

        <SectionCard title="Dados gerais">
          <InfoRow
            label="Plataforma"
            value={<PlatformBadge platform={detail.platform} />}
          />
          <InfoRow label="Parceria" value={detail.partnership} />
          <InfoRow label="Apólice" value={detail.policy} />
          <InfoRow label="Corretora" value={detail.broker} />
        </SectionCard>

        <SectionCard icon={Radio} title="Comunicação">
          <InfoRow
            label="Status"
            value={detail.online ? "Online" : "Offline"}
          />
          <InfoRow
            label="Última comunicação"
            value={formatLocalDateTime(detail.lastCommunicationAt)}
          />
          <InfoRow
            label="Atraso"
            value={formatDelay(detail.signalDelayMinutes)}
          />
          <InfoRow
            label="Atualização desatualizada"
            value={detail.staleUpdate ? "Sim" : "Não"}
          />
        </SectionCard>

        <SectionCard icon={Battery} title="Dispositivo">
          <InfoRow label="Dispositivo" value={detail.activeDevice} />
          <InfoRow label="IMEI" value={detail.imei} />
          <InfoRow label="Fabricante" value={detail.manufacturer} />
          <InfoRow label="Modelo" value={detail.model} />
          <InfoRow label="Linha" value={detail.lineNumber} />
          <InfoRow label="Operadora" value={detail.operator} />
          <InfoRow
            label="Bateria"
            value={
              detail.batteryLevel != null
                ? `${detail.batteryLevel}%${detail.lowBattery ? " (baixa)" : ""}`
                : null
            }
          />
        </SectionCard>

      </div>

      {(detail.activeLetter || detail.activeMaintenance) && (

        <div className="grid gap-4 lg:grid-cols-2">

          {detail.activeLetter && (
            <Link to="/letters">
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 transition hover:bg-red-500/15">
                <div className="flex items-center gap-2 text-sm font-semibold text-red-400">
                  <Mail size={16} />
                  Carta de suspensão ativa
                </div>
                <p className="mt-2 text-sm text-zinc-300">
                  Enviada em {formatLocalDate(detail.activeLetter.dataEnvio)}
                  {detail.activeLetter.fimVigencia &&
                    ` — vigência até ${formatLocalDate(detail.activeLetter.fimVigencia)}`}
                </p>
              </div>
            </Link>
          )}

          {detail.activeMaintenance && (
            <Link to="/maintenance">
              <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-5 transition hover:bg-blue-500/15">
                <div className="flex items-center gap-2 text-sm font-semibold text-blue-400">
                  <Wrench size={16} />
                  Manutenção em aberto
                </div>
                <p className="mt-2 text-sm text-zinc-300">
                  Aberta em {formatLocalDate(detail.activeMaintenance.data)}
                  {detail.activeMaintenance.prazoEncerramento &&
                    ` — prazo ${formatLocalDate(detail.activeMaintenance.prazoEncerramento)}`}
                </p>
              </div>
            </Link>
          )}

        </div>

      )}

      <div className="grid gap-4 lg:grid-cols-2">

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">

          <h2 className="mb-3 text-sm font-semibold text-zinc-300">
            Histórico de observações
          </h2>

          {observationHistory.length === 0 ? (

            <p className="text-sm text-zinc-500">
              Nenhuma observação registrada
            </p>

          ) : (

            <ul className="max-h-96 space-y-3 overflow-y-auto pr-1">

              {observationHistory.map((obs) => (

                <li
                  key={obs.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm"
                >

                  <p>{obs.text}</p>

                  <div className="mt-2 flex items-center justify-between border-t border-zinc-800 pt-2 text-xs text-zinc-500">

                    <span>
                      {obs.createdBy} em {formatLocalDateTime(obs.createdAt)}
                      {obs.checkedOff
                        ? ` · conferido por ${obs.checkedBy} em ${formatLocalDateTime(obs.checkedAt)}`
                        : " · não conferido"}
                    </span>

                    {!obs.checkedOff && (
                      <button
                        onClick={() => handleCheck(obs.id)}
                        disabled={checkingId === obs.id}
                        title="Marcar como conferido"
                        className="
                          shrink-0 rounded-lg border border-zinc-700
                          bg-zinc-900 p-1.5
                          transition hover:bg-zinc-800
                          disabled:opacity-40
                          print:hidden
                        "
                      >
                        <Check size={12} />
                      </button>
                    )}

                  </div>

                </li>

              ))}

            </ul>

          )}

        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">

          <h2 className="mb-3 text-sm font-semibold text-zinc-300">
            Linha do tempo
          </h2>

          {timeline.length === 0 ? (

            <p className="text-sm text-zinc-500">
              Nenhum evento registrado
            </p>

          ) : (

            <ul className="max-h-96 space-y-3 overflow-y-auto pr-1">

              {timeline.map((event, index) => (

                <li
                  key={index}
                  className="border-l-2 border-zinc-700 pl-3"
                >

                  <p className="text-xs text-zinc-500">
                    {event.skipDateFormat
                      ? event.date
                      : event.dateOnly
                        ? formatLocalDate(event.date)
                        : formatLocalDateTime(event.date)}
                  </p>

                  <p className="text-sm">{event.label}</p>

                  {event.detail && (
                    <p className="text-xs text-zinc-500">{event.detail}</p>
                  )}

                </li>

              ))}

            </ul>

          )}

        </div>

      </div>

      {(detail.letterHistory?.length > 0 || detail.maintenanceHistory?.length > 0) && (

        <div className="grid gap-4 lg:grid-cols-2">

          {detail.letterHistory?.length > 0 && (

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">

              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-300">
                <Mail size={16} className="text-zinc-500" />
                Cartas de suspensão
              </h2>

              <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">

                {detail.letterHistory.map((letter) => (

                  <li
                    key={letter.id}
                    className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm"
                  >

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-zinc-400">
                        Envio: {formatLocalDate(letter.dataEnvio)}
                      </span>
                      <span
                        className={`
                          rounded-full px-2 py-0.5 text-xs font-semibold
                          ${letter.status === "ATIVA"
                            ? "bg-blue-500/15 text-blue-400"
                            : "bg-zinc-700/40 text-zinc-400"}
                        `}
                      >
                        {letter.status || "ATIVA"}
                      </span>
                    </div>

                    {letter.dataRetornoSinal &&
                      letter.dataRetornoSinal !== "Sem retorno." && (
                        <p className="mt-1 text-xs text-zinc-500">
                          Retorno: {letter.dataRetornoSinal}
                        </p>
                    )}

                  </li>

                ))}

              </ul>

            </div>

          )}

          {detail.maintenanceHistory?.length > 0 && (

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">

              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-300">
                <Wrench size={16} className="text-zinc-500" />
                Manutenções
              </h2>

              <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">

                {detail.maintenanceHistory.map((maint) => (

                  <li
                    key={maint.id}
                    className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm"
                  >

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-zinc-400">
                        Data: {formatLocalDate(maint.data)}
                      </span>
                      <span
                        className={`
                          rounded-full px-2 py-0.5 text-xs font-semibold
                          ${maint.status === "ABERTO"
                            ? "bg-blue-500/15 text-blue-400"
                            : "bg-zinc-700/40 text-zinc-400"}
                        `}
                      >
                        {maint.status}
                      </span>
                    </div>

                    {maint.localPosicao && (
                      <p className="mt-1 text-xs text-zinc-500">
                        {maint.localPosicao}
                      </p>
                    )}

                    {maint.prazoEncerramento && (
                      <p className="mt-1 text-xs text-zinc-500">
                        Prazo: {formatLocalDate(maint.prazoEncerramento)}
                      </p>
                    )}

                  </li>

                ))}

              </ul>

            </div>

          )}

        </div>

      )}

      {modalOpen && (

        <ObservationModal
          plate={plate}
          lastObservation={lastObservation}
          onClose={() => setModalOpen(false)}
          onSaved={load}
        />

      )}

    </div>
  );
}
