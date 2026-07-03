import { useState } from "react";

import {
  previewMultiportalDevice,
  confirmMultiportalDevice,
} from "../../services/multiportalDeviceService";

import { uploadUltimaPosicao } from "../../services/importService";

import ImportSummaryCards from "./ImportSummaryCards";
import ImportPreviewTable from "./ImportPreviewTable";

const TIPOS = [
  { value: "dispositivos", label: "Dispositivos" },
  { value: "ultima_posicao", label: "Última Posição" },
];

export default function MultiportalDeviceCard() {
  const [tipo, setTipo] = useState("dispositivos");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  function handleTipoChange(e) {
    setTipo(e.target.value);
    setFile(null);
    setPreview(null);
    setUploadResult(null);
    setUploadError(null);
  }

  async function handlePreview() {
    try {
      setLoading(true);
      const response = await previewMultiportalDevice(file);
      setPreview(response);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    try {
      const items = preview.items.map((item) => ({
        identifier: item.plate,
        action: item.type,
        fields: [],
      }));
      await confirmMultiportalDevice(items);
      alert("Importação confirmada");
      setPreview(null);
      setFile(null);
    } catch (error) {
      console.error(error);
    }
  }

  async function handleUploadUltimaPosicao() {
    try {
      setLoading(true);
      setUploadResult(null);
      setUploadError(null);
      const response = await uploadUltimaPosicao(file);
      setUploadResult(response);
      setFile(null);
    } catch (error) {
      console.error(error);
      setUploadError("Erro ao enviar arquivo. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="
        rounded-2xl border
        border-zinc-800
        bg-zinc-900 p-6
      "
    >
      <div>
        <h2 className="text-xl font-semibold">Multiportal</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Importação manual de arquivo XLS
        </p>
      </div>

      {/* Tipo dropdown */}
      <div className="mt-6">
        <label className="mb-1 block text-sm text-zinc-400">
          Tipo de arquivo
        </label>
        <select
          value={tipo}
          onChange={handleTipoChange}
          className="
            w-full rounded-xl border border-zinc-700
            bg-zinc-800 px-4 py-2.5 text-sm text-white
            focus:outline-none focus:ring-2 focus:ring-white/20
          "
        >
          {TIPOS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <input
        key={tipo}
        type="file"
        accept=".xls,.xlsx"
        onChange={(e) => {
          setFile(e.target.files[0]);
          setPreview(null);
          setUploadResult(null);
          setUploadError(null);
        }}
        className="mt-6"
      />

      {/* Dispositivos flow */}
      {tipo === "dispositivos" && (
        <>
          <button
            onClick={handlePreview}
            disabled={!file || loading}
            className="
              mt-4 rounded-2xl
              bg-white px-5 py-3
              font-semibold text-black
              disabled:opacity-40
            "
          >
            {loading ? "Processando..." : "Gerar Preview"}
          </button>

          {preview && (
            <div className="mt-6 space-y-6">
              <ImportSummaryCards preview={preview} />
              <ImportPreviewTable preview={preview} />
              <button
                onClick={handleConfirm}
                className="
                  rounded-2xl bg-green-500
                  px-5 py-3 font-semibold
                  text-white
                "
              >
                Confirmar Importação
              </button>
            </div>
          )}
        </>
      )}

      {/* Última Posição flow */}
      {tipo === "ultima_posicao" && (
        <>
          <button
            onClick={handleUploadUltimaPosicao}
            disabled={!file || loading}
            className="
              mt-4 rounded-2xl
              bg-white px-5 py-3
              font-semibold text-black
              disabled:opacity-40
            "
          >
            {loading ? "Enviando..." : "Enviar Arquivo"}
          </button>

          {uploadError && (
            <p className="mt-4 text-sm text-red-400">{uploadError}</p>
          )}

          {uploadResult && (
            <div className="mt-6 rounded-xl border border-zinc-700 bg-zinc-800 p-4 space-y-2">
              <p className="text-sm font-semibold text-white">
                Resultado da importação
              </p>
              <div className="flex gap-6 text-sm">
                <div>
                  <p className="text-zinc-400">Atualizados</p>
                  <p className="text-2xl font-bold text-green-400">
                    {uploadResult.updatedVehicles}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-400">Não encontrados</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    {uploadResult.notFoundVehicles}
                  </p>
                </div>
              </div>
              {uploadResult.notFoundPlates?.length > 0 && (
                <div className="mt-2">
                  <p className="mb-1 text-xs text-zinc-400">
                    Placas não encontradas:
                  </p>
                  <p className="text-xs text-zinc-300">
                    {uploadResult.notFoundPlates.join(", ")}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
