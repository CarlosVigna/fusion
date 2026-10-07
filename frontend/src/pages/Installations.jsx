import { useEffect, useMemo, useState } from "react";

import toast from "react-hot-toast";

import { RefreshCw } from "lucide-react";

import { getInstallationsByPortalStatus } from "../services/installationService";

import { formatLocalDateTime } from "../utils/dateUtils";

const TABS = [
  { key: "AGUARDANDO_AGENDAMENTO", label: "Aguardando Agendamento" },
  { key: "AGENDADO_AGUARDANDO_ATIVACAO", label: "Agendado" },
  { key: "AGUARDANDO_INSTALACAO", label: "Aguardando Instalação" },
  { key: "INSTALACAO_ENVIADA", label: "Instalação Enviada" },
  { key: "INSTALACAO_EM_ANALISE", label: "Em Análise" },
  { key: "INSTALACAO_CONCLUIDA_SUCESSO", label: "Concluído" },
  { key: "INSTALACAO_CONCLUIDA_FALHA", label: "Falha" },
  { key: "PENDENTE_INSTALACAO", label: "Pendente" },
];

const SLA_STYLE = {
  green: { badge: "bg-green-500/15 text-green-400", dot: "bg-green-500" },
  yellow: { badge: "bg-yellow-500/15 text-yellow-400", dot: "bg-yellow-500" },
  red: { badge: "bg-red-500/15 text-red-400", dot: "bg-red-500" },
};

const SLA_FALLBACK = { badge: "bg-zinc-700/40 text-zinc-400", dot: "bg-zinc-500" };

function formatPrazo(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export default function Installations() {
  const [tab, setTab] = useState(TABS[0].key);
  const [groups, setGroups] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await getInstallationsByPortalStatus();
      setGroups(data && typeof data === "object" ? data : {});
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar instalações do portal");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [tab]);

  const items = useMemo(() => {
    const list = groups[tab]?.items ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter((i) =>
      (i.customerName ?? "").toLowerCase().includes(term) ||
      (i.plate ?? "").toLowerCase().includes(term)
    );
  }, [groups, tab, search]);

  return (
    <div className="space-y-6">

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const total = groups[t.key]?.total ?? 0;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                  active ? "bg-white text-black" : "border border-zinc-700 bg-zinc-950 text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                {t.label}
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  active ? "bg-black/10 text-black" : "bg-zinc-800 text-zinc-300"
                }`}>
                  {total}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={load}
          className="flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
        >
          <RefreshCw size={14} />
          Atualizar
        </button>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por segurado ou placa..."
        className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-500 sm:max-w-sm"
      />

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b border-zinc-800 bg-zinc-950">
              <tr className="text-left text-xs text-zinc-500">
                <th className="px-4 py-3">Segurado</th>
                <th className="px-4 py-3">Placa</th>
                <th className="px-4 py-3">Modelo/Ano</th>
                <th className="px-4 py-3">Proposta</th>
                <th className="px-4 py-3">Técnico</th>
                <th className="px-4 py-3">Prazo</th>
                <th className="px-4 py-3">Atualizado em</th>
                <th className="px-4 py-3">SLA</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-10 text-center text-zinc-500">Carregando...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-zinc-500">Nenhuma instalação neste status</td></tr>
              ) : (
                items.map((i) => {
                  const sla = SLA_STYLE[i.slaCor] ?? SLA_FALLBACK;
                  return (
                    <tr key={i.id} className="border-t border-zinc-800 transition hover:bg-zinc-800/40">
                      <td className="px-4 py-3 font-medium">{i.customerName || "—"}</td>
                      <td className="px-4 py-3 font-mono text-sm text-zinc-300">{i.plate || "—"}</td>
                      <td className="px-4 py-3 text-sm text-zinc-400">{i.model || "—"}</td>
                      <td className="px-4 py-3 font-mono text-sm text-zinc-400">{i.numeroProposta ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-zinc-400">{i.portalTecnico || "—"}</td>
                      <td className="px-4 py-3 text-sm text-zinc-400">{formatPrazo(i.prazoConclusao)}</td>
                      <td className="px-4 py-3 text-sm text-zinc-400">{formatLocalDateTime(i.dataAtualizacao)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${sla.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${sla.dot}`} />
                          {i.slaLabel || "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
