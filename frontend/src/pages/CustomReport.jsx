import { useEffect, useState } from "react";

import toast from "react-hot-toast";

import { FileSpreadsheet, FileText } from "lucide-react";

import { countCustomReport, downloadCustomReport } from "../services/customReportService";

const FIELD_CATEGORIES = [
  {
    label: "Veículo",
    fields: [
      { key: "plate", label: "Placa" },
      { key: "model", label: "Modelo" },
      { key: "brand", label: "Marca" },
      { key: "vehicleGroup", label: "Grupo" },
    ],
  },
  {
    label: "Apólice",
    fields: [
      { key: "insuredName", label: "Segurado" },
      { key: "cpfCnpj", label: "CPF/CNPJ" },
      { key: "policyNumber", label: "Nº Apólice" },
      { key: "startDate", label: "Início Vigência" },
      { key: "endDate", label: "Fim Vigência" },
      { key: "policyStatus", label: "Status Apólice" },
    ],
  },
  {
    label: "Endereço",
    fields: [
      { key: "city", label: "Cidade" },
      { key: "state", label: "Estado" },
      { key: "zipCode", label: "CEP" },
    ],
  },
  {
    label: "Comunicação",
    fields: [
      { key: "lastCommunication", label: "Última Comunicação" },
      { key: "signalDelayMinutes", label: "Atraso de Sinal (min)" },
      { key: "online", label: "Online" },
    ],
  },
  {
    label: "Equipamento",
    fields: [
      { key: "imei", label: "IMEI" },
      { key: "chipLine", label: "Linha do Chip" },
      { key: "equipment", label: "Equipamento" },
    ],
  },
];

const ALL_FIELD_KEYS = FIELD_CATEGORIES.flatMap((c) => c.fields.map((f) => f.key));

const GROUPS = ["OPERATIONAL", "KAKO", "TEST", "TRACKNME"];

const POLICY_STATUS_OPTIONS = [
  { value: "", label: "Todas" },
  { value: "ACTIVE", label: "Vigente" },
  { value: "EXPIRING", label: "Vencendo" },
  { value: "EXPIRED", label: "Vencida" },
  { value: "CANCELLED", label: "Cancelada" },
  { value: "CLOSED", label: "Encerrada" },
];

const COMMUNICATION_OPTIONS = [
  { value: "", label: "Todas" },
  { value: "ONLINE", label: "Online" },
  { value: "OFFLINE", label: "Offline" },
  { value: "OFFLINE_24H", label: "Sem sinal há mais de 24h" },
  { value: "OFFLINE_48H", label: "Sem sinal há mais de 48h" },
  { value: "OFFLINE_7D", label: "Sem sinal há mais de 7 dias" },
];

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const SELECT_CLASS = "rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none";
const INPUT_CLASS = "w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none";

export default function CustomReport() {

  const [selectedFields, setSelectedFields] = useState(() => new Set(ALL_FIELD_KEYS));
  const [groups, setGroups] = useState([]);
  const [policyStatus, setPolicyStatus] = useState("");
  const [communicationStatus, setCommunicationStatus] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [equipment, setEquipment] = useState("");

  const [previewCount, setPreviewCount] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [generating, setGenerating] = useState(null); // "EXCEL" | "PDF" | null

  function toggleField(key) {
    if (key === "plate") return;
    setSelectedFields((cur) => {
      const next = new Set(cur);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleGroup(group) {
    setGroups((cur) => cur.includes(group) ? cur.filter((g) => g !== group) : [...cur, group]);
  }

  function buildFilters() {
    return {
      groups,
      policyStatus: policyStatus ? [policyStatus] : [],
      communicationStatus: communicationStatus || null,
      city: city.trim() || null,
      state: state || null,
      equipment: equipment.trim() || null,
    };
  }

  useEffect(() => {
    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const { count } = await countCustomReport({ filters: buildFilters() });
        setPreviewCount(count);
      } catch (err) {
        console.error(err);
      } finally {
        setPreviewLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, policyStatus, communicationStatus, city, state, equipment]);

  async function handleGenerate(format) {
    setGenerating(format);
    try {
      const fields = ALL_FIELD_KEYS.filter((k) => selectedFields.has(k));
      await downloadCustomReport({ fields, filters: buildFilters(), format });
      toast.success("Relatório gerado");
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Erro ao gerar relatório");
    } finally {
      setGenerating(null);
    }
  }

  return (
    <div className="p-6 space-y-6">

      <div>
        <h1 className="text-2xl font-bold">Relatório Personalizado</h1>
        <p className="text-zinc-400 mt-1">Escolha os campos e filtros para gerar um relatório sob medida.</p>
      </div>

      {/* Seção 1 — Campos */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
        <h2 className="text-base font-semibold">1. Escolha os campos</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FIELD_CATEGORIES.map((cat) => (
            <div key={cat.label} className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">{cat.label}</p>
              <div className="space-y-1.5">
                {cat.fields.map((f) => (
                  <label key={f.key} className="flex items-center gap-2 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      checked={selectedFields.has(f.key)}
                      disabled={f.key === "plate"}
                      onChange={() => toggleField(f.key)}
                      className="rounded border-zinc-700 accent-white disabled:opacity-60"
                    />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Seção 2 — Filtros */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
        <h2 className="text-base font-semibold">2. Filtros</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">

          <div>
            <label className="mb-1.5 block text-xs text-zinc-400">Grupo</label>
            <div className="flex flex-wrap gap-3">
              {GROUPS.map((g) => (
                <label key={g} className="flex items-center gap-1.5 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={groups.includes(g)}
                    onChange={() => toggleGroup(g)}
                    className="rounded border-zinc-700 accent-white"
                  />
                  {g}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-zinc-400">Status Apólice</label>
            <select value={policyStatus} onChange={(e) => setPolicyStatus(e.target.value)} className={SELECT_CLASS}>
              {POLICY_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-zinc-400">Comunicação</label>
            <select value={communicationStatus} onChange={(e) => setCommunicationStatus(e.target.value)} className={SELECT_CLASS}>
              {COMMUNICATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-zinc-400">Cidade</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} className={INPUT_CLASS} placeholder="Ex: Curitiba" />
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-zinc-400">Estado</label>
            <select value={state} onChange={(e) => setState(e.target.value)} className={SELECT_CLASS}>
              <option value="">Todos</option>
              {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-zinc-400">Equipamento</label>
            <input value={equipment} onChange={(e) => setEquipment(e.target.value)} className={INPUT_CLASS} placeholder="Ex: RST-MICRO" />
          </div>

        </div>
      </div>

      {/* Seção 3 — Gerar */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
        <h2 className="text-base font-semibold">3. Gerar</h2>
        <p className="text-sm text-zinc-400">
          {previewLoading
            ? "Calculando..."
            : previewCount != null
              ? `${previewCount} veículo(s) serão incluídos no relatório`
              : "—"}
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleGenerate("EXCEL")}
            disabled={!!generating || selectedFields.size === 0}
            className="flex items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-zinc-200 disabled:opacity-50"
          >
            <FileSpreadsheet size={16} />
            {generating === "EXCEL" ? "Gerando..." : "📊 Gerar Excel"}
          </button>
          <button
            onClick={() => handleGenerate("PDF")}
            disabled={!!generating || selectedFields.size === 0}
            className="flex items-center gap-2 rounded-2xl border border-zinc-700 px-5 py-2.5 text-sm font-semibold hover:bg-zinc-800 disabled:opacity-50"
          >
            <FileText size={16} />
            {generating === "PDF" ? "Gerando..." : "📄 Gerar PDF"}
          </button>
        </div>
      </div>

    </div>
  );
}
