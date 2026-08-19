import { useEffect, useState } from "react";

import toast from "react-hot-toast";

import { CheckCircle2, X, XCircle } from "lucide-react";

import {
    confirmInstallation,
    getPendingConfirmations,
    ignorePendingConfirmation,
} from "../services/stockService";

function formatDateTime(raw) {
    if (!raw) return "—";
    return new Date(raw).toLocaleString("pt-BR");
}

function todayIso() {
    return new Date().toISOString().slice(0, 10);
}

function ConfirmModal({ item, onClose, onConfirm, onIgnore, busy }) {

    const [installedAt, setInstalledAt] = useState(todayIso());

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-4">

                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Confirmar Instalação</h3>
                    <button onClick={onClose}><X size={18} className="text-zinc-400" /></button>
                </div>

                <div className="space-y-1.5 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm">
                    <div><span className="text-zinc-500">Técnico: </span><span className="font-medium">{item.technicianName || "—"}</span></div>
                    <div><span className="text-zinc-500">IMEI: </span><span className="font-mono">{item.imei || "—"}</span></div>
                    <div><span className="text-zinc-500">Modelo: </span><span className="font-medium">{item.model || "—"}</span></div>
                    <div><span className="text-zinc-500">Linha: </span><span className="font-medium">{item.chipLine || "—"}</span></div>
                    <div><span className="text-zinc-500">Placa detectada: </span><span className="font-mono font-medium">{item.plate || "—"}</span></div>
                </div>

                <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-500">Data da instalação</label>
                    <input
                        type="date"
                        value={installedAt}
                        onChange={(e) => setInstalledAt(e.target.value)}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none"
                    />
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => onIgnore(item)}
                        disabled={busy}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-40"
                    >
                        <XCircle size={14} />
                        Ignorar
                    </button>
                    <button
                        onClick={() => onConfirm(item, installedAt)}
                        disabled={busy}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-40"
                    >
                        <CheckCircle2 size={14} />
                        Confirmar Instalação
                    </button>
                </div>

            </div>
        </div>
    );
}

export default function StockPendingConfirmations() {

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState(null);
    const [reviewItem, setReviewItem] = useState(null);

    async function load() {
        try {
            const data = await getPendingConfirmations();
            setItems(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
            toast.error("Erro ao carregar confirmações pendentes");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    async function handleConfirm(item, installedAt) {
        setBusyId(item.stockId);
        try {
            await confirmInstallation(item.stockId, {
                plate: item.plate,
                installedAt: installedAt || new Date().toISOString().slice(0, 10),
            });
            setItems((cur) => cur.filter((i) => i.id !== item.id));
            setReviewItem(null);
            toast.success("Instalação confirmada");
        } catch (err) {
            console.error(err);
            toast.error(err.message || "Erro ao confirmar instalação");
        } finally {
            setBusyId(null);
        }
    }

    async function handleIgnore(item) {
        setBusyId(item.stockId);
        try {
            await ignorePendingConfirmation(item.id);
            setItems((cur) => cur.filter((i) => i.id !== item.id));
            setReviewItem(null);
            toast.success("Confirmação ignorada");
        } catch (err) {
            console.error(err);
            toast.error(err.message || "Erro ao ignorar confirmação");
        } finally {
            setBusyId(null);
        }
    }

    return (
        <div className="space-y-6">

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

                <div className="mb-6 flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-zinc-400" />
                    <h1 className="text-xl font-semibold">Confirmações Pendentes</h1>
                    {!loading && (
                        <span className="ml-auto rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-300">
                            {items.length}
                        </span>
                    )}
                </div>

                {loading ? (
                    <p className="py-10 text-center text-zinc-500">Carregando...</p>
                ) : items.length === 0 ? (
                    <p className="py-10 text-center text-zinc-500">Nenhuma confirmação pendente</p>
                ) : (
                    <div className="space-y-3">
                        {items.map((item) => (
                            <div
                                key={item.id}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4"
                            >
                                <div>
                                    <p className="font-semibold">
                                        📦 Equipamento do técnico {item.technicianName || "—"} detectado em{" "}
                                        <span className="font-mono text-white">{item.plate}</span>
                                    </p>
                                    <p className="mt-1 text-xs text-zinc-500">
                                        IMEI: <span className="font-mono">{item.imei}</span>
                                        {" — detectado em "}
                                        {formatDateTime(item.detectedAt)}
                                    </p>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleIgnore(item)}
                                        disabled={busyId === item.stockId}
                                        className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-40"
                                    >
                                        <XCircle size={14} />
                                        Ignorar
                                    </button>
                                    <button
                                        onClick={() => setReviewItem(item)}
                                        disabled={busyId === item.stockId}
                                        className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-40"
                                    >
                                        <CheckCircle2 size={14} />
                                        Confirmar Instalação
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

            </div>

            {reviewItem && (
                <ConfirmModal
                    item={reviewItem}
                    onClose={() => setReviewItem(null)}
                    onConfirm={handleConfirm}
                    onIgnore={handleIgnore}
                    busy={busyId === reviewItem.stockId}
                />
            )}

        </div>
    );
}
