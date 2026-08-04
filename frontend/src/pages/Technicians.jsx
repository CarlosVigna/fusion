import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import {
  getTechnicians,
  createTechnician,
  updateTechnician,
  deleteTechnician,
} from "../services/technicianService";
import toast from "react-hot-toast";

const EMPTY = { name: "", phone: "", address: "", city: "", state: "", zipCode: "", defaultServiceValue: "" };

export default function Technicians() {
  const [technicians, setTechnicians] = useState([]);
  const [modal, setModal] = useState(null); // null | { mode: "create"|"edit", data: {} }
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try { setTechnicians(await getTechnicians()); } catch (e) { console.error(e); }
  }

  function openCreate() { setForm(EMPTY); setModal({ mode: "create" }); }
  function openEdit(t) {
    setForm({ ...t, defaultServiceValue: t.defaultServiceValue ?? "" });
    setModal({ mode: "edit", id: t.id });
  }
  function closeModal() { setModal(null); }

  async function handleSave() {
    if (!form.name?.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    try {
      const payload = { ...form, defaultServiceValue: form.defaultServiceValue || null };
      if (modal.mode === "create") await createTechnician(payload);
      else await updateTechnician(modal.id, payload);
      toast.success(modal.mode === "create" ? "Técnico criado" : "Técnico atualizado");
      closeModal();
      await load();
    } catch (e) {
      toast.error("Erro ao salvar técnico");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Desativar este técnico?")) return;
    try { await deleteTechnician(id); toast.success("Técnico desativado"); await load(); }
    catch (e) { toast.error("Erro ao desativar"); }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Técnicos</h1>
          <p className="text-zinc-400 mt-1">{technicians.length} técnico(s) ativo(s)</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-zinc-200"
        >
          <Plus size={16} /> Novo Técnico
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500 uppercase tracking-wider">
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Telefone</th>
              <th className="px-4 py-3">Cidade/UF</th>
              <th className="px-4 py-3">CEP</th>
              <th className="px-4 py-3">Valor Padrão</th>
              <th className="px-4 py-3">Coords</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {technicians.map((t) => (
              <tr key={t.id} className="border-b border-zinc-900 hover:bg-zinc-900/50">
                <td className="px-4 py-3 font-medium">{t.name}</td>
                <td className="px-4 py-3 text-zinc-400">{t.phone || "—"}</td>
                <td className="px-4 py-3 text-zinc-400">{t.city}{t.state ? `/${t.state}` : ""}</td>
                <td className="px-4 py-3 text-zinc-400">{t.zipCode || "—"}</td>
                <td className="px-4 py-3 text-zinc-400">{t.defaultServiceValue ? `R$ ${t.defaultServiceValue}` : "—"}</td>
                <td className="px-4 py-3 text-zinc-500 text-xs">
                  {t.latitude ? `${t.latitude.toFixed(4)}, ${t.longitude.toFixed(4)}` : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => openEdit(t)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"><Pencil size={14} /></button>
                    <button onClick={() => handleDelete(t.id)} className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {technicians.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-500">Nenhum técnico cadastrado</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{modal.mode === "create" ? "Novo Técnico" : "Editar Técnico"}</h2>
              <button onClick={closeModal}><X size={20} className="text-zinc-400" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["name", "Nome *", 2],
                ["phone", "Telefone", 1],
                ["address", "Endereço", 2],
                ["city", "Cidade", 1],
                ["state", "UF", 1],
                ["zipCode", "CEP", 1],
                ["defaultServiceValue", "Valor Padrão (R$)", 1],
              ].map(([key, label, span]) => (
                <div key={key} style={{ gridColumn: `span ${span}` }}>
                  <label className="block text-xs text-zinc-400 mb-1">{label}</label>
                  <input
                    type={key === "defaultServiceValue" ? "number" : "text"}
                    value={form[key] ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={closeModal} className="rounded-xl border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-zinc-200 disabled:opacity-50">
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
