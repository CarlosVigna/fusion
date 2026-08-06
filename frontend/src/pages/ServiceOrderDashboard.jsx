import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Clock, DollarSign, Hourglass, Timer, TrendingUp, Zap } from "lucide-react";
import { getServiceOrderDashboard } from "../services/serviceOrderService";
import { useAuthStore } from "../store/authStore";

const CLICKABLE_CARDS = [
  { key: "abertas",            label: "Abertas",           icon: Clock,         color: "blue",   filter: "ABERTO"   },
  { key: "emAndamento",        label: "Em Andamento",      icon: Hourglass,     color: "yellow", filter: "AGENDADO" },
  { key: "atrasadas",          label: "Atrasadas",         icon: AlertTriangle, color: "red",    filter: "LATE"     },
  { key: "pendentesAprovacao", label: "Pend. Aprovação",   icon: DollarSign,    color: "orange", filter: "PEND_FIN" },
];

const ANALYTICS_CARDS = [
  { key: "slaMediaDias",       label: "SLA Médio (dias)",     icon: TrendingUp, color: "zinc"   },
  { key: "tempoMedioDeila",    label: "Tempo Deila agir (h)", icon: Zap,        color: "purple" },
  { key: "tempoMedioResolucao",label: "Resolução Média (h)",  icon: Timer,      color: "teal"   },
];

const colorClass = {
  blue:   "border-blue-500/30 bg-blue-500/10 text-blue-400",
  yellow: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
  red:    "border-red-500/30 bg-red-500/10 text-red-400",
  orange: "border-orange-500/30 bg-orange-500/10 text-orange-400",
  teal:   "border-teal-500/30 bg-teal-500/10 text-teal-400",
  zinc:   "border-zinc-700 bg-zinc-900 text-zinc-300",
  purple: "border-purple-500/30 bg-purple-500/10 text-purple-400",
};

export default function ServiceOrderDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAnalytics = user?.role === "ADMIN" || user?.role === "OPERATOR";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getServiceOrderDashboard()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard — Ordens de Serviço</h1>
        <p className="text-zinc-400 mt-1">Visão geral das ordens de serviço ativas</p>
      </div>

      {loading ? (
        <p className="text-zinc-500">Carregando...</p>
      ) : (
        <>
          {/* Clickable status cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {CLICKABLE_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.key}
                  onClick={() => navigate(`/service-orders?filter=${card.filter}`)}
                  className={`flex flex-col gap-3 rounded-2xl border p-5 text-left transition cursor-pointer hover:brightness-110 ${colorClass[card.color]}`}
                >
                  <Icon size={20} className="opacity-80" />
                  <div>
                    <p className="text-2xl font-bold">{data?.[card.key] ?? 0}</p>
                    <p className="text-xs opacity-70 mt-0.5">{card.label}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Analytics — only for ADMIN/OPERATOR */}
          {isAnalytics && data?.slaMediaDias != null && (
            <div>
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                Indicadores de Performance
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {ANALYTICS_CARDS.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.key}
                      className={`flex items-center gap-4 rounded-2xl border p-5 ${colorClass[card.color]}`}
                    >
                      <Icon size={22} className="opacity-60 shrink-0" />
                      <div>
                        <p className="text-xl font-bold">{data?.[card.key] ?? 0}</p>
                        <p className="text-xs opacity-60 mt-0.5">{card.label}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
