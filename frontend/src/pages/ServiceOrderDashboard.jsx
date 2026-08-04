import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle, Clock, DollarSign, Hourglass, TrendingUp } from "lucide-react";
import { getServiceOrderDashboard } from "../services/serviceOrderService";

const CARDS = [
  { key: "open",                         label: "Ordens Abertas",              icon: Clock,         color: "blue",   filter: "ABERTO"    },
  { key: "ongoing",                      label: "Em Andamento",                icon: Hourglass,     color: "yellow", filter: "AGENDADO"  },
  { key: "late",                         label: "Atrasadas",                   icon: AlertTriangle, color: "red",    filter: "LATE"      },
  { key: "pendingFinancialApproval",     label: "Pendentes de Aprovação",      icon: DollarSign,    color: "orange", filter: "PEND_FIN"  },
  { key: "pendingCompletionConfirmation",label: "Pendentes de Confirmar",      icon: CheckCircle,   color: "teal",   filter: "PEND_CONF" },
  { key: "avgSlaDays",                   label: "SLA Médio (dias)",            icon: TrendingUp,    color: "zinc",   filter: null        },
];

const colorClass = {
  blue:   "border-blue-500/30 bg-blue-500/10 text-blue-400",
  yellow: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
  red:    "border-red-500/30 bg-red-500/10 text-red-400",
  orange: "border-orange-500/30 bg-orange-500/10 text-orange-400",
  teal:   "border-teal-500/30 bg-teal-500/10 text-teal-400",
  zinc:   "border-zinc-700 bg-zinc-900 text-zinc-300",
};

export default function ServiceOrderDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getServiceOrderDashboard()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function handleCardClick(filter) {
    if (!filter) return;
    navigate(`/service-orders?filter=${filter}`);
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard — Ordens de Serviço</h1>
        <p className="text-zinc-400 mt-1">Visão geral das ordens de serviço ativas</p>
      </div>

      {loading ? (
        <p className="text-zinc-500">Carregando...</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {CARDS.map((card) => {
            const Icon = card.icon;
            const value = data?.[card.key] ?? 0;
            return (
              <button
                key={card.key}
                onClick={() => handleCardClick(card.filter)}
                disabled={!card.filter}
                className={`
                  flex flex-col gap-3 rounded-2xl border p-5 text-left transition
                  ${colorClass[card.color]}
                  ${card.filter ? "cursor-pointer hover:brightness-110" : "cursor-default"}
                `}
              >
                <Icon size={20} className="opacity-80" />
                <div>
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-xs opacity-70 mt-0.5">{card.label}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
