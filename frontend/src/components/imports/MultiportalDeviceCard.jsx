import { useState } from "react";

import {
  previewMultiportalDevice,
  confirmMultiportalDevice,
} from "../../services/multiportalDeviceService";

import ImportSummaryCards from "./ImportSummaryCards";

import ImportPreviewTable from "./ImportPreviewTable";

export default function MultiportalDeviceCard() {
  const [file, setFile] =
    useState(null);

  const [preview, setPreview] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  async function handlePreview() {
    try {
      setLoading(true);

      const response =
        await previewMultiportalDevice(
          file
        );

      setPreview(response);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    try {
      const items =
        preview.items.map((item) => ({
          identifier: item.plate,

          action: item.type,

          fields: [],
        }));

      await confirmMultiportalDevice(
        items
      );

      alert(
        "Importação confirmada"
      );

      setPreview(null);

      setFile(null);
    } catch (error) {
      console.error(error);
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
        <h2 className="text-xl font-semibold">
          Multiportal Device
        </h2>

        <p className="mt-1 text-sm text-zinc-500">
          Importação de dispositivos
        </p>
      </div>

      <input
        type="file"
        onChange={(e) =>
          setFile(
            e.target.files[0]
          )
        }
        className="mt-6"
      />

      <button
        onClick={handlePreview}
        disabled={!file || loading}
        className="
          mt-4 rounded-2xl
          bg-white px-5 py-3
          font-semibold text-black
        "
      >
        {loading
          ? "Processando..."
          : "Gerar Preview"}
      </button>

      {preview && (
        <div className="mt-6 space-y-6">
          <ImportSummaryCards
            preview={preview}
          />

          <ImportPreviewTable
            preview={preview}
          />

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
    </div>
  );
}