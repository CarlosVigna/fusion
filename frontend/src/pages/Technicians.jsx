import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import {
  getTechnicians,
  createTechnician,
  updateTechnician,
  deleteTechnician,
} from "../services/technicianService";
import { useAuthStore } from "../store/authStore";
import toast from "react-hot-toast";

const EMPTY = {
  name: "", phone: "", zipCode: "", address: "", neighborhood: "",
  city: "", state: "", defaultServiceValue: "",
};

const GEOCODE_KEY = "6a767720c9a23759209230ybg19c2d3";
async function geocode(address) {
  try {
    const url = `https://geocode.maps.co/search?q=${encodeURIComponent(address)}&api_key=${GEOCODE_KEY}&countrycodes=br&limit=1`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.length > 0) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    return null;
  } catch { return null; }
}

async function fetchCep(cep) {
  const clean = cep.replace(/\D/g, "");
  if (clean.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return data;
  } catch { return null; }
}

export default function Technicians() {
  const { user } = useAuthStore();
  const isReadOnly = user?.role === "FIELD" || user?.role === "TECHNICIAN";

  const [technicians, setTechnicians] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try { setTechnicians(await getTechnicians()); } catch (e) { console.error(e); }
  }

  function openCreate() { setForm(EMPTY); setModal({ mode: "create" }); }
  function openEdit(t) {
    setForm({
      name: t.name ?? "", phone: t.phone ?? "", zipCode: t.zipCode ?? "",
      address: t.address ?? "", neighborhood: t.neighborhood ?? "",
      city: t.city ?? "", state: t.state ?? "",
      defaultServiceValue: t.defaultServiceValue ?? "",
    });
    setModal({ mode: "edit", id: t.id });
  }
  function closeModal() { setModal(null); }

  async function handleCepChange(val) {
    setForm(f => ({ ...f, zipCode: val }));
    const clean = val.replace(/\D/g, "");
    if (clean.length === 8) {
      setCepLoading(true);
      const data = await fetchCep(val);
      setCepLoading(false);
      if (data) {
        setForm(f => ({
          ...f,
          address: data.logradouro || f.address,
          neighborhood: data.bairro || f.neighborhood,
          city: data.localidade || f.city,
          state: data.uf || f.state,
        }));
      }
    }
  }

  async function handleSave() {
    if (!form.name?.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    try {
      const payload = { ...form, defaultServiceValue: form.defaultServiceValue || null };

      const addressParts = [form.address, form.city, form.state].filter(Boolean);
      if (addressParts.length > 0) {
        const coords = await geocode(addressParts.join(", "));
        if (coords) {
          payload.latitude = coords.lat;
          payload.longitude = coords.lon;
        }
      }

      if (modal.mode === "create") await createTechnician(payload);
      else await updateTechnician(modal.id, payload);
      toast.success(modal.mode === "create" ? "Técnico criado" : "Técnico atualizado");
      closeModal();
      await load();
    } catch {
      toast.error("Erro ao salvar técnico");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Desativar este técnico?")) return;
    try { await deleteTechnician(id); toast.success("Técnico desativado"); await load(); }
    catch { toast.error("Erro ao desativar"); }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Técnicos</h1>
          <p className="text-zinc-400 mt-1">{technicians.length} técnico(s) ativo(s)</p>
        </div>
        {!isReadOnly && (
          <button onClick={openCreate}
            className="flex items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-zinc-200">
            <Plus size={16} /> Novo Técnico
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500 uppercase tracking-wider">
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Telefone</th>
              <th className="px-4 py-3">Endereço</th>
              <th className="px-4 py-3">Cidade/UF</th>
              <th className="px-4 py-3">Valor Padrão</th>
              <th className="px-4 py-3">Coords</th>
              {!isReadOnly && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {technicians.map((t) => (
              <tr key={t.id} className="border-b border-zinc-900 hover:bg-zinc-900/50">
                <td className="px-4 py-3 font-medium">{t.name}</td>
                <td className="px-4 py-3 text-zinc-400">{t.phone || "—"}</td>
                <td className="px-4 py-3 text-zinc-400 text-xs">
                  {[t.address, t.neighborhood].filter(Boolean).join(", ") || "—"}
                </td>
                <td className="px-4 py-3 text-zinc-400">{t.city}{t.state ? `/${t.state}` : ""}</td>
                <td className="px-4 py-3 text-zinc-400">{t.defaultServiceValue ? `R$ ${t.defaultServiceValue}` : "—"}</td>
                <td className="px-4 py-3 text-zinc-500 text-xs">
                  {t.latitude ? `${t.latitude.toFixed(4)}, ${t.longitude.toFixed(4)}` : "—"}
                </td>
                {!isReadOnly && (
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => openEdit(t)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"><Pencil size={14} /></button>
                      <button onClick={() => handleDelete(t.id)} className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 size={14} /></button>
                    </div>
                  </td>
                )}
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
              <div style={{ gridColumn: "span 2" }}>
                <label className="block text-xs text-zinc-400 mb-1">Nome *</label>
                <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-600 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Telefone</label>
                <input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-600 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  CEP {cepLoading && <span className="text-zinc-500">(buscando...)</span>}
                </label>
                <input value={form.zipCode} onChange={e => handleCepChange(e.target.value)} maxLength={9}
                  placeholder="00000-000"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-600 focus:outline-none" />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label className="block text-xs text-zinc-400 mb-1">Logradouro</label>
                <input value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-600 focus:outline-none" />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label className="block text-xs text-zinc-400 mb-1">Bairro</label>
                <input value={form.neighborhood} onChange={e => setForm(f => ({...f, neighborhood: e.target.value}))}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-600 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Cidade</label>
                <input value={form.city} onChange={e => setForm(f => ({...f, city: e.target.value}))}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-600 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">UF</label>
                <input value={form.state} onChange={e => setForm(f => ({...f, state: e.target.value}))} maxLength={2}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-600 focus:outline-none" />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label className="block text-xs text-zinc-400 mb-1">Valor Padrão (R$)</label>
                <input type="number" value={form.defaultServiceValue} onChange={e => setForm(f => ({...f, defaultServiceValue: e.target.value}))}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-600 focus:outline-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={closeModal} className="rounded-xl border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900">Cancelar</button>
              <button onClick={handleSave} disabled={saving}
                className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-zinc-200 disabled:opacity-50">
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
