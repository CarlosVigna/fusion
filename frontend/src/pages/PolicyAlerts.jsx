import { useEffect, useState } from "react";

import toast from "react-hot-toast";

import { Download, ShieldAlert } from "lucide-react";

import {
    getCancelledPolicies,
    getClosedPolicies,
    getExpiredPolicies,
    getExpiringPolicies,
} from "../services/policyService";

import { todayForFilename } from "../utils/exportXlsx";

const SECTIONS = [
    { key: "expired",   label: "Vencidas",   emoji: "🔴", badgeClass: "bg-red-500/15 text-red-400" },
    { key: "expiring",  label: "Vencendo",   emoji: "🟡", badgeClass: "bg-yellow-500/15 text-yellow-400" },
    { key: "cancelled", label: "Canceladas", emoji: "🟠", badgeClass: "bg-orange-500/15 text-orange-400" },
    { key: "closed",    label: "Encerradas", emoji: "⚫", badgeClass: "bg-zinc-700/40 text-zinc-300" },
];

const STATUS_LABEL = {
    ACTIVE: "Ativa",
    EXPIRING: "Vencendo",
    FUTURE: "Futura",
    EXPIRED: "Vencida",
    CANCELLED: "Cancelada",
    SUPERSEDED: "Substituída",
    CLOSED: "Encerrada",
};

function formatDate(value) {
    if (!value) return "—";
    return new Date(value + "T00:00:00").toLocaleDateString("pt-BR");
}

function PoliciesTable({ rows }) {

    if (rows.length === 0) {
        return <p className="py-4 text-sm text-zinc-500">Nenhuma apólice nesta categoria</p>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                        <th className="pb-2 pr-4 font-medium">Placa</th>
                        <th className="pb-2 pr-4 font-medium">Segurado</th>
                        <th className="pb-2 pr-4 font-medium">Nº Apólice</th>
                        <th className="pb-2 pr-4 font-medium">Início</th>
                        <th className="pb-2 pr-4 font-medium">Fim</th>
                        <th className="pb-2 font-medium">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                    {rows.map((p) => (
                        <tr key={p.id}>
                            <td className="py-2 pr-4 font-mono font-semibold">{p.plate}</td>
                            <td className="py-2 pr-4 text-zinc-400">{p.insuredName || "—"}</td>
                            <td className="py-2 pr-4 text-zinc-400">{p.policyNumber || "—"}</td>
                            <td className="py-2 pr-4 text-zinc-400">{formatDate(p.startDate)}</td>
                            <td className="py-2 pr-4 text-zinc-400">{formatDate(p.endDate)}</td>
                            <td className="py-2">
                                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-300">
                                    {STATUS_LABEL[p.status] || p.status}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

}

async function buildWorkbook(sectionsData) {

    const { default: ExcelJS } = await import("exceljs");

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Fusion";
    workbook.created = new Date();

    for (const section of SECTIONS) {

        const sheet = workbook.addWorksheet(section.label);

        const headerRow = sheet.addRow(["Placa", "Segurado", "Nº Apólice", "Início", "Fim", "Status"]);
        headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF18181B" } };
        });

        for (const p of sectionsData[section.key]) {
            sheet.addRow([
                p.plate,
                p.insuredName || "",
                p.policyNumber || "",
                formatDate(p.startDate),
                formatDate(p.endDate),
                STATUS_LABEL[p.status] || p.status,
            ]);
        }

        sheet.columns.forEach((col) => { col.width = 20; });

    }

    return workbook;

}

function downloadWorkbook(workbook, filename) {
    return workbook.xlsx.writeBuffer().then((buffer) => {
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    });
}

export default function PolicyAlerts() {

    const [sections, setSections] = useState({ expired: [], expiring: [], cancelled: [], closed: [] });
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        Promise.all([
            getExpiredPolicies(),
            getExpiringPolicies(30),
            getCancelledPolicies(),
            getClosedPolicies(),
        ])
            .then(([expired, expiring, cancelled, closed]) => {
                setSections({
                    expired: Array.isArray(expired) ? expired : [],
                    expiring: Array.isArray(expiring) ? expiring : [],
                    cancelled: Array.isArray(cancelled) ? cancelled : [],
                    closed: Array.isArray(closed) ? closed : [],
                });
            })
            .catch((err) => {
                console.error(err);
                toast.error("Erro ao carregar alertas de apólices");
            })
            .finally(() => setLoading(false));
    }, []);

    const total = sections.expired.length + sections.expiring.length
        + sections.cancelled.length + sections.closed.length;

    async function handleExport() {
        setExporting(true);
        try {
            const workbook = await buildWorkbook(sections);
            await downloadWorkbook(workbook, `alertas-apolices-${todayForFilename()}.xlsx`);
            toast.success("Excel gerado com sucesso");
        } catch (err) {
            console.error(err);
            toast.error("Erro ao gerar Excel: " + err.message);
        } finally {
            setExporting(false);
        }
    }

    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

            <div className="mb-6 flex items-center gap-2">
                <ShieldAlert size={18} className="text-zinc-400" />
                <h1 className="text-xl font-semibold">Alertas de Apólices</h1>
                {!loading && (
                    <span className="ml-2 rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-300">
                        {total}
                    </span>
                )}
                <button
                    onClick={handleExport}
                    disabled={loading || exporting || total === 0}
                    className="
                        ml-auto flex items-center gap-2
                        rounded-xl border border-zinc-700
                        bg-zinc-950 px-4 py-2
                        text-sm font-semibold
                        transition hover:bg-zinc-800
                        disabled:cursor-not-allowed disabled:opacity-40
                    "
                >
                    <Download size={15} />
                    {exporting ? "Gerando..." : "Exportar Excel"}
                </button>
            </div>

            {loading ? (
                <p className="py-10 text-center text-zinc-500">Carregando...</p>
            ) : total === 0 ? (
                <p className="py-10 text-center text-zinc-500">Nenhuma apólice em alerta</p>
            ) : (
                <div className="flex flex-col gap-8">
                    {SECTIONS.map((section) => (
                        <section key={section.key}>
                            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-300">
                                {section.emoji} {section.label}
                                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${section.badgeClass}`}>
                                    {sections[section.key].length}
                                </span>
                            </h2>
                            <PoliciesTable rows={sections[section.key]} />
                        </section>
                    ))}
                </div>
            )}

        </div>
    );
}
