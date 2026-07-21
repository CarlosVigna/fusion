import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Pencil, Plus, UserX, X } from "lucide-react";
import { createUser, deactivateUser, getUsers, updateUser } from "../services/userService";

const ROLES = [
  { value: "ADMIN",    label: "Administrador" },
  { value: "OPERATOR", label: "Operador" },
];

const EMPTY_FORM = { name: "", email: "", password: "", role: "OPERATOR" };

function roleBadge(role) {
  return role === "ADMIN"
    ? "bg-blue-950/60 text-blue-300 border border-blue-800/50"
    : "bg-zinc-800 text-zinc-300 border border-zinc-700";
}

function Modal({ user, onClose, onSaved }) {
  const isEdit = !!user;
  const [form, setForm] = useState(isEdit
    ? { name: user.name, email: user.email, password: "", role: user.role }
    : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Nome e e-mail são obrigatórios");
      return;
    }
    if (!isEdit && !form.password.trim()) {
      toast.error("Senha obrigatória ao criar usuário");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      if (isEdit && !payload.password) delete payload.password;
      const saved = isEdit
        ? await updateUser(user.id, payload)
        : await createUser(payload);
      toast.success(isEdit ? "Usuário atualizado" : "Usuário criado");
      onSaved(saved);
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <h2 className="text-base font-semibold text-white">
            {isEdit ? "Editar Usuário" : "Novo Usuário"}
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Nome</label>
            <input
              value={form.name}
              onChange={e => set("name", e.target.value)}
              placeholder="Nome completo"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">E-mail</label>
            <input
              type="email"
              value={form.email}
              onChange={e => set("email", e.target.value)}
              placeholder="email@empresa.com"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Senha{isEdit && <span className="ml-1 text-zinc-500">(deixar em branco para manter)</span>}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={e => set("password", e.target.value)}
              placeholder={isEdit ? "Nova senha (opcional)" : "Senha de acesso"}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Perfil</label>
            <select
              value={form.role}
              onChange={e => set("role", e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-600"
            >
              {ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar usuário"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | { user?: object }
  const [deactivating, setDeactivating] = useState(null);

  async function load() {
    try {
      const data = await getUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function onSaved(saved) {
    if (!saved || !saved.id) {
      load();
      setModal(null);
      return;
    }
    setUsers(prev => {
      const idx = prev.findIndex(u => u.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
    setModal(null);
  }

  async function handleDeactivate(id) {
    if (deactivating === id) {
      try {
        await deactivateUser(id);
        setUsers(prev => prev.map(u => u.id === id ? { ...u, active: false } : u));
        toast.success("Usuário desativado");
      } catch {
        toast.error("Erro ao desativar");
      } finally {
        setDeactivating(null);
      }
    } else {
      setDeactivating(id);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-white">
      {modal && (
        <Modal
          user={modal.user}
          onClose={() => setModal(null)}
          onSaved={onSaved}
        />
      )}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuários</h1>
          <p className="mt-0.5 text-sm text-zinc-400">Gerenciamento de acesso ao sistema</p>
        </div>
        <button
          onClick={() => setModal({})}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500"
        >
          <Plus size={16} /> Novo Usuário
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-900">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400">Nome</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400">E-mail</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400">Perfil</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400">Status</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-zinc-400">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {loading && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-zinc-500">
                  Carregando…
                </td>
              </tr>
            )}
            {!loading && (users || []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-zinc-500">
                  Nenhum usuário cadastrado
                </td>
              </tr>
            )}
            {(users || []).filter(u => u && u.id).map(u => (
              <tr key={u.id} className={`transition hover:bg-zinc-900/50 ${!u.active ? "opacity-50" : ""}`}>
                <td className="px-5 py-3 font-medium text-white">{u.name}</td>
                <td className="px-5 py-3 text-zinc-400">{u.email}</td>
                <td className="px-5 py-3">
                  <span className={`inline-block rounded-lg px-2.5 py-0.5 text-xs font-semibold ${roleBadge(u.role)}`}>
                    {u.role === "ADMIN" ? "Administrador" : "Operador"}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                    u.active
                      ? "bg-emerald-950/50 text-emerald-400"
                      : "bg-zinc-800 text-zinc-500"
                  }`}>
                    {u.active ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setModal({ user: u })}
                      title="Editar"
                      className="rounded-lg border border-zinc-700 p-1.5 text-zinc-400 hover:border-zinc-500 hover:text-white"
                    >
                      <Pencil size={14} />
                    </button>
                    {u.active && (
                      <button
                        onClick={() => handleDeactivate(u.id)}
                        title={deactivating === u.id ? "Clique novamente para confirmar" : "Desativar usuário"}
                        className={`rounded-lg border p-1.5 transition ${
                          deactivating === u.id
                            ? "border-red-700 bg-red-950/40 text-red-400"
                            : "border-zinc-700 text-zinc-400 hover:border-red-700 hover:text-red-400"
                        }`}
                      >
                        <UserX size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deactivating && (
        <p className="mt-3 text-center text-xs text-zinc-500">
          Clique novamente no ícone de desativar para confirmar
        </p>
      )}
    </div>
  );
}
