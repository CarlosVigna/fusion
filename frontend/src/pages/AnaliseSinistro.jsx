import { useEffect, useMemo, useRef, useState } from "react";

import toast from "react-hot-toast";

import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Search,
  ShieldAlert,
} from "lucide-react";

import { getVehicles } from "../services/vehicleService";

import {
  downloadPack,
  downloadReport,
  getAnalysisHistory,
  getAnalysisStatus,
  startAnalysis,
} from "../services/sinistroService";

const POLL_INTERVAL_MS = 4000;

const STAGES = [
  { emoji: "🚗", label: "Baixando KM Mensal..." },
  { emoji: "⚡", label: "Baixando Excesso de Velocidade..." },
  { emoji: "📊", label: "Processando e calculando indícios..." },
];

function formatDate(isoDate) {
  if (!isoDate) return "—";
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function classLabel(c) {
  if (c === "SUSPEITO") return { text: "SUSPEITO", style: "text-red-400 bg-red-950/40 border border-red-900/50" };
  if (c === "ATENCAO")  return { text: "ATENÇÃO",  style: "text-yellow-400 bg-yellow-950/40 border border-yellow-900/50" };
  return                       { text: "NORMAL",   style: "text-emerald-400 bg-emerald-950/30 border border-emerald-900/40" };
}

function ClassBadge({ c }) {
  const { text, style } = classLabel(c);
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${style}`}>{text}</span>
  );
}

function Section({ title, icon, children }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900">
      <div className="border-b border-zinc-800 px-5 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <span>{icon}</span>
          {title}
        </p>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function KV({ label, value, accent }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className="text-sm text-zinc-400">{label}</span>
      <span className={`text-sm font-semibold ${accent ?? "text-white"}`}>{value ?? "—"}</span>
    </div>
  );
}

function RatioBar({ ratio }) {
  if (ratio == null) return null;
  const pct = Math.min(ratio * 50, 100); // média = 50%
  const color = ratio > 2 ? "bg-red-500" : ratio > 1.5 ? "bg-yellow-400" : "bg-emerald-400";
  return (
    <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-800">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function StageProgress({ status }) {
  const running = status === "PENDING" || status === "RUNNING";
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="space-y-2.5">
        {STAGES.map((s, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            <span>{s.emoji}</span>
            <span className="flex-1 text-zinc-300">{s.label}</span>
            {running
              ? <Loader2 size={14} className="animate-spin text-zinc-500" />
              : <CheckCircle2 size={14} className="text-emerald-400" />}
          </div>
        ))}
        <div className="flex items-center gap-3 border-t border-zinc-800 pt-2.5 text-sm">
          <span>✅</span>
          <span className="flex-1 font-semibold text-white">Análise concluída!</span>
          {running
            ? <Loader2 size={14} className="animate-spin text-zinc-500" />
            : <CheckCircle2 size={14} className="text-emerald-400" />}
        </div>
      </div>
    </div>
  );
}

function AnalysisResult({ status }) {
  if (status.status === "ERROR") {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-red-900/50 bg-red-950/30 p-5">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-400" />
        <div>
          <p className="font-semibold text-red-300">Falha na análise</p>
          <p className="mt-1 text-sm text-red-400/80">
            {status.errorMessage || "Erro desconhecido durante a coleta de dados."}
          </p>
        </div>
      </div>
    );
  }

  if (status.status !== "DONE") return <StageProgress status={status.status} />;

  const ind = status.indicators;
  const isColisao = status.sinistroType === "COLISAO";

  return (
    <div className="space-y-4">

      <StageProgress status={status.status} />

      {ind && (
        <>
          {/* Contexto do sinistro */}
          <Section title="Contexto do sinistro" icon="📍">
            <div className="divide-y divide-zinc-800">
              <KV label="Tipo"
                value={isColisao ? "COLISÃO" : "ROUBO/FURTO"} />
              <KV label="Data declarada"
                value={formatDate(status.sinistroDate)} />
              <KV label="Hora declarada"
                value={status.sinistroTime || "—"} />
              <KV label="Dia da semana"
                value={ind.sinistroWeekday || "—"} />
              <KV label="Classificação do horário"
                value={ind.horarioClassification || "—"}
                accent={
                  ind.horarioClassification === "Madrugada" ? "text-red-400" :
                  ind.horarioClassification === "Noturno"   ? "text-yellow-400" : "text-emerald-400"
                } />
            </div>
          </Section>

          {/* KM do período */}
          <Section title="Uso do veículo no período" icon="🚗">
            <div className="divide-y divide-zinc-800">
              <KV label="KM total no período"
                value={ind.totalKm != null ? `${ind.totalKm.toFixed(1)} km` : null} />
              <KV label="Média diária"
                value={ind.avgDailyKm != null ? `${ind.avgDailyKm.toFixed(1)} km/dia` : null} />
              <KV label="Dia com maior KM"
                value={ind.maxKmDate ? `${formatDate(ind.maxKmDate)} — ${ind.maxKmValue?.toFixed(1)} km` : null} />
              <div className="py-1">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-sm text-zinc-400">
                    KM no dia do sinistro
                  </span>
                  <span className={`text-sm font-semibold ${
                    ind.kmSinistroRatio > 2 ? "text-red-400" :
                    ind.kmSinistroRatio > 1.5 ? "text-yellow-400" : "text-white"
                  }`}>
                    {ind.kmOnSinistroDate != null ? `${ind.kmOnSinistroDate.toFixed(1)} km` : "—"}
                    {ind.kmSinistroRatio != null &&
                      ` (${(ind.kmSinistroRatio * 100).toFixed(0)}% da média)`}
                  </span>
                </div>
                {ind.kmSinistroRatio != null && <RatioBar ratio={ind.kmSinistroRatio} />}
              </div>
              {ind.avgKmLast7Days != null && (
                <div className="py-1">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-sm text-zinc-400">KM médio — 7 dias anteriores</span>
                    <span className={`text-sm font-semibold ${
                      ind.avgKmLast7DaysRatio != null && Math.abs(ind.avgKmLast7DaysRatio - 1) > 0.6
                        ? "text-red-400"
                        : Math.abs(ind.avgKmLast7DaysRatio - 1) > 0.3
                        ? "text-yellow-400" : "text-white"
                    }`}>
                      {ind.avgKmLast7Days.toFixed(1)} km/dia
                      {ind.avgKmLast7DaysRatio != null &&
                        ` (${(ind.avgKmLast7DaysRatio * 100).toFixed(0)}% da média geral)`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* Excesso de velocidade */}
          <Section title="Histórico de velocidade" icon="⚡">
            <div className="divide-y divide-zinc-800">
              <KV label="Ocorrências no período"
                value={ind.speedingOccurrences}
                accent={ind.speedingOccurrences > 0 ? "text-yellow-400" : "text-emerald-400"} />
              <KV label="Ocorrências — 7 dias anteriores ao sinistro"
                value={ind.speedingLast7Days}
                accent={ind.speedingLast7Days > 3 ? "text-red-400" : ind.speedingLast7Days > 0 ? "text-yellow-400" : "text-emerald-400"} />
              <KV label="Velocidade máxima registrada"
                value={ind.maxSpeed != null ? `${ind.maxSpeed.toFixed(0)} km/h` : null}
                accent={ind.maxSpeed >= 140 ? "text-red-400" : ind.maxSpeed >= 110 ? "text-yellow-400" : "text-white"} />
            </div>
          </Section>

          {/* Indícios */}
          {ind.indicios?.length > 0 && (
            <Section title="Indícios identificados" icon="📋">
              <div className="space-y-2">
                {ind.indicios.map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <ClassBadge c={item.classificacao} />
                    <span className="text-sm text-zinc-300">{item.descricao}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </>
      )}

      {/* Downloads */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => downloadReport(status.id, status.plate, "xlsx").catch((e) => toast.error(e.message))}
          className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
        >
          <FileText size={14} /> Baixar Relatório Excel
        </button>
        <button
          onClick={() => downloadReport(status.id, status.plate, "pdf").catch((e) => toast.error(e.message))}
          className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
        >
          <FileText size={14} /> Baixar Relatório PDF
        </button>
        <button
          onClick={() => downloadPack(status.id, status.plate).catch((e) => toast.error(e.message))}
          className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
        >
          📦 Baixar Pack Completo (ZIP)
        </button>
      </div>

    </div>
  );
}

export default function AnaliseSinistro() {

  const [vehicles, setVehicles] = useState([]);
  const [plateInput, setPlateInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sinistroDate, setSinistroDate] = useState("");
  const [sinistroTime, setSinistroTime] = useState("");
  const [sinistroType, setSinistroType] = useState("COLISAO");
  const [submitting, setSubmitting] = useState(false);

  const [currentStatus, setCurrentStatus] = useState(null);
  const [history, setHistory] = useState([]);

  const pollRef = useRef(null);

  useEffect(() => {
    getVehicles().then(setVehicles).catch(() => {});
    loadHistory();
    return () => clearInterval(pollRef.current);
  }, []);

  async function loadHistory() {
    try {
      setHistory(await getAnalysisHistory());
    } catch {
      // silencioso
    }
  }

  const suggestions = useMemo(() => {
    if (!plateInput || plateInput.length < 2) return [];
    const q = plateInput.toUpperCase();
    return vehicles.filter((v) => v.plate?.toUpperCase().includes(q)).slice(0, 8);
  }, [plateInput, vehicles]);

  function pollStatus(id) {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const s = await getAnalysisStatus(id);
        setCurrentStatus(s);
        if (s.status === "DONE" || s.status === "ERROR") {
          clearInterval(pollRef.current);
          loadHistory();
        }
      } catch { /* silencioso */ }
    }, POLL_INTERVAL_MS);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!plateInput || !startDate || !endDate || !sinistroDate) {
      toast.error("Preencha placa, período de análise e data do sinistro.");
      return;
    }

    setSubmitting(true);
    setCurrentStatus(null);

    try {
      const response = await startAnalysis({
        plate: plateInput,
        startDate,
        endDate,
        sinistroDate,
        sinistroTime: sinistroTime || null,
        sinistroType,
      });

      setCurrentStatus({ id: response.id, status: response.status, plate: plateInput });
      pollStatus(response.id);
      toast.success("Análise iniciada — acompanhe o progresso abaixo");
    } catch (error) {
      toast.error("Erro ao iniciar análise: " + error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function viewHistoryItem(item) {
    clearInterval(pollRef.current);
    try {
      const s = await getAnalysisStatus(item.id);
      setCurrentStatus(s);
      setPlateInput(item.plate);
      if (s.status === "PENDING" || s.status === "RUNNING") pollStatus(item.id);
    } catch (error) {
      toast.error("Erro ao carregar análise: " + error.message);
    }
  }

  const inputCls = "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-500";
  const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500";

  return (
    <div className="space-y-6">

      {/* Formulário */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900">

        <div className="border-b border-zinc-800 p-6">
          <div className="flex items-center gap-3">
            <ShieldAlert size={20} className="text-zinc-400" />
            <div>
              <h2 className="text-lg font-semibold">Análise de Sinistro</h2>
              <p className="mt-0.5 text-sm text-zinc-500">
                Coleta dados do Multiportal e calcula indícios de irregularidade por tipo de sinistro.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">

          {/* Tipo de sinistro */}
          <div>
            <label className={labelCls}>Tipo de sinistro</label>
            <div className="flex gap-3">
              {[
                { value: "COLISAO", label: "🚗 Colisão" },
                { value: "ROUBO",   label: "🔓 Roubo / Furto" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSinistroType(opt.value)}
                  className={`rounded-xl border px-5 py-2 text-sm font-semibold transition
                    ${sinistroType === opt.value
                      ? "border-white bg-white text-black"
                      : "border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Placa + datas do sinistro */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

            {/* Placa autocomplete */}
            <div className="relative">
              <label className={labelCls}>Placa</label>
              <input
                type="text"
                value={plateInput}
                onChange={(e) => { setPlateInput(e.target.value.toUpperCase()); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="ABC1234"
                className={inputCls + " font-mono"}
              />
              {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 shadow-lg">
                  {suggestions.map((v) => (
                    <li key={v.plate}>
                      <button
                        type="button"
                        onMouseDown={() => setPlateInput(v.plate)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-zinc-800"
                      >
                        <span className="font-mono">{v.plate}</span>
                        <span className="text-xs text-zinc-500">{v.insuredName}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className={labelCls}>Data do sinistro</label>
              <input type="date" value={sinistroDate} onChange={(e) => setSinistroDate(e.target.value)} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Hora declarada (HH:mm)</label>
              <input type="time" value={sinistroTime} onChange={(e) => setSinistroTime(e.target.value)} className={inputCls} />
            </div>

          </div>

          {/* Período de análise */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={labelCls}>Período de análise — início</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Período de análise — fim</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40 md:w-auto md:px-8"
          >
            {submitting ? "Iniciando..." : "Iniciar Análise"}
          </button>

        </form>

      </div>

      {/* Resultado */}
      {currentStatus && <AnalysisResult status={currentStatus} />}

      {/* Histórico */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 p-4">
          <p className="text-sm font-semibold text-zinc-300">Histórico de análises</p>
        </div>
        {history.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">Nenhuma análise realizada ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500">
                  <th className="px-4 py-2">Placa</th>
                  <th className="px-4 py-2">Tipo</th>
                  <th className="px-4 py-2">Sinistro</th>
                  <th className="px-4 py-2">Período</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Data da análise</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id} className="border-t border-zinc-800">
                    <td className="px-4 py-2 font-mono">{item.plate}</td>
                    <td className="px-4 py-2 text-zinc-400">
                      {item.sinistroType === "COLISAO" ? "Colisão" : item.sinistroType === "ROUBO" ? "Roubo/Furto" : "—"}
                    </td>
                    <td className="px-4 py-2">{formatDate(item.sinistroDate)}</td>
                    <td className="px-4 py-2 text-zinc-400">{formatDate(item.startDate)} a {formatDate(item.endDate)}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold
                        ${item.status === "DONE"    ? "bg-emerald-950/50 text-emerald-400" :
                          item.status === "ERROR"   ? "bg-red-950/50 text-red-400" :
                          "bg-zinc-800 text-zinc-400"}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-zinc-400">
                      {new Date(item.createdAt + "Z").toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => viewHistoryItem(item)}
                        className="rounded-lg bg-zinc-800 px-3 py-1 text-xs font-semibold transition hover:bg-zinc-700"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );

}
