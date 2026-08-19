import { Fragment, useEffect, useMemo, useState } from "react";

import toast from "react-hot-toast";

import { ChevronDown, ChevronRight, Download, Package, Plus } from "lucide-react";

import { getTechnicians } from "../services/technicianService";

import {
    addToStock,
    downloadStockExcel,
    getAllStock,
    markStockAsReturned,
} from "../services/stockService";

const STATUS_LABEL = {
    EM_ESTOQUE: "Em estoque",
    INSTALADO: "Instalado",
    DEVOLVIDO: "Devolvido",
};

const STATUS_CLASS = {
    EM_ESTOQUE: "bg-blue-500/15 text-blue-400",
    INSTALADO: "bg-green-500/15 text-green-400",
    DEVOLVIDO: "bg-zinc-700/40 text-zinc-400",
};

function formatDate(raw) {
    if (!raw) return "—";
    return new Date(raw + "T00:00:00").toLocaleDateString("pt-BR");
}

const isValidImei = (v) => /^\d{15}$/.test(v);
const isValidMsisdn = (v) => /^55\d{11}$/.test(v);

function AddStockModal({ technicians, defaultTechnicianId, onClose, onSaved }) {

    const [technicianId, setTechnicianId] = useState(defaultTechnicianId || "");
    const [imei, setImei] = useState("");
    const [chipLine, setChipLine] = useState("");
    const [model, setModel] = useState("");
    const [receivedAt, setReceivedAt] = useState("");
    const [sentAt, setSentAt] = useState("");
    const [saving, setSaving] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();

        if (!technicianId || !imei) {
            toast.error("Técnico e IMEI são obrigatórios");
            return;
        }
        if (!isValidImei(imei)) {
            toast.error("IMEI deve ter 15 dígitos numéricos");
            return;
        }
        if (chipLine && !isValidMsisdn(chipLine)) {
            toast.error("Linha deve ter 13 dígitos começando com 55");
            return;
        }

        setSaving(true);
        try {
            await addToStock(technicianId, {
                imei,
                chipLine: chipLine || null,
                model: model || null,
                receivedAt: receivedAt || null,
                sentAt: sentAt || null,
            });
            toast.success("Equipamento adicionado ao estoque");
            onSaved();
        } catch (err) {
            console.error(err);
            toast.error(err.message || "Erro ao adicionar equipamento");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <form
                onSubmit={handleSubmit}
                className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
            >
                <h3 className="text-lg font-semibold">Adicionar Equipamento</h3>

                <div className="mt-4 space-y-3">
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-zinc-500">Técnico</label>
                        <select
                            value={technicianId}
                            onChange={(e) => setTechnicianId(e.target.value)}
                            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none"
                        >
                            <option value="">— Selecionar —</option>
                            {technicians.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-semibold text-zinc-500">IMEI</label>
                        <input
                            type="text"
                            value={imei}
                            onChange={(e) => setImei(e.target.value)}
                            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-zinc-500">Linha do chip</label>
                            <input
                                type="text"
                                value={chipLine}
                                onChange={(e) => setChipLine(e.target.value)}
                                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-zinc-500">Modelo</label>
                            <input
                                type="text"
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-zinc-500">Data recebimento</label>
                            <input
                                type="date"
                                value={receivedAt}
                                onChange={(e) => setReceivedAt(e.target.value)}
                                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-zinc-500">Data envio</label>
                            <input
                                type="date"
                                value={sentAt}
                                onChange={(e) => setSentAt(e.target.value)}
                                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none"
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex-1 rounded-xl bg-white py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-40"
                    >
                        {saving ? "Salvando..." : "Salvar"}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default function TechnicianStock() {

    const [technicians, setTechnicians] = useState([]);
    const [stock, setStock] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState({});
    const [modalOpen, setModalOpen] = useState(false);
    const [exporting, setExporting] = useState(false);

    const [filterTechnician, setFilterTechnician] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
    const [filterFrom, setFilterFrom] = useState("");
    const [filterTo, setFilterTo] = useState("");

    async function load() {
        try {
            const [techs, stockData] = await Promise.all([
                getTechnicians(),
                getAllStock(),
            ]);
            setTechnicians(Array.isArray(techs) ? techs : []);
            setStock(Array.isArray(stockData) ? stockData : []);
        } catch (err) {
            console.error(err);
            toast.error("Erro ao carregar estoque");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    const filteredStock = useMemo(() => {
        return stock.filter((s) => {
            if (filterTechnician && String(s.technicianId) !== String(filterTechnician)) return false;
            if (filterStatus && s.status !== filterStatus) return false;
            if (filterFrom && (!s.receivedAt || s.receivedAt < filterFrom)) return false;
            if (filterTo && (!s.receivedAt || s.receivedAt > filterTo)) return false;
            return true;
        });
    }, [stock, filterTechnician, filterStatus, filterFrom, filterTo]);

    const byTechnician = useMemo(() => {
        const map = new Map();
        for (const s of filteredStock) {
            const key = s.technicianId || "sem-tecnico";
            if (!map.has(key)) {
                map.set(key, { technicianId: s.technicianId, technicianName: s.technicianName || "—", items: [] });
            }
            map.get(key).items.push(s);
        }
        return [...map.values()].sort((a, b) => a.technicianName.localeCompare(b.technicianName));
    }, [filteredStock]);

    function toggleExpand(key) {
        setExpanded((cur) => ({ ...cur, [key]: !cur[key] }));
    }

    async function handleReturn(stockId) {
        try {
            await markStockAsReturned(stockId);
            toast.success("Equipamento marcado como devolvido");
            load();
        } catch (err) {
            console.error(err);
            toast.error("Erro ao marcar como devolvido");
        }
    }

    async function handleExport() {
        setExporting(true);
        try {
            await downloadStockExcel();
        } catch (err) {
            console.error(err);
            toast.error("Erro ao exportar Excel");
        } finally {
            setExporting(false);
        }
    }

    return (
        <div className="space-y-6">

            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">

                <div className="flex items-center gap-2">
                    <Package size={18} className="text-zinc-400" />
                    <h1 className="text-lg font-semibold">Estoque de Equipamentos</h1>
                </div>

                <div className="ml-auto flex flex-wrap items-center gap-2">

                    <select
                        value={filterTechnician}
                        onChange={(e) => setFilterTechnician(e.target.value)}
                        className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs outline-none"
                    >
                        <option value="">Todos os técnicos</option>
                        {technicians.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>

                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs outline-none"
                    >
                        <option value="">Todos os status</option>
                        <option value="EM_ESTOQUE">Em estoque</option>
                        <option value="INSTALADO">Instalado</option>
                        <option value="DEVOLVIDO">Devolvido</option>
                    </select>

                    <input
                        type="date"
                        value={filterFrom}
                        onChange={(e) => setFilterFrom(e.target.value)}
                        title="Recebido a partir de"
                        className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs outline-none"
                    />
                    <input
                        type="date"
                        value={filterTo}
                        onChange={(e) => setFilterTo(e.target.value)}
                        title="Recebido até"
                        className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs outline-none"
                    />

                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-xs font-semibold transition hover:bg-zinc-800 disabled:opacity-40"
                    >
                        <Download size={14} />
                        {exporting ? "Gerando..." : "Exportar Excel"}
                    </button>

                    <button
                        onClick={() => setModalOpen(true)}
                        className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black transition hover:bg-zinc-200"
                    >
                        <Plus size={14} />
                        Adicionar Equipamento
                    </button>

                </div>

            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">

                {loading ? (
                    <p className="py-10 text-center text-zinc-500">Carregando...</p>
                ) : byTechnician.length === 0 ? (
                    <p className="py-10 text-center text-zinc-500">Nenhum equipamento no estoque</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-950 text-xs text-zinc-400">
                            <tr>
                                <th className="px-4 py-3 text-left" />
                                <th className="px-4 py-3 text-left">Técnico</th>
                                <th className="px-4 py-3 text-left">Equipamentos</th>
                                <th className="px-4 py-3 text-left">Em estoque</th>
                            </tr>
                        </thead>
                        <tbody>
                            {byTechnician.map((group) => {
                                const key = group.technicianId || "sem-tecnico";
                                const isOpen = !!expanded[key];
                                const emEstoque = group.items.filter((i) => i.status === "EM_ESTOQUE").length;
                                return (
                                    <Fragment key={key}>
                                        <tr
                                            className="cursor-pointer border-t border-zinc-800 hover:bg-zinc-800/40"
                                            onClick={() => toggleExpand(key)}
                                        >
                                            <td className="px-4 py-3">
                                                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            </td>
                                            <td className="px-4 py-3 font-semibold">{group.technicianName}</td>
                                            <td className="px-4 py-3 text-zinc-400">{group.items.length}</td>
                                            <td className="px-4 py-3 text-blue-400">{emEstoque}</td>
                                        </tr>
                                        {isOpen && (
                                            <tr className="border-t border-zinc-800 bg-zinc-950/40">
                                                <td colSpan={4} className="px-4 py-3">
                                                    <table className="w-full text-xs">
                                                        <thead className="text-zinc-500">
                                                            <tr>
                                                                <th className="pb-2 pr-4 text-left">IMEI</th>
                                                                <th className="pb-2 pr-4 text-left">Linha</th>
                                                                <th className="pb-2 pr-4 text-left">Modelo</th>
                                                                <th className="pb-2 pr-4 text-left">Recebido</th>
                                                                <th className="pb-2 pr-4 text-left">Enviado</th>
                                                                <th className="pb-2 pr-4 text-left">Status</th>
                                                                <th className="pb-2 pr-4 text-left">Placa instalada</th>
                                                                <th className="pb-2 text-left" />
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-zinc-800">
                                                            {group.items.map((item) => (
                                                                <tr key={item.id}>
                                                                    <td className="py-2 pr-4 font-mono">{item.imei}</td>
                                                                    <td className="py-2 pr-4">{item.chipLine || "—"}</td>
                                                                    <td className="py-2 pr-4">{item.model || "—"}</td>
                                                                    <td className="py-2 pr-4">{formatDate(item.receivedAt)}</td>
                                                                    <td className="py-2 pr-4">{formatDate(item.sentAt)}</td>
                                                                    <td className="py-2 pr-4">
                                                                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[item.status] || ""}`}>
                                                                            {STATUS_LABEL[item.status] || item.status}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-2 pr-4 font-mono">{item.installedPlate || "—"}</td>
                                                                    <td className="py-2">
                                                                        {item.status === "EM_ESTOQUE" && (
                                                                            <button
                                                                                onClick={() => handleReturn(item.id)}
                                                                                className="rounded-lg bg-zinc-800 px-2 py-1 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-700"
                                                                            >
                                                                                Marcar devolvido
                                                                            </button>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                )}

            </div>

            {modalOpen && (
                <AddStockModal
                    technicians={technicians}
                    onClose={() => setModalOpen(false)}
                    onSaved={() => { setModalOpen(false); load(); }}
                />
            )}

        </div>
    );
}
