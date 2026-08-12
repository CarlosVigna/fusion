import { useEffect, useRef, useState } from "react";

import toast from "react-hot-toast";

import { MapPin, X } from "lucide-react";

import { apiClient } from "../services/api/apiClient";
import { triggerI4Pro, getEtlStatus } from "../services/importStatusService";

const EMPTY_FORM = {
  insuredName: "",
  cpfCnpj: "",
  policyNumber: "",
  startDate: "",
  endDate: "",
  notes: "",
};

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS  = 120000; // 2 min

export default function TracknMePending() {

  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // { [plate]: { phase: 'searching'|'done'|'notfound'|'error', message: string } }
  const [i4proState, setI4proState] = useState({});

  const pollRefs = useRef({});

  useEffect(() => {
    fetchPending();
    return () => {
      Object.values(pollRefs.current).forEach(clearInterval);
    };
  }, []);

  async function fetchPending() {
    setLoading(true);
    try {
      const data = await apiClient.get("/tracknme/pending");
      setVehicles(data);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar veículos pendentes");
    } finally {
      setLoading(false);
    }
  }

  function setPlateState(plate, phase, message = "") {
    setI4proState(prev => ({ ...prev, [plate]: { phase, message } }));
  }

  function clearPlateState(plate) {
    setI4proState(prev => {
      const next = { ...prev };
      delete next[plate];
      return next;
    });
  }

  function openModal(vehicle) {
    setSelected(vehicle);
    setForm(EMPTY_FORM);
  }

  function closeModal() {
    setSelected(null);
    setForm(EMPTY_FORM);
  }

  function setField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!form.insuredName.trim()) {
      toast.error("Nome do segurado é obrigatório");
      return;
    }

    setSaving(true);
    try {
      await apiClient.put(`/vehicles/${selected.plate}`, {
        insuredName: form.insuredName.trim(),
        notes: form.notes.trim() || null,
      });

      const hasPolicy =
        form.policyNumber.trim() ||
        form.startDate ||
        form.endDate ||
        form.cpfCnpj.trim();

      if (hasPolicy) {
        await apiClient.post("/policies", {
          plate: selected.plate,
          policyNumber: form.policyNumber.trim() || null,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
          status: "ACTIVE",
          insuredName: form.insuredName.trim(),
          cpfCnpj: form.cpfCnpj.trim() || null,
          source: "MANUAL",
        });
      }

      toast.success("Segurado cadastrado com sucesso");
      closeModal();
      fetchPending();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar cadastro");
    } finally {
      setSaving(false);
    }
  }

  async function handleI4Pro(plate) {
    // Cancela polling anterior desta placa se houver
    if (pollRefs.current[plate]) {
      clearInterval(pollRefs.current[plate]);
      delete pollRefs.current[plate];
    }

    setPlateState(plate, "searching", "Buscando no i4pro...");
    const triggeredAt = Date.now();

    try {
      await triggerI4Pro(plate);
    } catch (err) {
      console.error(err);
      setPlateState(plate, "error", "Erro ao acionar ETL");
      return;
    }

    let elapsed = 0;

    pollRefs.current[plate] = setInterval(async () => {
      elapsed += POLL_INTERVAL_MS;

      if (elapsed > POLL_TIMEOUT_MS) {
        clearInterval(pollRefs.current[plate]);
        delete pollRefs.current[plate];
        setPlateState(plate, "error", "Tempo esgotado — tente novamente");
        return;
      }

      try {
        const statuses = await getEtlStatus();
        const entry = statuses.find(s => s.type === "I4PRO_TRACKNME");
        if (!entry) return;

        // Ignora status anterior ao nosso trigger
        const updatedAt = new Date(entry.updatedAt).getTime();
        if (updatedAt < triggeredAt) return;

        if (entry.status === "RUNNING") {
          setPlateState(plate, "searching", "Processando no i4pro...");
          return;
        }

        clearInterval(pollRefs.current[plate]);
        delete pollRefs.current[plate];

        if (entry.status === "SUCCESS") {
          setPlateState(plate, "searching", "Verificando resultado...");
          await new Promise(r => setTimeout(r, 1000));

          const pending = await apiClient.get("/tracknme/pending");
          const stillPending = pending.some(v => v.plate === plate);

          if (stillPending) {
            setPlateState(plate, "notfound", "Não encontrado no i4pro");
          } else {
            setPlateState(plate, "done", "Cadastrado com sucesso!");
            setVehicles(prev => prev.filter(v => v.plate !== plate));
          }
        } else {
          setPlateState(plate, "error", entry.lastError || "Erro no ETL");
        }
      } catch (_) {
        // Ignora erros de polling silenciosamente
      }
    }, POLL_INTERVAL_MS);
  }

  function renderI4ProCell(v) {
    const state = i4proState[v.plate];

    if (state?.phase === "searching") {
      return (
        <div className="flex min-w-[170px] flex-col gap-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-700">
            <div
              className="h-full rounded-full bg-cyan-500"
              style={{ animation: "i4pro-sweep 1.4s ease-in-out infinite", width: "45%" }}
            />
          </div>
          <span className="text-xs text-zinc-400">{state.message}</span>
        </div>
      );
    }

    if (state?.phase === "done") {
      return (
        <span className="text-xs font-semibold text-emerald-400">
          ✅ {state.message}
        </span>
      );
    }

    if (state?.phase === "notfound") {
      return (
        <div className="flex items-center gap-2">
          <span className="text-xs text-red-400">❌ {state.message}</span>
          <button
            onClick={() => clearPlateState(v.plate)}
            className="text-xs text-zinc-500 hover:text-zinc-300"
            title="Fechar"
          >
            ↩
          </button>
        </div>
      );
    }

    if (state?.phase === "error") {
      return (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-yellow-400">⚠️ {state.message}</span>
          <button
            onClick={() => handleI4Pro(v.plate)}
            className="text-xs text-zinc-400 underline hover:text-zinc-200"
          >
            Tentar novamente
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => handleI4Pro(v.plate)}
          title="Buscar apólice no i4pro"
          className="
            rounded-xl border border-zinc-600
            bg-zinc-800 px-3 py-1.5
            text-xs font-semibold text-zinc-300
            transition hover:bg-zinc-700
          "
        >
          🔍 i4pro
        </button>
        <button
          onClick={() => openModal(v)}
          className="
            rounded-xl border border-cyan-500/30
            bg-cyan-500/10 px-3 py-1.5
            text-xs font-semibold text-cyan-400
            transition hover:bg-cyan-500/20
          "
        >
          Cadastrar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Keyframe da barra de progresso indeterminada */}
      <style>{`
        @keyframes i4pro-sweep {
          0%   { transform: translateX(-120%); }
          100% { transform: translateX(300%); }
        }
      `}</style>

      <div
        className="
          flex items-center justify-between
          rounded-2xl border border-zinc-800
          bg-zinc-900 p-4
        "
      >
        <div className="flex items-center gap-3">
          <MapPin className="text-cyan-400" size={20} />
          <div>
            <h1 className="text-lg font-semibold">
              TracknMe — Pendentes de Cadastro
            </h1>
            <p className="text-xs text-zinc-500">
              Veículos TracknMe sem segurado cadastrado
            </p>
          </div>
        </div>
        <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-sm font-semibold text-cyan-400">
          {vehicles.length} pendente{vehicles.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">

        {loading ? (

          <div className="py-12 text-center text-zinc-500">
            Carregando...
          </div>

        ) : vehicles.length === 0 ? (

          <div className="py-12 text-center text-zinc-500">
            Nenhum veículo pendente
          </div>

        ) : (

          <table className="min-w-full text-sm">

            <thead className="bg-zinc-950 text-xs text-zinc-400">
              <tr>
                <th className="px-4 py-3 text-left">Placa</th>
                <th className="px-4 py-3 text-left">Device ID</th>
                <th className="px-4 py-3 text-left">Cadastrado em</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>

            <tbody>
              {vehicles.map(v => (
                <tr
                  key={v.plate}
                  className="border-t border-zinc-800 transition hover:bg-zinc-800/40"
                >
                  <td className="px-4 py-3 font-mono font-semibold">
                    {v.plate}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                    {v.tracknmeDeviceId || "--"}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {v.createdAt
                      ? new Date(v.createdAt).toLocaleDateString("pt-BR")
                      : "--"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {renderI4ProCell(v)}
                  </td>
                </tr>
              ))}
            </tbody>

          </table>

        )}

      </div>

      {selected && (

        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={closeModal}
        >

          <div
            className="
              w-full max-w-lg rounded-2xl
              border border-zinc-700
              bg-zinc-900 p-6 shadow-2xl
            "
            onClick={e => e.stopPropagation()}
          >

            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">
                  Cadastrar segurado
                </h2>
                <p className="font-mono text-xs text-zinc-500">
                  {selected.plate}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">

              <div>
                <label className="mb-1 block text-xs text-zinc-400">
                  Nome do segurado *
                </label>
                <input
                  type="text"
                  value={form.insuredName}
                  onChange={e => setField("insuredName", e.target.value)}
                  placeholder="Ex: João da Silva"
                  className="
                    w-full rounded-xl border border-zinc-700
                    bg-zinc-800 px-3 py-2 text-sm
                    outline-none placeholder:text-zinc-600
                    focus:border-cyan-500/50
                  "
                />
              </div>

              <div className="grid grid-cols-2 gap-4">

                <div>
                  <label className="mb-1 block text-xs text-zinc-400">
                    CPF / CNPJ
                  </label>
                  <input
                    type="text"
                    value={form.cpfCnpj}
                    onChange={e => setField("cpfCnpj", e.target.value)}
                    placeholder="000.000.000-00"
                    className="
                      w-full rounded-xl border border-zinc-700
                      bg-zinc-800 px-3 py-2 text-sm
                      outline-none placeholder:text-zinc-600
                      focus:border-cyan-500/50
                    "
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-zinc-400">
                    Número da apólice
                  </label>
                  <input
                    type="text"
                    value={form.policyNumber}
                    onChange={e => setField("policyNumber", e.target.value)}
                    placeholder="Ex: 123456"
                    className="
                      w-full rounded-xl border border-zinc-700
                      bg-zinc-800 px-3 py-2 text-sm
                      outline-none placeholder:text-zinc-600
                      focus:border-cyan-500/50
                    "
                  />
                </div>

              </div>

              <div className="grid grid-cols-2 gap-4">

                <div>
                  <label className="mb-1 block text-xs text-zinc-400">
                    Início da vigência
                  </label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={e => setField("startDate", e.target.value)}
                    className="
                      w-full rounded-xl border border-zinc-700
                      bg-zinc-800 px-3 py-2 text-sm
                      outline-none
                      focus:border-cyan-500/50
                    "
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-zinc-400">
                    Fim da vigência
                  </label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={e => setField("endDate", e.target.value)}
                    className="
                      w-full rounded-xl border border-zinc-700
                      bg-zinc-800 px-3 py-2 text-sm
                      outline-none
                      focus:border-cyan-500/50
                    "
                  />
                </div>

              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-400">
                  Observações
                </label>
                <textarea
                  value={form.notes}
                  onChange={e => setField("notes", e.target.value)}
                  placeholder="Informações adicionais..."
                  rows={3}
                  className="
                    w-full resize-none rounded-xl border border-zinc-700
                    bg-zinc-800 px-3 py-2 text-sm
                    outline-none placeholder:text-zinc-600
                    focus:border-cyan-500/50
                  "
                />
              </div>

            </div>

            <div className="mt-6 flex justify-end gap-3">

              <button
                onClick={closeModal}
                className="
                  rounded-xl border border-zinc-700
                  px-4 py-2 text-sm
                  transition hover:bg-zinc-800
                "
              >
                Cancelar
              </button>

              <button
                onClick={handleSave}
                disabled={saving}
                className="
                  rounded-xl border border-cyan-500/30
                  bg-cyan-500/10 px-4 py-2 text-sm
                  font-semibold text-cyan-400
                  transition hover:bg-cyan-500/20
                  disabled:opacity-50
                "
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );

}
