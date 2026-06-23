import { useState } from "react";

import toast from "react-hot-toast";

import { X } from "lucide-react";

import { useAuthStore } from "../../store/authStore";

import { getVehicleByPlate } from "../../services/vehicleService";

import {
  createMaintenanceRecord,
  updateMaintenanceRecord,
} from "../../services/maintenanceService";

const inputClass =
  "w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none disabled:opacity-60";

export default function MaintenanceModal({
  record,
  onClose,
  onSaved,
}) {

  const user = useAuthStore((state) => state.user);

  const [form, setForm] = useState({
    plate: record?.plate || "",
    insuredName: record?.insuredName || "",
    modelo: record?.modelo || "",
    localPosicao: record?.localPosicao || "",
    cidadeUf: record?.cidadeUf || "",
    data: record?.data || "",
    prazoEncerramento: record?.prazoEncerramento || "",
    base: record?.base || "",
    operador: record?.operador || user?.name || "",
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

    if (!form.plate || record) {
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

    if (!form.plate.trim() || !form.data || !form.prazoEncerramento) {

      toast.error(
        "Placa, Data e Prazo de Encerramento são obrigatórios"
      );

      return;

    }

    setSaving(true);

    try {

      const payload = {
        plate: form.plate.trim().toUpperCase(),
        insuredName: form.insuredName,
        modelo: form.modelo,
        localPosicao: form.localPosicao,
        cidadeUf: form.cidadeUf,
        data: form.data,
        prazoEncerramento: form.prazoEncerramento,
        base: form.base,
        operador: form.operador,
      };

      if (record) {
        await updateMaintenanceRecord(record.id, payload);
        toast.success("Manutenção atualizada");
      } else {
        await createMaintenanceRecord(payload);
        toast.success("Manutenção registrada");
      }

      onSaved();

      onClose();

    } catch (error) {

      console.error(error);

      toast.error("Erro ao salvar manutenção");

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
            {record ? "Editar manutenção" : "Nova manutenção"}
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

          <Field label="Data de entrada *">
            <input
              type="date"
              value={form.data}
              onChange={(e) => setField("data", e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Placa *">
            <input
              type="text"
              disabled={!!record}
              value={form.plate}
              onChange={(e) => setField("plate", e.target.value)}
              onBlur={handlePlateBlur}
              placeholder={lookingUp ? "Buscando..." : ""}
              className={inputClass}
            />
          </Field>

          <Field label="Segurado">
            <input
              type="text"
              value={form.insuredName}
              onChange={(e) => setField("insuredName", e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Modelo">
            <input
              type="text"
              value={form.modelo}
              onChange={(e) => setField("modelo", e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Local / posição">
            <input
              type="text"
              value={form.localPosicao}
              onChange={(e) => setField("localPosicao", e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Cidade - UF">
            <input
              type="text"
              placeholder="Timbó - SC"
              value={form.cidadeUf}
              onChange={(e) => setField("cidadeUf", e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Prazo de encerramento *">
            <input
              type="date"
              value={form.prazoEncerramento}
              onChange={(e) => setField("prazoEncerramento", e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Base">
            <input
              type="text"
              value={form.base}
              onChange={(e) => setField("base", e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Operador">
            <input
              type="text"
              value={form.operador}
              onChange={(e) => setField("operador", e.target.value)}
              className={inputClass}
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
