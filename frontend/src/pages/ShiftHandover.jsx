import { useEffect, useState } from "react";

import toast from "react-hot-toast";

import { Archive, CheckCircle, Download, ExternalLink, Mail, RefreshCw, Send, Unlink } from "lucide-react";

import { useAuthStore } from "../store/authStore";

import { getSignalControl } from "../services/signalControlService";

import {
  disconnectMicrosoft,
  getMicrosoftAuthUrl,
  getMicrosoftStatus,
} from "../services/microsoftAuthService";

import { createShiftHandoverDraft, previewShiftHandover } from "../services/outlookService";

import { apiClient } from "../services/api/apiClient";

import { formatDateTimeForExport, todayForFilename } from "../utils/exportXlsx";

const EXCLUDED_OBS = "Comandos pertinentes enviados.";

function fmtDate(iso) {
  if (!iso) return "Sem apólice";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function buildRequest(dataEntrada, dataSaida, toEmail, vehicles, tracknme) {
  return {
    dataEntrada,
    dataSaida,
    toEmail,
    veiculosList: vehicles.map((v) => ({
      plate: v.plate,
      lastCommunicationAt: v.lastCommunicationAt
        ? formatDateTimeForExport(v.lastCommunicationAt)
        : null,
      policyEndDate: v.policyEndDate ? fmtDate(v.policyEndDate) : null,
      observation: v.lastObservation?.text || null,
    })),
    tracknmeList: tracknme
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

export default function ShiftHandover() {

  const { user } = useAuthStore();

  const [msStatus, setMsStatus] = useState(null);
  const [loadingMs, setLoadingMs] = useState(true);

  const [vehicles, setVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);

  const today = new Date().toISOString().slice(0, 10);
  const [dataEntrada, setDataEntrada] = useState(today);
  const [dataSaida, setDataSaida] = useState(today);
  const [toEmail, setToEmail] = useState("");
  const [tracknme, setTracknme] = useState("");

  const [previewHtml, setPreviewHtml] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [creating, setCreating] = useState(false);
  const [draftResult, setDraftResult] = useState(null);

  useEffect(() => {

    getMicrosoftStatus()
      .then(setMsStatus)
      .catch(console.error)
      .finally(() => setLoadingMs(false));

    getSignalControl(false)
      .then((data) =>
        setVehicles(data.filter((v) => v.suggestedStage !== "SIGNAL_RETURNED"))
      )
      .catch(console.error)
      .finally(() => setLoadingVehicles(false));

  }, []);

  async function handleConnectMicrosoft() {
    try {
      const { url } = await getMicrosoftAuthUrl();
      window.location.href = url;
    } catch (err) {
      toast.error(err.message || "Erro ao obter URL de autenticação");
    }
  }

  async function handleDisconnect() {
    try {
      await disconnectMicrosoft();
      setMsStatus({ connected: false, email: null, name: null });
      toast.success("Conta Microsoft desconectada");
    } catch (err) {
      toast.error(err.message || "Erro ao desconectar");
    }
  }

  function fmtDateLabel(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }

  async function handlePreview() {
    if (!dataEntrada || !dataSaida || !toEmail) {
      toast.error("Preencha data de entrada, saída e destinatário");
      return;
    }
    setLoadingPreview(true);
    try {
      const req = buildRequest(
        fmtDateLabel(dataEntrada),
        fmtDateLabel(dataSaida),
        toEmail,
        vehicles,
        tracknme
      );
      const { html } = await previewShiftHandover(req);
      setPreviewHtml(html);
    } catch (err) {
      toast.error(err.message || "Erro ao gerar preview");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleCreateDraft() {
    if (!dataEntrada || !dataSaida || !toEmail) {
      toast.error("Preencha data de entrada, saída e destinatário");
      return;
    }
    setCreating(true);
    try {
      const req = buildRequest(
        fmtDateLabel(dataEntrada),
        fmtDateLabel(dataSaida),
        toEmail,
        vehicles,
        tracknme
      );
      const result = await createShiftHandoverDraft(req);
      setDraftResult(result);
      toast.success("Rascunho criado no Outlook!");
    } catch (err) {
      toast.error(err.message || "Erro ao criar rascunho");
    } finally {
      setCreating(false);
    }
  }

  const casosCount = vehicles.filter(
    (v) => v.lastObservation?.text !== EXCLUDED_OBS
  ).length;

  function downloadBlob(bytes, filename, mimeType) {
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDownloadEml() {
    if (!dataEntrada || !dataSaida || !toEmail) {
      toast.error("Preencha data de entrada, saída e destinatário");
      return;
    }
    try {
      const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
      const token = localStorage.getItem("fusion_token");
      const req = buildRequest(
        fmtDateLabel(dataEntrada),
        fmtDateLabel(dataSaida),
        toEmail,
        vehicles,
        tracknme
      );
      const response = await fetch(`${API_BASE}/outlook/eml/passagem-turno`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(req),
      });
      if (!response.ok) throw new Error("Erro ao gerar EML");
      const bytes = await response.arrayBuffer();
      const today = fmtDateLabel(dataEntrada).replaceAll("/", "-");
      downloadBlob(bytes, `passagem-turno-${today}.eml`, "message/rfc822");
    } catch (err) {
      toast.error(err.message || "Erro ao baixar EML");
    }
  }

  async function handleDownloadZip() {
    try {
      const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
      const token = localStorage.getItem("fusion_token");
      const response = await fetch(`${API_BASE}/outlook/attachments/passagem-turno`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Erro ao gerar ZIP");
      const bytes = await response.arrayBuffer();
      const today = new Date().toLocaleDateString("pt-BR").replaceAll("/", "-");
      downloadBlob(bytes, `planilhas-${today}.zip`, "application/zip");
    } catch (err) {
      toast.error(err.message || "Erro ao baixar planilhas");
    }
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Passagem de Turno</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Gera rascunho de e-mail no Outlook com os dados do turno atual.
        </p>
      </div>

      {/* Microsoft Auth */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

        <h2 className="mb-4 text-base font-semibold">Autenticação Microsoft</h2>

        {loadingMs ? (
          <p className="text-sm text-zinc-500">Verificando...</p>
        ) : msStatus?.connected ? (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-2.5">
              <CheckCircle size={16} className="text-green-400" />
              <span className="text-sm font-semibold text-green-400">
                Conectado como {msStatus.email}
              </span>
            </div>
            <button
              onClick={handleDisconnect}
              className="
                flex items-center gap-2
                rounded-xl border border-zinc-700
                bg-zinc-950 px-4 py-2.5
                text-sm transition hover:bg-zinc-800
              "
            >
              <Unlink size={14} />
              Desconectar
            </button>
          </div>
        ) : (
          <button
            onClick={handleConnectMicrosoft}
            className="
              flex items-center gap-2
              rounded-xl bg-white px-5 py-2.5
              text-sm font-semibold text-black
              transition hover:opacity-90
            "
          >
            <Mail size={16} />
            Conectar com Microsoft
          </button>
        )}

      </div>

      {/* Form */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

        <h2 className="mb-4 text-base font-semibold">Dados do turno</h2>

        <div className="grid gap-4 lg:grid-cols-2">

          <div>
            <label className="text-sm text-zinc-500">Data de entrada</label>
            <input
              type="date"
              value={dataEntrada}
              onChange={(e) => setDataEntrada(e.target.value)}
              className="
                mt-1 w-full rounded-xl border border-zinc-800
                bg-zinc-950 px-4 py-2.5 text-sm outline-none
              "
            />
          </div>

          <div>
            <label className="text-sm text-zinc-500">Data de saída</label>
            <input
              type="date"
              value={dataSaida}
              onChange={(e) => setDataSaida(e.target.value)}
              className="
                mt-1 w-full rounded-xl border border-zinc-800
                bg-zinc-950 px-4 py-2.5 text-sm outline-none
              "
            />
          </div>

          <div className="lg:col-span-2">
            <label className="text-sm text-zinc-500">Para (e-mail do destinatário)</label>
            <input
              type="email"
              placeholder="destinatario@usebens.com.br"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              className="
                mt-1 w-full rounded-xl border border-zinc-800
                bg-zinc-950 px-4 py-2.5 text-sm outline-none
                placeholder:text-zinc-600
              "
            />
          </div>

          <div className="lg:col-span-2">
            <label className="text-sm text-zinc-500">
              TRACKNME MAX — placas (uma por linha)
            </label>
            <textarea
              rows={4}
              placeholder={"ABC1A23\nDEF4B56"}
              value={tracknme}
              onChange={(e) => setTracknme(e.target.value)}
              className="
                mt-1 w-full rounded-xl border border-zinc-800
                bg-zinc-950 px-4 py-2.5 text-sm outline-none
                placeholder:text-zinc-600 font-mono
                resize-y
              "
            />
          </div>

        </div>

      </div>

      {/* Vehicles */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">
            Veículos do Controle de Sinais
            <span className="ml-2 text-sm font-normal text-zinc-500">
              {loadingVehicles ? "..." : `${casosCount} casos para verificação`}
            </span>
          </h2>
          <button
            onClick={() => {
              setLoadingVehicles(true);
              getSignalControl(false)
                .then((data) =>
                  setVehicles(data.filter((v) => v.suggestedStage !== "SIGNAL_RETURNED"))
                )
                .catch(console.error)
                .finally(() => setLoadingVehicles(false));
            }}
            className="rounded-xl border border-zinc-700 bg-zinc-950 p-2 transition hover:bg-zinc-800"
            title="Atualizar"
          >
            <RefreshCw size={14} className={loadingVehicles ? "animate-spin" : ""} />
          </button>
        </div>

        {loadingVehicles ? (
          <p className="text-sm text-zinc-500">Carregando...</p>
        ) : vehicles.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum veículo com atraso.</p>
        ) : (
          <div className="max-h-64 overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-zinc-900">
                <tr className="text-left text-xs text-zinc-500">
                  <th className="pb-2 pr-4">Placa</th>
                  <th className="pb-2 pr-4">Última posição</th>
                  <th className="pb-2 pr-4">Fim vigência</th>
                  <th className="pb-2">Observação</th>
                  <th className="pb-2 text-right">No e-mail</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => {
                  const excluded = v.lastObservation?.text === EXCLUDED_OBS;
                  return (
                    <tr
                      key={v.plate}
                      className={`border-t border-zinc-800 ${excluded ? "opacity-40" : ""}`}
                    >
                      <td className="py-2 pr-4 font-mono font-semibold">{v.plate}</td>
                      <td className="py-2 pr-4 text-zinc-400">
                        {v.lastCommunicationAt
                          ? formatDateTimeForExport(v.lastCommunicationAt)
                          : "--"}
                      </td>
                      <td className="py-2 pr-4 text-zinc-400">
                        {v.policyEndDate ? fmtDate(v.policyEndDate) : "--"}
                      </td>
                      <td className="max-w-xs truncate py-2 text-zinc-400">
                        {v.lastObservation?.text || "--"}
                      </td>
                      <td className="py-2 text-right">
                        {excluded ? (
                          <span className="text-xs text-zinc-600">excluído</span>
                        ) : (
                          <span className="text-xs text-green-400">✓</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-xs text-zinc-500">
          Veículos com observação &quot;{EXCLUDED_OBS}&quot; são excluídos automaticamente do e-mail.
        </p>

      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">

        <button
          onClick={handlePreview}
          disabled={loadingPreview}
          className="
            flex items-center gap-2
            rounded-xl border border-zinc-700
            bg-zinc-950 px-5 py-2.5
            text-sm font-semibold
            transition hover:bg-zinc-800
            disabled:opacity-50
          "
        >
          <Mail size={16} />
          {loadingPreview ? "Gerando..." : "Preview do e-mail"}
        </button>

        <button
          onClick={handleCreateDraft}
          disabled={creating || !msStatus?.connected}
          title={!msStatus?.connected ? "Conecte sua conta Microsoft primeiro" : undefined}
          className="
            flex items-center gap-2
            rounded-xl bg-white px-5 py-2.5
            text-sm font-semibold text-black
            transition hover:opacity-90
            disabled:opacity-50
          "
        >
          <Send size={16} />
          {creating ? "Criando..." : "Criar Rascunho no Outlook"}
        </button>

      </div>

      {/* Draft result */}
      {draftResult?.success && (
        <div className="flex items-center justify-between rounded-2xl border border-green-500/30 bg-green-500/10 p-5">
          <div className="flex items-center gap-3">
            <CheckCircle size={20} className="text-green-400" />
            <div>
              <p className="font-semibold text-green-400">Rascunho criado com sucesso!</p>
              <p className="text-sm text-zinc-400">
                Abra o Outlook para revisar e enviar.
              </p>
            </div>
          </div>
          <a
            href={draftResult.webLink || "https://outlook.office.com/mail/drafts"}
            target="_blank"
            rel="noreferrer"
            className="
              flex items-center gap-2
              rounded-xl border border-green-500/40
              bg-green-500/10 px-4 py-2.5
              text-sm font-semibold text-green-400
              transition hover:bg-green-500/20
            "
          >
            <ExternalLink size={14} />
            Abrir Outlook
          </a>
        </div>
      )}

      {/* Alternativa sem Microsoft */}
      <div className="rounded-2xl border border-zinc-700 bg-zinc-900/50 p-6">

        <h2 className="mb-1 text-base font-semibold">Alternativa sem autenticação Microsoft</h2>
        <p className="mb-4 text-sm text-zinc-500">
          Baixe o rascunho de e-mail e as planilhas localmente para importar manualmente no Outlook.
        </p>

        <div className="flex flex-wrap gap-3">

          <button
            onClick={handleDownloadEml}
            className="
              flex items-center gap-2
              rounded-xl border border-zinc-700
              bg-zinc-950 px-5 py-2.5
              text-sm font-semibold
              transition hover:bg-zinc-800
            "
          >
            <Download size={16} />
            Baixar Rascunho (.eml)
          </button>

          <button
            onClick={handleDownloadZip}
            className="
              flex items-center gap-2
              rounded-xl border border-zinc-700
              bg-zinc-950 px-5 py-2.5
              text-sm font-semibold
              transition hover:bg-zinc-800
            "
          >
            <Archive size={16} />
            Baixar Planilhas (.zip)
          </button>

        </div>

        <p className="mt-3 text-xs text-zinc-600">
          O ZIP inclui: SINAIS (sempre) · MULTIPORTAL (sempre) · Cartas de Suspensão (se houver ativas) · Manutenções (se houver abertas)
        </p>

      </div>

      {/* Preview */}
      {previewHtml && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-4 text-base font-semibold">Preview do e-mail</h2>
          <iframe
            srcDoc={previewHtml}
            title="Preview do e-mail"
            className="h-[600px] w-full rounded-xl border border-zinc-700 bg-white"
          />
        </div>
      )}

    </div>
  );

}
