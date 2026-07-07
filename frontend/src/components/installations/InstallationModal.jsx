import { useState } from "react";

import toast from "react-hot-toast";

import { X } from "lucide-react";

import { useAuthStore } from "../../store/authStore";

import { createInstallation } from "../../services/installationService";

export default function InstallationModal({ onClose, onSaved }) {

  const user = useAuthStore((state) => state.user);

  const [form, setForm] = useState({
    externalId: "",
    customerName: "",
    address: "",
    neighborhood: "",
    city: "",
    state: "",
    zipCode: "",
    phone: "",
    plate: "",
    serviceType: "INSTALAÇÃO NOVA",
  });

  const [saving, setSaving] = useState(false);

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {

    if (!form.customerName.trim()) {
      toast.error("Nome do cliente é obrigatório");
      return;
    }

    setSaving(true);

    try {

      await createInstallation({
        ...form,
        externalId: form.externalId || null,
        plate: form.plate.toUpperCase() || null,
      });

      toast.success("Instalação registrada");

      onSaved();

      onClose();

    } catch (error) {

      console.error(error);

      toast.error("Erro ao registrar instalação");

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
        className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
      >

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Nova Instalação</h2>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">

          <Field label="Tipo de serviço">
            <input
              type="text"
              value={form.serviceType}
              onChange={(e) => setField("serviceType", e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none"
            />
          </Field>

          <Field label="ID externo (portal parceiro)">
            <input
              type="text"
              value={form.externalId}
              onChange={(e) => setField("externalId", e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none"
            />
          </Field>

          <Field label="Nome do cliente *">
            <input
              type="text"
              value={form.customerName}
              onChange={(e) => setField("customerName", e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none"
            />
          </Field>

          <Field label="Telefone">
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none"
            />
          </Field>

          <Field label="Endereço">
            <input
              type="text"
              value={form.address}
              onChange={(e) => setField("address", e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none"
            />
          </Field>

          <Field label="Bairro">
            <input
              type="text"
              value={form.neighborhood}
              onChange={(e) => setField("neighborhood", e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none"
            />
          </Field>

          <Field label="Cidade">
            <input
              type="text"
              value={form.city}
              onChange={(e) => setField("city", e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none"
            />
          </Field>

          <Field label="Estado">
            <input
              type="text"
              value={form.state}
              onChange={(e) => setField("state", e.target.value)}
              maxLength={2}
              placeholder="SC"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none"
            />
          </Field>

          <Field label="CEP">
            <input
              type="text"
              value={form.zipCode}
              onChange={(e) => setField("zipCode", e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none"
            />
          </Field>

          <Field label="Placa">
            <input
              type="text"
              value={form.plate}
              onChange={(e) => setField("plate", e.target.value.toUpperCase())}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-mono outline-none"
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
