import { useEffect, useState } from "react";

import toast from "react-hot-toast";

import { X } from "lucide-react";

import { updateScheduling } from "../../services/serviceOrderService";

import { getTechnicians } from "../../services/technicianService";

// Modal simples de vinculo de tecnico/agendamento — NAO existe um
// SchedulingModal reutilizavel hoje (o agendamento em ServiceOrders.jsx
// e' inline, com geocodificacao + calculo de distancia no proprio
// formulario). Esse aqui fica so' com o essencial (tecnico/data/hora/
// valor) — sem distancia/deslocamento, o proprio backend
// (ServiceOrderService.updateScheduling) ja decide sozinho entre
// AGENDADO/AGUARDANDO_APROVACAO conforme o deslocamento calculado (ou
// nao) em outro momento.
export default function SchedulingModal({ serviceOrderId, onClose, onSaved }) {

  const [form, setForm] = useState({
    technicianId: "",
    scheduledDate: "",
    scheduledTime: "",
    serviceValue: "",
  });

  const [saving, setSaving] = useState(false);

  const [technicians, setTechnicians] = useState([]);

  useEffect(() => {
    getTechnicians()
      .then((data) => setTechnicians(Array.isArray(data) ? data : []))
      .catch((error) => console.error(error));
  }, []);

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {

    if (!form.technicianId) {
      toast.error("Selecione um técnico");
      return;
    }

    setSaving(true);

    try {

      await updateScheduling(serviceOrderId, {
        technicianId: form.technicianId,
        scheduledDate: form.scheduledDate || null,
        scheduledTime: form.scheduledTime || null,
        serviceValue: form.serviceValue ? Number(form.serviceValue) : null,
      });

      toast.success("Técnico vinculado");

      onSaved();

      onClose();

    } catch (error) {

      console.error(error);

      toast.error("Erro ao vincular técnico");

    } finally {

      setSaving(false);

    }

  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
      >

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Vincular Técnico</h2>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 space-y-4">

          <Field label="Técnico *">
            <select
              value={form.technicianId}
              onChange={(e) => setField("technicianId", e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none"
            >
              <option value="">Selecione...</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Data">
              <input
                type="date"
                value={form.scheduledDate}
                onChange={(e) => setField("scheduledDate", e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none"
              />
            </Field>
            <Field label="Hora">
              <input
                type="time"
                value={form.scheduledTime}
                onChange={(e) => setField("scheduledTime", e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none"
              />
            </Field>
          </div>

          <Field label="Valor do serviço (R$)">
            <input
              type="number"
              value={form.serviceValue}
              onChange={(e) => setField("serviceValue", e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none"
            />
          </Field>

        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
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
      <span className="mb-1.5 block text-xs text-zinc-500">{label}</span>
      {children}
    </label>
  );
}
