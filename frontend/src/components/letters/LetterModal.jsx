import { useState } from "react";

import toast from "react-hot-toast";

import { X } from "lucide-react";

import { useAuthStore } from "../../store/authStore";

import { getVehicleByPlate } from "../../services/vehicleService";

import {
  createLetter,
  updateLetter,
} from "../../services/letterService";

export default function LetterModal({
  letter,
  onClose,
  onSaved,
}) {

  const user = useAuthStore((state) => state.user);

  const [form, setForm] = useState({
    plate: letter?.plate || "",
    insuredName: letter?.insuredName || "",
    base: letter?.base || "",
    modelo: letter?.modelo || "",
    ultimaPosicao: letter?.ultimaPosicao || "",
    dataEnvio: letter?.dataEnvio || "",
    fimVigencia: letter?.fimVigencia || "",
    osAberta: letter?.osAberta || "NÃO",
    dataRetornoSinal: letter?.dataRetornoSinal || "Sem retorno.",
    operador: letter?.operador || user?.name || "",
  });

  const [saving, setSaving] = useState(false);

  const [lookingUp, setLookingUp] = useState(false);

  function setField(field, value) {

    setForm((current) => ({
      ...current,
      [field]: value,
    }));

  }

  async function handlePlateBlur() {

    if (!form.plate || letter) {
      return;
    }

    setLookingUp(true);

    try {

      const vehicle = await getVehicleByPlate(
        form.plate.toUpperCase()
      );

      setForm((current) => ({
        ...current,
        plate: vehicle.plate,
        insuredName: vehicle.insuredName || current.insuredName,
        base: current.base || vehicle.platform || "",
      }));

    } catch (error) {

      console.error(error);

      toast.error("Veículo não encontrado para essa placa");

    } finally {

      setLookingUp(false);

    }

  }

  async function handleSave() {

    if (!form.plate.trim() || !form.dataEnvio) {

      toast.error("Placa e Data do Envio são obrigatórias");

      return;

    }

    setSaving(true);

    try {

      const payload = {
        plate: form.plate.trim().toUpperCase(),
        insuredName: form.insuredName,
        base: form.base,
        modelo: form.modelo,
        ultimaPosicao: form.ultimaPosicao || null,
        dataEnvio: form.dataEnvio,
        fimVigencia: form.fimVigencia || null,
        osAberta: form.osAberta,
        dataRetornoSinal: form.dataRetornoSinal,
        operador: form.operador,
      };

      if (letter) {
        await updateLetter(letter.id, payload);
        toast.success("Carta atualizada");
      } else {
        await createLetter(payload);
        toast.success("Carta registrada");
      }

      onSaved();

      onClose();

    } catch (error) {

      console.error(error);

      toast.error("Erro ao salvar carta");

    } finally {

      setSaving(false);

    }

  }

  return (
    <div
      className="
        fixed inset-0 z-50
        flex items-center justify-center
        overflow-y-auto bg-black/60 p-4
      "
      onClick={onClose}
    >

      <div
        onClick={(e) => e.stopPropagation()}
        className="
          w-full max-w-2xl rounded-2xl
          border border-zinc-800
          bg-zinc-900 p-6
        "
      >

        <div className="flex items-center justify-between">

          <h2 className="text-lg font-semibold">
            {letter ? "Editar carta" : "Nova carta de suspensão"}
          </h2>

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

        <div className="mt-4 grid gap-4 sm:grid-cols-2">

          <Field label="Placa *">
            <input
              type="text"
              disabled={!!letter}
              value={form.plate}
              onChange={(e) => setField("plate", e.target.value)}
              onBlur={handlePlateBlur}
              placeholder={lookingUp ? "Buscando..." : ""}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none disabled:opacity-60"
            />
          </Field>

          <Field label="Segurado">
            <input
              type="text"
              value={form.insuredName}
              onChange={(e) => setField("insuredName", e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none"
            />
          </Field>

          <Field label="Base">
            <input
              type="text"
              value={form.base}
              onChange={(e) => setField("base", e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none"
            />
          </Field>

          <Field label="Modelo">
            <input
              type="text"
              value={form.modelo}
              onChange={(e) => setField("modelo", e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none"
            />
          </Field>

          <Field label="Última posição">
            <input
              type="date"
              value={form.ultimaPosicao}
              onChange={(e) => setField("ultimaPosicao", e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none"
            />
          </Field>

          <Field label="Data do envio *">
            <input
              type="date"
              value={form.dataEnvio}
              onChange={(e) => setField("dataEnvio", e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none"
            />
          </Field>

          <Field label="Fim da vigência">
            <input
              type="date"
              value={form.fimVigencia}
              onChange={(e) => setField("fimVigencia", e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none"
            />
          </Field>

          <Field label="OS aberta">
            <select
              value={form.osAberta}
              onChange={(e) => setField("osAberta", e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none"
            >
              <option value="NÃO">NÃO</option>
              <option value="SIM">SIM</option>
            </select>
          </Field>

          <Field label="Data do retorno de sinal">
            <input
              type="text"
              value={form.dataRetornoSinal}
              onChange={(e) => setField("dataRetornoSinal", e.target.value)}
              placeholder="Sem retorno."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none"
            />
          </Field>

          <Field label="Operador">
            <input
              type="text"
              value={form.operador}
              onChange={(e) => setField("operador", e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none"
            />
          </Field>

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
            disabled={saving}
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

function Field({ label, children }) {

  return (
    <label className="block">

      <span className="mb-1.5 block text-xs text-zinc-500">
        {label}
      </span>

      {children}

    </label>
  );

}
