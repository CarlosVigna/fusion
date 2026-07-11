import { useEffect, useMemo, useState } from "react";

import toast from "react-hot-toast";

import { Pencil, Plus, Trash2 } from "lucide-react";

import {
  createPolicy,
  deletePolicy,
  getPendingVehicles,
  getPolicies,
  updatePolicy,
} from "../services/policyService";

const EMPTY_FORM = {
  policyNumber: "",
  startDate: "",
  endDate: "",
  insuredName: "",
  cpfCnpj: "",
  vehicleModel: "",
};

function formatDate(dateStr) {
  if (!dateStr) return "--";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function daysRemaining(endDate) {
  if (!endDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(`${endDate}T00:00:00`) - today) / 86400000);
}

function daysLabel(days) {
  if (days === null) return "--";
  if (days < 0) return "Vencida";
  if (days === 0) return "Vence hoje";
  return `${days} dia${days !== 1 ? "s" : ""}`;
}

function daysBadgeClass(days) {
  if (days === null) return "bg-zinc-700/40 text-zinc-400";
  if (days < 0) return "bg-red-500/15 text-red-400";
  if (days <= 30) return "bg-yellow-500/15 text-yellow-400";
  return "bg-green-500/15 text-green-400";
}

const STATUS_LABEL = {
  ACTIVE: "Ativa",
  EXPIRING: "Vencendo",
  FUTURE: "Futura",
  EXPIRED: "Vencida",
  CANCELLED: "Cancelada",
};

const STATUS_CLASS = {
  ACTIVE: "bg-green-500/15 text-green-400",
  EXPIRING: "bg-yellow-500/15 text-yellow-400",
  FUTURE: "bg-blue-500/15 text-blue-400",
  EXPIRED: "bg-red-500/15 text-red-400",
  CANCELLED: "bg-zinc-700/40 text-zinc-400",
};

function StatusBadge({ status }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        STATUS_CLASS[status] || "bg-zinc-700/40 text-zinc-400"
      }`}
    >
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export default function Policies() {

  const [tab, setTab] = useState("pending");
  const [policies, setPolicies] = useState([]);
  const [pendingVehicles, setPendingVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editPolicy, setEditPolicy] = useState(null);
  const [modalPlate, setModalPlate] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [pol, pend] = await Promise.all([
        getPolicies(),
        getPendingVehicles(),
      ]);
      setPolicies(pol);
      setPendingVehicles(pend);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar apólices");
    } finally {
      setLoading(false);
    }
  }

  const activePolicies = useMemo(
    () =>
      policies
        .filter(
          (p) =>
            p.status === "ACTIVE" ||
            p.status === "FUTURE" ||
            p.status === "EXPIRING"
        )
        .sort((a, b) => {
          if (!a.endDate) return 1;
          if (!b.endDate) return -1;
          return a.endDate.localeCompare(b.endDate);
        }),
    [policies]
  );

  const historyPolicies = useMemo(
    () =>
      policies.filter(
        (p) => p.status === "EXPIRED" || p.status === "CANCELLED"
      ),
    [policies]
  );

  function openCreateModal(vehicle) {
    setEditPolicy(null);
    setModalPlate(vehicle.plate);
    setForm({
      ...EMPTY_FORM,
      insuredName: vehicle.insuredName || "",
    });
    setModalOpen(true);
  }

  function openEditModal(policy) {
    setEditPolicy(policy);
    setModalPlate(policy.plate);
    setForm({
      policyNumber: policy.policyNumber || "",
      startDate: policy.startDate || "",
      endDate: policy.endDate || "",
      insuredName: policy.insuredName || "",
      cpfCnpj: policy.cpfCnpj || "",
      vehicleModel: policy.vehicleModel || "",
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditPolicy(null);
    setModalPlate("");
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editPolicy) {
        await updatePolicy(editPolicy.id, {
          ...form,
          plate: editPolicy.plate,
        });
        toast.success("Apólice atualizada");
      } else {
        await createPolicy({
          ...form,
          plate: modalPlate,
          source: "MANUAL",
        });
        toast.success("Apólice cadastrada");
      }
      closeModal();
      loadData();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Erro ao salvar apólice");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(policy) {
    if (
      !window.confirm(
        `Remover apólice ${policy.policyNumber || policy.id} de ${policy.plate}?`
      )
    ) {
      return;
    }
    try {
      await deletePolicy(policy.id);
      toast.success("Apólice removida");
      loadData();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao remover apólice");
    }
  }

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const tabs = [
    { key: "pending", label: "Sem Apólice", count: pendingVehicles.length },
    { key: "active", label: "Vigentes", count: activePolicies.length },
    { key: "history", label: "Histórico", count: historyPolicies.length },
  ];

  return (
    <div className="space-y-6">

      {/* Tabs */}
      <div className="flex gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-1.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`
              flex flex-1 items-center justify-center gap-2
              rounded-xl px-4 py-2.5 text-sm font-semibold
              transition
              ${tab === t.key
                ? "bg-white text-black shadow"
                : "text-zinc-400 hover:text-white"
              }
            `}
          >
            {t.label}
            {t.count > 0 && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  tab === t.key
                    ? "bg-black/10 text-black"
                    : "bg-zinc-700 text-zinc-300"
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-zinc-500">Carregando...</div>
      ) : (
        <>
          {/* Sem Apólice */}
          {tab === "pending" && (
            <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
              {pendingVehicles.length === 0 ? (
                <p className="py-12 text-center text-zinc-500">
                  Todos os veículos possuem apólice vigente
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-zinc-950 text-left text-xs text-zinc-400">
                      <tr>
                        <th className="px-4 py-3">Placa</th>
                        <th className="px-4 py-3">Segurado</th>
                        <th className="px-4 py-3">Plataforma</th>
                        <th className="px-4 py-3">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingVehicles.map((vehicle) => (
                        <tr
                          key={vehicle.id}
                          className="border-t border-zinc-800 hover:bg-zinc-800/40"
                        >
                          <td className="px-4 py-3 font-mono font-semibold">
                            {vehicle.plate}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {vehicle.insuredName || "--"}
                          </td>
                          <td className="px-4 py-3 text-sm text-zinc-400">
                            {vehicle.platform || "--"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => openCreateModal(vehicle)}
                                className="
                                  flex items-center gap-1.5
                                  rounded-xl bg-white px-3 py-1.5
                                  text-xs font-semibold text-black
                                  transition hover:opacity-90
                                "
                              >
                                <Plus size={12} />
                                Cadastrar
                              </button>
                              <button
                                disabled
                                title="Em breve — integração com portal"
                                className="
                                  rounded-xl border border-zinc-700
                                  bg-zinc-950 px-3 py-1.5
                                  text-xs font-semibold text-zinc-600
                                  cursor-not-allowed
                                "
                              >
                                Buscar no Portal
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Vigentes */}
          {tab === "active" && (
            <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
              {activePolicies.length === 0 ? (
                <p className="py-12 text-center text-zinc-500">
                  Nenhuma apólice vigente cadastrada
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-zinc-950 text-left text-xs text-zinc-400">
                      <tr>
                        <th className="px-4 py-3">Placa</th>
                        <th className="px-4 py-3">Segurado</th>
                        <th className="px-4 py-3">Apólice</th>
                        <th className="px-4 py-3">Início</th>
                        <th className="px-4 py-3">Fim</th>
                        <th className="px-4 py-3">Dias Restantes</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activePolicies.map((policy) => {
                        const days = daysRemaining(policy.endDate);
                        return (
                          <tr
                            key={policy.id}
                            className="border-t border-zinc-800 hover:bg-zinc-800/40"
                          >
                            <td className="px-4 py-3 font-mono font-semibold">
                              {policy.plate || "--"}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {policy.insuredName || "--"}
                            </td>
                            <td className="px-4 py-3 text-sm font-mono text-zinc-300">
                              {policy.policyNumber || "--"}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-400">
                              {formatDate(policy.startDate)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-400">
                              {formatDate(policy.endDate)}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${daysBadgeClass(days)}`}
                              >
                                {daysLabel(days)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={policy.status} />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => openEditModal(policy)}
                                  title="Editar"
                                  className="
                                    rounded-xl border border-zinc-700
                                    bg-zinc-950 p-2
                                    transition hover:bg-zinc-800
                                  "
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  onClick={() => handleDelete(policy)}
                                  title="Remover"
                                  className="
                                    rounded-xl border border-zinc-700
                                    bg-zinc-950 p-2 text-zinc-400
                                    transition hover:border-red-500/40
                                    hover:bg-red-500/10 hover:text-red-400
                                  "
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Histórico */}
          {tab === "history" && (
            <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
              {historyPolicies.length === 0 ? (
                <p className="py-12 text-center text-zinc-500">
                  Nenhum registro histórico
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-zinc-950 text-left text-xs text-zinc-400">
                      <tr>
                        <th className="px-4 py-3">Placa</th>
                        <th className="px-4 py-3">Segurado</th>
                        <th className="px-4 py-3">Apólice</th>
                        <th className="px-4 py-3">Início</th>
                        <th className="px-4 py-3">Fim</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyPolicies.map((policy) => (
                        <tr
                          key={policy.id}
                          className="border-t border-zinc-800 hover:bg-zinc-800/40"
                        >
                          <td className="px-4 py-3 font-mono font-semibold">
                            {policy.plate || "--"}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {policy.insuredName || "--"}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-zinc-300">
                            {policy.policyNumber || "--"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-400">
                            {formatDate(policy.startDate)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-400">
                            {formatDate(policy.endDate)}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={policy.status} />
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleDelete(policy)}
                              title="Remover"
                              className="
                                rounded-xl border border-zinc-700
                                bg-zinc-950 p-2 text-zinc-400
                                transition hover:border-red-500/40
                                hover:bg-red-500/10 hover:text-red-400
                              "
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal — criar / editar */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">

            <h3 className="mb-5 text-lg font-semibold">
              {editPolicy ? "Editar Apólice" : `Cadastrar Apólice — ${modalPlate}`}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">

              <div className="grid grid-cols-2 gap-4">

                <div>
                  <label className="mb-1.5 block text-xs text-zinc-500">
                    Número da Apólice *
                  </label>
                  <input
                    required
                    type="text"
                    value={form.policyNumber}
                    onChange={(e) => setField("policyNumber", e.target.value)}
                    className="
                      w-full rounded-xl border border-zinc-800
                      bg-zinc-950 px-3 py-2 text-sm outline-none
                      placeholder:text-zinc-600
                      focus:border-zinc-600
                    "
                    placeholder="Ex: 123456789"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-zinc-500">
                    CPF / CNPJ
                  </label>
                  <input
                    type="text"
                    value={form.cpfCnpj}
                    onChange={(e) => setField("cpfCnpj", e.target.value)}
                    className="
                      w-full rounded-xl border border-zinc-800
                      bg-zinc-950 px-3 py-2 text-sm outline-none
                      placeholder:text-zinc-600
                      focus:border-zinc-600
                    "
                    placeholder="Ex: 000.000.000-00"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-zinc-500">
                    Início de Vigência
                  </label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setField("startDate", e.target.value)}
                    className="
                      w-full rounded-xl border border-zinc-800
                      bg-zinc-950 px-3 py-2 text-sm outline-none
                      focus:border-zinc-600
                    "
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-zinc-500">
                    Fim de Vigência
                  </label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setField("endDate", e.target.value)}
                    className="
                      w-full rounded-xl border border-zinc-800
                      bg-zinc-950 px-3 py-2 text-sm outline-none
                      focus:border-zinc-600
                    "
                  />
                </div>

              </div>

              <div>
                <label className="mb-1.5 block text-xs text-zinc-500">
                  Nome do Segurado
                </label>
                <input
                  type="text"
                  value={form.insuredName}
                  onChange={(e) => setField("insuredName", e.target.value)}
                  className="
                    w-full rounded-xl border border-zinc-800
                    bg-zinc-950 px-3 py-2 text-sm outline-none
                    placeholder:text-zinc-600
                    focus:border-zinc-600
                  "
                  placeholder="Nome completo"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs text-zinc-500">
                  Modelo do Veículo
                </label>
                <input
                  type="text"
                  value={form.vehicleModel}
                  onChange={(e) => setField("vehicleModel", e.target.value)}
                  className="
                    w-full rounded-xl border border-zinc-800
                    bg-zinc-950 px-3 py-2 text-sm outline-none
                    placeholder:text-zinc-600
                    focus:border-zinc-600
                  "
                  placeholder="Ex: Honda Civic 2022"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="
                    rounded-2xl border border-zinc-700
                    bg-zinc-950 px-5 py-2.5
                    text-sm font-semibold
                    transition hover:bg-zinc-800
                  "
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="
                    rounded-2xl bg-white px-5 py-2.5
                    text-sm font-semibold text-black
                    transition hover:opacity-90
                    disabled:opacity-50
                  "
                >
                  {saving ? "Salvando..." : editPolicy ? "Salvar" : "Cadastrar"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );

}
