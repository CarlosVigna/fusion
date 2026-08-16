import { useEffect, useState } from "react";

import toast from "react-hot-toast";

import { ShieldAlert } from "lucide-react";

import { dismissPolicyAlert, getPolicyAlerts } from "../services/policyService";

const TABS = [
    { key: "expired",    label: "Vencidas",   color: "text-red-400",    dot: "bg-red-500",    match: (a) => a.alertType === "EXPIRED" },
    { key: "expiring",   label: "Vencendo",   color: "text-yellow-400", dot: "bg-yellow-500", match: (a) => a.alertType?.startsWith("EXPIRING") },
    { key: "cancelled",  label: "Canceladas", color: "text-orange-400", dot: "bg-orange-500", match: (a) => a.alertType === "CANCELLED" },
    { key: "closed",     label: "Encerradas", color: "text-zinc-400",   dot: "bg-zinc-500",   match: (a) => a.alertType === "CLOSED" || a.alertType === "TERMINATED" },
];

function formatDate(raw) {
    if (!raw) return "—";
    return new Date(raw + "T00:00:00").toLocaleDateString("pt-BR");
}

function badgeClass(a) {
    if (a.alertType === "EXPIRED")          return "bg-red-500/15 text-red-400";
    if (a.alertType === "EXPIRING_TODAY")   return "bg-orange-500/15 text-orange-400";
    if (a.alertType === "EXPIRING_THIS_WEEK") return "bg-yellow-500/15 text-yellow-400";
    if (a.alertType?.startsWith("EXPIRING")) return "bg-yellow-500/10 text-yellow-300";
    if (a.alertType === "CANCELLED")        return "bg-orange-500/15 text-orange-400";
    if (a.alertType === "CLOSED" || a.alertType === "TERMINATED") return "bg-zinc-800 text-zinc-400";
    return "bg-zinc-800 text-zinc-400";
}

function badgeLabel(a) {
    if (a.alertType === "EXPIRED")            return "Vencida";
    if (a.alertType === "EXPIRING_TODAY")     return "Vence hoje";
    if (a.alertType === "EXPIRING_THIS_WEEK") return "Esta semana";
    if (a.alertType?.startsWith("EXPIRING"))  return a.daysRemaining != null ? `${a.daysRemaining}d` : "Vencendo";
    if (a.alertType === "CANCELLED")          return "Cancelada";
    if (a.alertType === "CLOSED" || a.alertType === "TERMINATED") return "Encerrada";
    return a.alertType ?? "—";
}

function AlertsTable({ alerts, dismissingId, onDismiss }) {
    if (alerts.length === 0) {
        return (
            <p className="py-10 text-center text-zinc-500">
                Nenhum alerta nesta categoria
            </p>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                        <th className="pb-2 pr-4 font-medium">Placa</th>
                        <th className="pb-2 pr-4 font-medium">Segurado</th>
                        <th className="pb-2 pr-4 font-medium">Fim Vigência</th>
                        <th className="pb-2 pr-4 font-medium">Status</th>
                        <th className="pb-2 font-medium" />
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                    {alerts.map((pa) => (
                        <tr key={pa.id}>
                            <td className="py-2 pr-4 font-mono font-semibold">{pa.plate}</td>
                            <td className="py-2 pr-4 text-zinc-400">{pa.insuredName || "—"}</td>
                            <td className="py-2 pr-4 text-zinc-400">{formatDate(pa.endDate)}</td>
                            <td className="py-2 pr-4">
                                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass(pa)}`}>
                                    {badgeLabel(pa)}
                                </span>
                            </td>
                            <td className="py-2 text-right">
                                <button
                                    onClick={() => onDismiss(pa.id)}
                                    disabled={dismissingId === pa.id}
                                    className="rounded-lg bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-40"
                                >
                                    Dispensar
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function PolicyAlerts() {
    const [alerts, setAlerts]         = useState([]);
    const [loading, setLoading]       = useState(true);
    const [dismissingId, setDismissingId] = useState(null);
    const [activeTab, setActiveTab]   = useState("expired");

    useEffect(() => {
        getPolicyAlerts()
            .then(data => setAlerts(Array.isArray(data) ? data : []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    async function handleDismiss(id) {
        setDismissingId(id);
        try {
            await dismissPolicyAlert(id);
            setAlerts(curr => curr.filter(a => a.id !== id));
            toast.success("Alerta dispensado");
        } catch (err) {
            console.error(err);
            toast.error("Erro ao dispensar alerta");
        } finally {
            setDismissingId(null);
        }
    }

    const tabCounts = TABS.reduce((acc, tab) => {
        acc[tab.key] = alerts.filter(tab.match).length;
        return acc;
    }, {});

    const visibleAlerts = alerts.filter(
        TABS.find(t => t.key === activeTab)?.match ?? (() => true)
    );

    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

            <div className="mb-6 flex items-center gap-2">
                <ShieldAlert size={18} className="text-zinc-400" />
                <h1 className="text-xl font-semibold">Alertas de Apólices</h1>
                {!loading && (
                    <span className="ml-auto rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-300">
                        {alerts.length} total
                    </span>
                )}
            </div>

            {/* Abas */}
            <div className="mb-6 flex gap-1 rounded-2xl border border-zinc-800 bg-zinc-950 p-1">
                {TABS.map((tab) => {
                    const count = tabCounts[tab.key] ?? 0;
                    const isActive = activeTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`
                                flex flex-1 items-center justify-center gap-2
                                rounded-xl px-3 py-2.5 text-sm font-medium
                                transition-all
                                ${isActive
                                    ? "bg-zinc-800 text-white shadow"
                                    : "text-zinc-500 hover:text-zinc-300"
                                }
                            `}
                        >
                            <span className={`h-2 w-2 rounded-full ${tab.dot}`} />
                            {tab.label}
                            {count > 0 && (
                                <span className={`
                                    rounded-full px-1.5 py-0.5 text-xs font-bold
                                    ${isActive ? "bg-zinc-700 text-white" : "bg-zinc-800 text-zinc-400"}
                                `}>
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {loading ? (
                <p className="py-10 text-center text-zinc-500">Carregando...</p>
            ) : (
                <AlertsTable
                    alerts={visibleAlerts}
                    dismissingId={dismissingId}
                    onDismiss={handleDismiss}
                />
            )}

        </div>
    );
}
