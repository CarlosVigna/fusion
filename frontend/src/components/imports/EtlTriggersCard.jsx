import { useState } from "react";

import { RefreshCw } from "lucide-react";

import toast from "react-hot-toast";

import { triggerImport } from "../../services/importStatusService";

const TRIGGERS = [
  {
    type: "MULTIPORTAL_OPERATIONAL",
    label: "Atualizar Posicionamento",
    description: "Sincroniza posições e status operacional dos veículos",
  },
  {
    type: "MULTIPORTAL_DEVICE",
    label: "Atualizar Dispositivos",
    description: "Sincroniza cadastro de dispositivos Multiportal",
  },
  {
    type: "MULTIPORTAL_LINKAGE",
    label: "Atualizar Vínculos",
    description: "Sincroniza vínculos dispositivo-veículo Multiportal",
  },
  {
    type: "TRACKNME",
    label: "Atualizar TracknMe",
    description: "Sincroniza dispositivos TracknMe",
  },
];

export default function EtlTriggersCard() {
  const [loading, setLoading] = useState({});

  async function handleTrigger(type, label) {
    setLoading((prev) => ({ ...prev, [type]: true }));
    try {
      await triggerImport(type);
      toast.success(`${label}: atualização solicitada ao ETL`);
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
        {TRIGGERS.map(({ type, label, description }) => (
          <button
            key={type}
            onClick={() => handleTrigger(type, label)}
            disabled={loading[type]}
            title={description}
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
              className={loading[type] ? "animate-spin" : ""}
            />
            {loading[type] ? "Solicitando..." : label}
          </button>
        ))}
      </div>
    </div>
  );
}
