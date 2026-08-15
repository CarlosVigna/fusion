import { useEffect, useState } from "react";

import toast from "react-hot-toast";

import { ShieldAlert } from "lucide-react";

import { dismissPolicyAlert, getPolicyAlerts } from "../services/policyService";

function AlertsTable({ rows, dismissingId, onDismiss }) {
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
                    {rows.map((pa) => {
                        const isExpired = pa.alertType === "EXPIRED";
                        const isToday   = pa.alertType === "EXPIRING_TODAY";
                        const isWeek    = pa.alertType === "EXPIRING_THIS_WEEK";
                        const dateColor  = isExpired ? "text-red-400" : isToday ? "text-orange-400" : isWeek ? "text-yellow-400" : "text-zinc-400";
                        const badgeClass = isExpired ? "bg-red-500/15 text-red-400" : isToday ? "bg-orange-500/15 text-orange-400" : isWeek ? "bg-yellow-500/15 text-yellow-400" : "bg-zinc-800 text-zinc-400";
                        const badgeLabel = isExpired ? "Vencida" : isToday ? "Vence hoje" : isWeek ? "Esta semana" : `${pa.daysRemaining}d`;
                        return (
                            <tr key={pa.id}>
                                <td className="py-2 pr-4 font-mono font-semibold">{pa.plate}</td>
                                <td className="py-2 pr-4 text-zinc-400">{pa.insuredName || "—"}</td>
                                <td className={`py-2 pr-4 ${dateColor}`}>
                                    {pa.endDate
                                        ? new Date(pa.endDate + "T00:00:00").toLocaleDateString("pt-BR")
                                        : "—"}
                                </td>
                                <td className="py-2 pr-4">
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass}`}>
                                        {badgeLabel}
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
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

export default function PolicyAlerts() {

    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dismissingId, setDismissingId] = useState(null);

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

    const expiringSoon = alerts.filter(pa => pa.alertType !== "EXPIRED");
    const expired       = alerts.filter(pa => pa.alertType === "EXPIRED");

    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

            <div className="mb-4 flex items-center gap-2">
                <ShieldAlert size={18} className="text-zinc-400" />
                <h1 className="text-xl font-semibold">Alertas de Apólices</h1>
                {!loading && (
                    <span className="ml-auto rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-300">
                        {alerts.length}
                    </span>
                )}
            </div>

            {loading ? (
                <p className="py-10 text-center text-zinc-500">Carregando...</p>
            ) : alerts.length === 0 ? (
                <p className="py-10 text-center text-zinc-500">Nenhuma apólice em alerta</p>
            ) : (
                <div className="flex flex-col gap-8">

                    <section>
                        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-300">
                            ⚠️ Vencendo em breve
                            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-400">
                                {expiringSoon.length}
                            </span>
                        </h2>
                        {expiringSoon.length === 0 ? (
                            <p className="py-4 text-sm text-zinc-500">Nenhuma apólice vencendo nos próximos 30 dias</p>
                        ) : (
                            <AlertsTable rows={expiringSoon} dismissingId={dismissingId} onDismiss={handleDismiss} />
                        )}
                    </section>

                    <section>
                        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-300">
                            🔴 Encerradas
                            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-400">
                                {expired.length}
                            </span>
                        </h2>
                        {expired.length === 0 ? (
                            <p className="py-4 text-sm text-zinc-500">Nenhuma apólice encerrada pendente</p>
                        ) : (
                            <AlertsTable rows={expired} dismissingId={dismissingId} onDismiss={handleDismiss} />
                        )}
                    </section>

                </div>
            )}

        </div>
    );
}
