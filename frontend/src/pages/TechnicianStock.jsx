import { Fragment, useEffect, useMemo, useState } from "react";

import toast from "react-hot-toast";

import { ChevronDown, ChevronRight, Download, Package, Plus } from "lucide-react";

import { getTechnicians } from "../services/technicianService";

import {
    addToStock,
    checkImei,
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

const IMEI_RE = /^\d{15}$/;
const ICCID_RE = /^\d{20}$/;
const MSISDN_RE = /^55\d{11}$/;

// chipLine e' guardado como digitos puros (validado contra MSISDN_RE) —
// isso so formata pra exibicao "55 (XX) XXXXX-XXXX" enquanto digita.
function formatMsisdn(digits) {
    const d = digits.replace(/\D/g, "").slice(0, 13);
    if (d.length <= 2) return d;
    if (d.length <= 4) return `${d.slice(0, 2)} (${d.slice(2)}`;
    if (d.length <= 9) return `${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4)}`;
    return `${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9, 13)}`;
}

function fieldBorder(touched, valid) {
    if (!touched) return "border-zinc-800";
    return valid ? "border-green-500/60" : "border-red-500/60";
}

function AddStockModal({ technicians, defaultTechnicianId, onClose, onSaved }) {

    const [technicianId, setTechnicianId] = useState(defaultTechnicianId || "");
    const [imei, setImei] = useState("");
    const [iccid, setIccid] = useState("");
    const [chipLine, setChipLine] = useState(""); // dígitos puros — ver formatMsisdn()
    const [model, setModel] = useState("");
    const [receivedAt, setReceivedAt] = useState("");
    const [sentAt, setSentAt] = useState("");
    const [saving, setSaving] = useState(false);
    const [checkingImei, setCheckingImei] = useState(false);
    const [imeiDup, setImeiDup] = useState(null);

    const imeiValid = IMEI_RE.test(imei);
    const iccidValid = ICCID_RE.test(iccid);
    const chipLineValid = !chipLine || MSISDN_RE.test(chipLine);
    const modelValid = model.trim().length >= 2;
    const datesOutOfOrder = receivedAt && sentAt && sentAt < receivedAt;

    async function handleImeiBlur() {
        setImeiDup(null);
        if (!imeiValid) return;
        setCheckingImei(true);
        try {
            const res = await checkImei(imei);
            if (res?.exists) setImeiDup(res);
        } catch (err) {
            console.error(err);
        } finally {
            setCheckingImei(false);
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();

        if (!technicianId) { toast.error("Técnico é obrigatório"); return; }
        if (!imeiValid) { toast.error("IMEI deve ter exatamente 15 dígitos"); return; }
        if (!iccidValid) { toast.error("ICCID deve ter exatamente 20 dígitos"); return; }
        if (!chipLineValid) { toast.error("Linha deve começar com 55 e ter 13 dígitos no total"); return; }
        if (!modelValid) { toast.error("Modelo é obrigatório (mínimo 2 caracteres)"); return; }
        if (!receivedAt) { toast.error("Data de recebimento é obrigatória"); return; }
        if (!sentAt) { toast.error("Data de envio é obrigatória"); return; }
        if (datesOutOfOrder) { toast.error("Data de envio não pode ser anterior à data de recebimento"); return; }
        if (imeiDup?.exists) {
            toast.error(`Este IMEI já está cadastrado no estoque do técnico ${imeiDup.technicianName}`);
            return;
        }

        setSaving(true);
        try {
            await addToStock(technicianId, {
                imei,
                iccid,
                chipLine: chipLine || null,
                model: model.trim(),
                receivedAt,
                sentAt,
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
                className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
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
                        <div className="mb-1 flex items-center justify-between">
                            <label className="block text-xs font-semibold text-zinc-500">IMEI</label>
                            {imei && (
                                <span className={`text-[11px] font-semibold ${imeiValid ? "text-green-400" : "text-red-400"}`}>
                                    {imei.length}/15 dígitos
                                </span>
                            )}
                        </div>
                        <input
                            type="text"
                            inputMode="numeric"
                            value={imei}
                            onChange={(e) => { setImei(e.target.value.replace(/\D/g, "").slice(0, 15)); setImeiDup(null); }}
                            onBlur={handleImeiBlur}
                            className={`w-full rounded-xl border ${fieldBorder(imei, imeiValid)} bg-zinc-950 px-3 py-2 text-sm outline-none`}
                        />
                        {imei && !imeiValid && (
                            <p className="mt-1 text-[11px] text-red-400">IMEI deve ter exatamente 15 dígitos</p>
                        )}
                        {checkingImei && <p className="mt-1 text-[11px] text-zinc-500">Verificando duplicidade...</p>}
                        {imeiDup?.exists && (
                            <p className="mt-1 text-[11px] text-yellow-400">
                                ⚠️ Este IMEI já está cadastrado no estoque do técnico {imeiDup.technicianName}
                            </p>
                        )}
                    </div>

                    <div>
                        <div className="mb-1 flex items-center justify-between">
                            <label className="block text-xs font-semibold text-zinc-500">ICCID / Serial do chip</label>
                            {iccid && (
                                <span className={`text-[11px] font-semibold ${iccidValid ? "text-green-400" : "text-red-400"}`}>
                                    {iccid.length}/20 dígitos
                                </span>
                            )}
                        </div>
                        <input
                            type="text"
                            inputMode="numeric"
                            value={iccid}
                            onChange={(e) => setIccid(e.target.value.replace(/\D/g, "").slice(0, 20))}
                            className={`w-full rounded-xl border ${fieldBorder(iccid, iccidValid)} bg-zinc-950 px-3 py-2 text-sm outline-none`}
                        />
                        {iccid && !iccidValid && (
                            <p className="mt-1 text-[11px] text-red-400">ICCID deve ter exatamente 20 dígitos</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-zinc-500">Linha do chip (opcional)</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                placeholder="55 (XX) XXXXX-XXXX"
                                value={formatMsisdn(chipLine)}
                                onChange={(e) => setChipLine(e.target.value.replace(/\D/g, "").slice(0, 13))}
                                className={`w-full rounded-xl border ${fieldBorder(chipLine, chipLineValid)} bg-zinc-950 px-3 py-2 text-sm outline-none`}
                            />
                            {chipLine && !chipLineValid && (
                                <p className="mt-1 text-[11px] text-red-400">Linha deve começar com 55 e ter 13 dígitos no total</p>
                            )}
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-zinc-500">Modelo</label>
                            <input
                                type="text"
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                className={`w-full rounded-xl border ${fieldBorder(model, modelValid)} bg-zinc-950 px-3 py-2 text-sm outline-none`}
                            />
                            {model && !modelValid && (
                                <p className="mt-1 text-[11px] text-red-400">Mínimo 2 caracteres</p>
                            )}
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
                                className={`w-full rounded-xl border ${datesOutOfOrder ? "border-red-500/60" : "border-zinc-800"} bg-zinc-950 px-3 py-2 text-sm outline-none`}
                            />
                            {datesOutOfOrder && (
                                <p className="mt-1 text-[11px] text-red-400">Não pode ser anterior ao recebimento</p>
                            )}
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
                                                                <th className="pb-2 pr-4 text-left">ICCID</th>
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
                                                                    <td className="py-2 pr-4 font-mono">{item.iccid || "—"}</td>
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
