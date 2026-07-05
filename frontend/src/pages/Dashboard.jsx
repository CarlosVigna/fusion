import { useEffect, useState } from "react";

import { Link } from "react-router-dom";

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileWarning,
  Mail,
  RadioTower,
  RefreshCw,
  Truck,
  Wrench,
} from "lucide-react";

import { realtimeService } from "../services/realtime/realtimeService";

import { useDashboardStore } from "../store/dashboardStore";

import Tabs from "../components/ui/Tabs";

import DelayedSignalsPanel from "../components/operational/panels/DelayedSignalsPanel";
import LettersReturnedPanel from "../components/operational/panels/LettersReturnedPanel";
import OverdueMaintenancePanel from "../components/operational/panels/OverdueMaintenancePanel";
import PendingChangesPanel from "../components/operational/panels/PendingChangesPanel";
import NeverCommunicatedPanel from "../components/operational/panels/NeverCommunicatedPanel";

import { formatLocalDateTime } from "../utils/dateUtils";

const TABS = [
  { key: "delayed", label: "Sinais atrasados" },
  { key: "letters", label: "Cartas" },
  { key: "maintenance", label: "Manutenções" },
  { key: "pending", label: "Mudanças pendentes" },
  { key: "neverCommunicated", label: "Sem comunicação" },
];

export default function Dashboard() {

  const {
    dashboard,
    loading,
    realtimeEvents,
    loadDashboard,
    pushRealtimeEvent,
  } = useDashboardStore();

  const [activeTab, setActiveTab] =
    useState("delayed");

  useEffect(() => {

    loadDashboard();

    const unsubscribe =
      realtimeService.onDashboardEvent(
        (event) => {

          pushRealtimeEvent(event);

          loadDashboard();

        }
      );

    return () => {

      unsubscribe();

    };

  }, []);

  const cards = [
    {
      key: "registeredVehicles",
      icon: Truck,
      label: "Total de veículos",
      value: dashboard?.registeredVehicles,
      to: "/vehicles",
    },
    {
      key: "onlineVehicles",
      icon: CheckCircle2,
      label: "Veículos ativos",
      value: dashboard?.onlineVehicles,
      to: "/grid",
      style: "border-green-500/20 bg-green-500/10",
    },
    {
      key: "monitoredVehicles",
      icon: RadioTower,
      label: "Veículos monitorados",
      value: dashboard?.monitoredVehicles,
      to: "/grid",
    },
    {
      key: "maintenanceVehicles",
      icon: Wrench,
      label: "Veículos em manutenção",
      value: dashboard?.maintenanceVehicles,
      to: "/maintenance",
      style: "border-blue-500/20 bg-blue-500/10",
    },
    {
      key: "activeLettersCount",
      icon: Mail,
      label: "Cartas ativas",
      value: dashboard?.activeLettersCount,
      onClick: () => setActiveTab("letters"),
    },
    {
      key: "pendingChangesCount",
      icon: FileWarning,
      label: "Mudanças pendentes",
      value: dashboard?.pendingChangesCount,
      onClick: () => setActiveTab("pending"),
      style: "border-purple-500/20 bg-purple-500/10",
    },
    {
      key: "delayedSignalCount",
      icon: AlertTriangle,
      label: "Sinal atrasado",
      value: dashboard?.delayedSignalCount,
      onClick: () => setActiveTab("delayed"),
      style: "border-yellow-500/20 bg-yellow-500/10",
    },
    {
      key: "importsTodayCount",
      icon: RefreshCw,
      label: "Importações hoje",
      value: dashboard?.importsTodayCount,
      to: "/etl",
    },
    {
      key: "lastEtlUpdate",
      icon: Clock,
      label: "Última atualização ETL",
      value: dashboard?.lastEtlUpdate
        ? formatLocalDateTime(dashboard.lastEtlUpdate)
        : "--",
      isText: true,
    },
  ];

  const tabsWithCounts = TABS.map((tab) => {

    if (tab.key === "delayed") {
      return { ...tab, count: dashboard?.delayedSignalCount };
    }

    if (tab.key === "letters") {
      return { ...tab, count: dashboard?.pendingLettersCount };
    }

    if (tab.key === "maintenance") {
      return { ...tab, count: dashboard?.overdueMaintenanceCount };
    }

    if (tab.key === "pending") {
      return { ...tab, count: dashboard?.pendingChangesCount };
    }

    return tab;

  });

  if (loading && !dashboard) {

    return (
      <div className="p-6 text-zinc-400">
        Carregando central operacional...
      </div>
    );

  }

  return (
    <div className="space-y-6">

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

        {cards.map((card) => {

          const Icon = card.icon;

          const content = (
            <div
              className={`
                h-full rounded-2xl border p-5
                transition
                ${card.style || "border-zinc-800 bg-zinc-900"}
                ${card.to || card.onClick ? "hover:bg-zinc-800/60 cursor-pointer" : ""}
              `}
            >

              <div className="flex items-center justify-between">

                <p className="text-xs font-medium text-zinc-400">
                  {card.label}
                </p>

                <Icon size={16} className="text-zinc-500" />

              </div>

              <h2
                className={
                  card.isText
                    ? "mt-3 text-lg font-semibold"
                    : "mt-3 text-3xl font-bold"
                }
              >
                {card.isText
                  ? card.value
                  : card.value ?? 0}
              </h2>

            </div>
          );

          if (card.to) {
            return (
              <Link key={card.key} to={card.to}>
                {content}
              </Link>
            );
          }

          if (card.onClick) {
            return (
              <button
                key={card.key}
                onClick={card.onClick}
                className="text-left"
              >
                {content}
              </button>
            );
          }

          return <div key={card.key}>{content}</div>;

        })}

      </div>

      <div
        className="
          rounded-2xl border border-zinc-800
          bg-zinc-900 p-6
        "
      >

        <h2 className="mb-4 text-xl font-semibold">
          Painel de Alertas
        </h2>

        <Tabs
          tabs={tabsWithCounts}
          activeKey={activeTab}
          onChange={setActiveTab}
        />

        <div className="mt-4">

          {activeTab === "delayed" && (
            <DelayedSignalsPanel onChanged={loadDashboard} />
          )}

          {activeTab === "letters" && (
            <LettersReturnedPanel onChanged={loadDashboard} />
          )}

          {activeTab === "maintenance" && (
            <OverdueMaintenancePanel onChanged={loadDashboard} />
          )}

          {activeTab === "pending" && (
            <PendingChangesPanel onChanged={loadDashboard} />
          )}

          {activeTab === "neverCommunicated" && (
            <NeverCommunicatedPanel />
          )}

        </div>

      </div>

      <div
        className="
          rounded-2xl border border-zinc-800
          bg-zinc-900 p-6
        "
      >

        <div className="flex items-center justify-between">

          <h2 className="text-xl font-semibold">
            Eventos operacionais realtime
          </h2>

          <div
            className="
              rounded-full bg-green-500/10
              px-3 py-1 text-xs text-green-400
            "
          >
            LIVE
          </div>

        </div>

        <div className="mt-6 space-y-3">

          {realtimeEvents.length === 0 && (

            <div className="text-sm text-zinc-500">
              Nenhum evento realtime recebido
            </div>

          )}

          {realtimeEvents.map(
            (event, index) => (

              <div
                key={index}
                className="
                  rounded-xl border border-zinc-800
                  bg-zinc-950 p-4
                "
              >

                <div className="text-xs text-zinc-500">
                  {event.type}
                </div>

                <div className="mt-1 text-sm text-white">
                  {event.message}
                </div>

              </div>

            )
          )}

        </div>

      </div>

    </div>
  );
}
