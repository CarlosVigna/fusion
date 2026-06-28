import { useEffect } from "react";

import { Info } from "lucide-react";

import { realtimeService } from "../services/realtime/realtimeService";

import { useDashboardStore } from "../store/dashboardStore";

export default function Dashboard() {

  const {
    dashboard,
    loading,
    realtimeEvents,
    loadDashboard,
    pushRealtimeEvent,
  } = useDashboardStore();

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
      title: "ONLINE",
      value:
        dashboard?.onlineVehicles || 0,

      description:
        "Veículos que comunicaram há no máximo 30 minutos.",

      style:
        "bg-green-500/10 border-green-500/20",
    },

    {
      title: "DELAYED",
      value:
        dashboard?.delayedVehicles || 0,

      description:
        "Veículos que não comunicam entre 30 minutos e 6 horas. Ainda não é falha de comunicação, mas já passou do intervalo esperado.",

      style:
        "bg-yellow-500/10 border-yellow-500/20",
    },

    {
      title: "NO COMMUNICATION",
      value:
        dashboard?.noCommunicationVehicles || 0,

      description:
        "Veículos sem qualquer comunicação há mais de 6 horas.",

      style:
        "bg-red-500/10 border-red-500/20",
    },

    {
      title: "LOW BATTERY",
      value:
        dashboard?.lowBatteryVehicles || 0,

      description:
        "Veículos com nível de bateria igual ou abaixo de 20%, conforme o último dado de última posição recebido.",

      style:
        "bg-orange-500/10 border-orange-500/20",
    },

    {
      title: "MAINTENANCE",
      value:
        dashboard?.maintenanceVehicles || 0,

      description:
        "Veículos marcados manualmente como \"em manutenção\" na ficha do veículo, independente do status de comunicação.",

      style:
        "bg-blue-500/10 border-blue-500/20",
    },
  ];

  if (loading && !dashboard) {

    return (
      <div className="p-6 text-zinc-400">
        Carregando dashboard...
      </div>
    );

  }

  return (
    <div className="space-y-6">

      <div
        className="
          rounded-2xl border border-zinc-800
          bg-zinc-900 p-6
        "
      >

        <p className="text-sm text-zinc-500">
          TOTAL DE VEÍCULOS
        </p>

        <h2 className="mt-4 text-5xl font-bold">
          {dashboard?.totalVehicles || 0}
        </h2>

      </div>

      <div className="grid gap-4 lg:grid-cols-5">

        {cards.map((card) => (

          <div
            key={card.title}
            className={`
              rounded-2xl border p-6
              ${card.style}
            `}
          >

            <p className="flex items-center gap-1.5 text-sm text-zinc-400">
              {card.title}

              <Info
                size={13}
                className="text-zinc-500"
                title={card.description}
              />
            </p>

            <h2 className="mt-4 text-4xl font-bold">
              {card.value}
            </h2>

          </div>

        ))}

      </div>

      <div
        className="
          rounded-2xl border border-zinc-800
          bg-zinc-900 p-6
        "
      >

        <h2 className="text-xl font-semibold">
          Health operacional
        </h2>

        <div className="mt-6 space-y-4">

          <HealthBar
            label="ONLINE"

            value={
              dashboard?.onlineVehicles || 0
            }

            total={
              dashboard?.totalVehicles || 0
            }

            color="bg-green-500"
          />

          <HealthBar
            label="NO COMMUNICATION"

            value={
              dashboard?.noCommunicationVehicles || 0
            }

            total={
              dashboard?.totalVehicles || 0
            }

            color="bg-red-500"
          />

          <HealthBar
            label="LOW BATTERY"

            value={
              dashboard?.lowBatteryVehicles || 0
            }

            total={
              dashboard?.totalVehicles || 0
            }

            color="bg-yellow-500"
          />

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

function HealthBar({
  label,
  value,
  total,
  color,
}) {

  const percent =
    total > 0
      ? (value / total) * 100
      : 0;

  return (
    <div>

      <div className="mb-2 flex justify-between text-sm">

        <span>{label}</span>

        <span>
          {value} ({percent.toFixed(1)}%)
        </span>

      </div>

      <div
        className="
          h-3 overflow-hidden rounded-full
          bg-zinc-800
        "
      >

        <div
          className={`h-full ${color}`}
          style={{
            width: `${percent}%`,
          }}
        />

      </div>

    </div>
  );
}