import { useEffect, useMemo, useRef, useState } from "react";

import toast from "react-hot-toast";

import {
  AlertTriangle,
  CheckCircle2,
  Gauge,
  Loader2,
  Search,
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

// A API so expoe PENDING/RUNNING/DONE/ERROR (sem sub-etapa) — o ETL nao
// reporta granularidade fina de progresso. Enquanto RUNNING, as 3
// primeiras etapas aparecem "em andamento" juntas (nao sequencial, seria
// enganoso fingir uma ordem que não temos como observar de verdade).
const STAGES = [
  { key: "km", emoji: "🚗", label: "Baixando KM Mensal..." },
  { key: "speed", emoji: "⚡", label: "Baixando Excesso de Velocidade..." },
  { key: "processing", emoji: "📊", label: "Processando dados..." },
];

function formatDate(isoDate) {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function StageProgress({ status }) {
  const running = status === "PENDING" || status === "RUNNING";

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="space-y-3">
        {STAGES.map((stage) => (
          <div key={stage.key} className="flex items-center gap-3 text-sm">
            <span className="text-lg">{stage.emoji}</span>
            <span className="flex-1 text-zinc-300">{stage.label}</span>
            {running && <Loader2 size={16} className="animate-spin text-zinc-500" />}
            {!running && <CheckCircle2 size={16} className="text-emerald-400" />}
          </div>
        ))}
        <div className="flex items-center gap-3 border-t border-zinc-800 pt-3 text-sm">
          <span className="text-lg">✅</span>
          <span className="flex-1 font-medium text-white">Análise concluída!</span>
          {running
            ? <Loader2 size={16} className="animate-spin text-zinc-500" />
            : <CheckCircle2 size={16} className="text-emerald-400" />}
        </div>
      </div>
    </div>
  );
}

function IndicatorCard({ label, value, accent }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ?? "text-white"}`}>{value}</p>
    </div>
  );
}

function AnalysisResult({ status, plate }) {

  if (status.status === "ERROR") {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-red-900/50 bg-red-950/30 p-6">
        <AlertTriangle size={20} className="mt-0.5 text-red-400" />
        <div>
          <p className="font-semibold text-red-300">Falha na análise</p>
          <p className="mt-1 text-sm text-red-400/80">
            {status.errorMessage || "Erro desconhecido durante a coleta de dados."}
          </p>
        </div>
      </div>
    );
  }

  if (status.status !== "DONE") {
    return <StageProgress status={status.status} />;
  }

  const indicators = status.indicators;

  return (
    <div className="space-y-6">

      <StageProgress status={status.status} />

      {indicators && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <IndicatorCard
              label="KM total no período"
              value={indicators.totalKm != null ? `${indicators.totalKm.toFixed(1)} km` : "—"}
            />
            <IndicatorCard
              label="Dia com maior KM"
              value={
                indicators.maxKmDate
                  ? `${formatDate(indicators.maxKmDate)} (${indicators.maxKmValue.toFixed(1)} km)`
                  : "—"
              }
            />
            <IndicatorCard
              label="Média diária de KM"
              value={indicators.avgDailyKm != null ? `${indicators.avgDailyKm.toFixed(1)} km` : "—"}
            />
            <IndicatorCard
              label="Ocorrências de excesso de velocidade"
              value={indicators.speedingOccurrences}
              accent={indicators.speedingOccurrences > 0 ? "text-yellow-400" : "text-white"}
            />
            <IndicatorCard
              label="Velocidade máxima registrada"
              value={indicators.maxSpeed != null ? `${indicators.maxSpeed.toFixed(0)} km/h` : "—"}
              accent={indicators.maxSpeed != null && indicators.maxSpeed > 0 ? "text-red-400" : "text-white"}
            />
          </div>

          {indicators.suspiciousDays?.length > 0 && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900">
              <div className="border-b border-zinc-800 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-yellow-400">
                  <Gauge size={16} />
                  Dias suspeitos (KM {'>'} 2x a média do período)
                </p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500">
                    <th className="px-4 py-2">Data</th>
                    <th className="px-4 py-2">KM</th>
                  </tr>
                </thead>
                <tbody>
                  {indicators.suspiciousDays.map((day) => (
                    <tr key={day.date} className="border-t border-zinc-800">
                      <td className="px-4 py-2">{formatDate(day.date)}</td>
                      <td className="px-4 py-2">{day.km.toFixed(1)} km</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => downloadReport(status.id, plate, "xlsx").catch((e) => toast.error(e.message))}
          className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
        >
          Baixar Relatório Excel
        </button>
        <button
          onClick={() => downloadReport(status.id, plate, "pdf").catch((e) => toast.error(e.message))}
          className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
        >
          Baixar Relatório PDF
        </button>
        <button
          onClick={() => downloadPack(status.id, plate).catch((e) => toast.error(e.message))}
          className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
        >
          Baixar Pack Completo (ZIP)
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
      const data = await getAnalysisHistory();
      setHistory(data);
    } catch (error) {
      console.error(error);
    }
  }

  const suggestions = useMemo(() => {
    if (!plateInput || plateInput.length < 2) return [];
    const query = plateInput.toUpperCase();
    return vehicles
      .filter((v) => v.plate?.toUpperCase().includes(query))
      .slice(0, 8);
  }, [plateInput, vehicles]);

  function pollStatus(id) {

    clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {

      try {

        const status = await getAnalysisStatus(id);

        setCurrentStatus(status);

        if (status.status === "DONE" || status.status === "ERROR") {
          clearInterval(pollRef.current);
          loadHistory();
        }

      } catch (error) {
        console.error(error);
      }

    }, POLL_INTERVAL_MS);

  }

  async function handleSubmit(e) {

    e.preventDefault();

    if (!plateInput || !startDate || !endDate) {
      toast.error("Preencha placa, data início e data fim.");
      return;
    }

    setSubmitting(true);
    setCurrentStatus(null);

    try {

      const response = await startAnalysis({
        plate: plateInput,
        startDate,
        endDate,
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
      const status = await getAnalysisStatus(item.id);
      setCurrentStatus(status);
      setPlateInput(item.plate);

      if (status.status === "PENDING" || status.status === "RUNNING") {
        pollStatus(item.id);
      }

    } catch (error) {
      toast.error("Erro ao carregar análise: " + error.message);
    }

  }

  return (
    <div className="space-y-6">

      {/* Formulário */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900">

        <div className="border-b border-zinc-800 p-6">
          <div className="flex items-center gap-3">
            <Search size={20} className="text-zinc-400" />
            <div>
              <h2 className="text-lg font-semibold">Análise de Sinistro</h2>
              <p className="mt-0.5 text-sm text-zinc-500">
                Coleta KM Mensal e Excesso de Velocidade do Multiportal para um
                veículo e período, calculando indicadores de possível fraude.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

            <div className="relative">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Placa
              </label>
              <input
                type="text"
                value={plateInput}
                onChange={(e) => {
                  setPlateInput(e.target.value.toUpperCase());
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="ABC1234"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-500"
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
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Data início
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Data fim
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
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

      {/* Progresso / Resultado */}
      {currentStatus && (
        <AnalysisResult status={currentStatus} plate={currentStatus.plate} />
      )}

      {/* Histórico */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 p-4">
          <p className="text-sm font-semibold text-zinc-300">Histórico de análises</p>
        </div>
        {history.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">Nenhuma análise realizada ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="px-4 py-2">Placa</th>
                <th className="px-4 py-2">Segurado</th>
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
                  <td className="px-4 py-2">{item.insuredName || "—"}</td>
                  <td className="px-4 py-2">{formatDate(item.startDate)} a {formatDate(item.endDate)}</td>
                  <td className="px-4 py-2">{item.status}</td>
                  <td className="px-4 py-2">{new Date(item.createdAt + "Z").toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => viewHistoryItem(item)}
                      className="rounded-lg bg-zinc-800 px-3 py-1 text-xs font-semibold transition hover:bg-zinc-700"
                    >
                      Ver resultado
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );

}
