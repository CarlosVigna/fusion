import { useState } from "react";

import { useNavigate } from "react-router-dom";

import { RefreshCw } from "lucide-react";

import toast from "react-hot-toast";

import { triggerImport } from "../../services/importStatusService";

import EtlProgressPanel from "./EtlProgressPanel";

// reportType = tipo que o script de fato usa no heartbeat (ver
// fusion-etl/index*.js) — MULTIPORTAL_OPERATIONAL (o trigger) e
// MULTIPORTAL_ULTIMA_POSICAO (quem reporta) sao nomes diferentes pro
// mesmo job, quirk ja conhecido do buildRunners() do triggerPoller.js.
const TRIGGERS = [
  {
    type: "MULTIPORTAL_OPERATIONAL",
    reportType: "MULTIPORTAL_ULTIMA_POSICAO",
    label: "Atualizar Posicionamento",
    description: "Sincroniza posições e status operacional dos veículos",
    gridPath: "/grid",
  },
  {
    type: "MULTIPORTAL_DEVICE",
    reportType: "MULTIPORTAL_DEVICE",
    label: "Atualizar Dispositivos",
    description: "Sincroniza cadastro de dispositivos Multiportal",
    gridPath: "/grid",
  },
  {
    type: "MULTIPORTAL_LINKAGE",
    reportType: "MULTIPORTAL_LINKAGE",
    label: "Atualizar Vínculos",
    description: "Sincroniza vínculos dispositivo-veículo Multiportal",
    gridPath: "/grid",
  },
  {
    type: "TRACKNME",
    reportType: "TRACKNME",
    label: "Atualizar TracknMe",
    description: "Sincroniza dispositivos TracknMe",
    gridPath: "/tracknme/grid",
  },
];

export default function EtlTriggersCard() {
  const [loading, setLoading] = useState({});
  const [activeTrigger, setActiveTrigger] = useState(null);
  const navigate = useNavigate();

  async function handleTrigger(trigger) {
    const { type, label } = trigger;
    setLoading((prev) => ({ ...prev, [type]: true }));
    try {
      await triggerImport(type);
      toast.success(`${label}: atualização solicitada ao ETL`);
      setActiveTrigger(trigger);
    } catch (error) {
      console.error(error);
      toast.error(`Erro ao solicitar ${label.toLowerCase()}`);
    } finally {
      setLoading((prev) => ({ ...prev, [type]: false }));
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div>
        <h2 className="text-xl font-semibold">Forçar Atualização via ETL</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Solicita ao ETL local que processe e envie os dados imediatamente
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {TRIGGERS.map((trigger) => (
          <button
            key={trigger.type}
            onClick={() => handleTrigger(trigger)}
            disabled={loading[trigger.type]}
            title={trigger.description}
            className="
              flex items-center gap-2
              rounded-2xl border border-zinc-700
              bg-zinc-950 px-5 py-3
              text-sm font-semibold
              transition hover:bg-zinc-800
              disabled:opacity-50
            "
          >
            <RefreshCw
              size={14}
              className={loading[trigger.type] ? "animate-spin" : ""}
            />
            {loading[trigger.type] ? "Solicitando..." : trigger.label}
          </button>
        ))}
      </div>

      {activeTrigger && (
        <EtlProgressPanel
          type={activeTrigger.reportType}
          onReloadGrid={() => navigate(activeTrigger.gridPath)}
          onRetry={() => handleTrigger(activeTrigger)}
        />
      )}
    </div>
  );
}
