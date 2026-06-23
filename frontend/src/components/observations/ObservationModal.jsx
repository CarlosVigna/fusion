import { useState } from "react";

import toast from "react-hot-toast";

import { X } from "lucide-react";

import { createObservation } from "../../services/observationService";

const SUGGESTED_TAGS = [
  "#COMANDOENVIADO",
  "#MENSAGEMSEGURADO",
  "#CARTASUSPENSAO",
  "#MANUTENCAO",
  "#SINALRETORNOU",
  "#AGUARDANDO",
  "#RESOLVIDO",
];

export default function ObservationModal({
  plate,
  onClose,
  onSaved,
}) {

  const [text, setText] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  function appendTag(tag) {

    setText((current) =>
      current
        ? `${current} ${tag}`
        : tag
    );

  }

  async function handleSave() {

    if (!text.trim()) {
      return;
    }

    setSaving(true);

    try {

      const observation =
        await createObservation(plate, text.trim());

      toast.success("Observação registrada");

      onSaved?.(observation);

      onClose();

    } catch (error) {

      console.error(error);

      toast.error("Erro ao registrar observação");

    } finally {

      setSaving(false);

    }

  }

  return (
    <div
      className="
        fixed inset-0 z-50
        flex items-center justify-center
        bg-black/60 p-4
      "
      onClick={onClose}
    >

      <div
        onClick={(e) => e.stopPropagation()}
        className="
          w-full max-w-lg rounded-2xl
          border border-zinc-800
          bg-zinc-900 p-6
        "
      >

        <div className="flex items-center justify-between">

          <div>

            <h2 className="text-lg font-semibold">
              Nova observação
            </h2>

            <p className="text-sm text-zinc-500">
              {plate}
            </p>

          </div>

          <button
            onClick={onClose}
            className="
              rounded-xl p-2 text-zinc-400
              transition hover:bg-zinc-800 hover:text-white
            "
          >
            <X size={18} />
          </button>

        </div>

        <textarea
          autoFocus
          rows={4}
          placeholder="Descreva o que foi feito..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="
            mt-4 w-full rounded-xl border
            border-zinc-800 bg-zinc-950
            px-4 py-3 text-sm outline-none
            placeholder:text-zinc-600
          "
        />

        <div className="mt-3 flex flex-wrap gap-2">

          {SUGGESTED_TAGS.map((tag) => (

            <button
              key={tag}
              onClick={() => appendTag(tag)}
              className="
                rounded-full border border-zinc-700
                bg-zinc-950 px-3 py-1.5
                text-xs font-medium text-zinc-300
                transition hover:bg-zinc-800 hover:text-white
              "
            >
              {tag}
            </button>

          ))}

        </div>

        <div className="mt-6 flex justify-end gap-3">

          <button
            onClick={onClose}
            className="
              rounded-2xl border border-zinc-700
              px-5 py-3 text-sm font-semibold
              text-zinc-400 transition
              hover:bg-zinc-800 hover:text-white
            "
          >
            Cancelar
          </button>

          <button
            onClick={handleSave}
            disabled={saving || !text.trim()}
            className="
              rounded-2xl bg-white px-6 py-3
              text-sm font-semibold text-black
              transition hover:opacity-90
              disabled:opacity-50
            "
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>

        </div>

      </div>

    </div>
  );
}
