import { useEffect, useState } from "react";
import PlatformBadge from "../components/ui/PlatformBadge";
import { useParams } from "react-router-dom";

import StatusBadge from "../components/ui/StatusBadge";

import { getVehicleByPlate } from "../services/vehicleService";

export default function VehicleDetails() {
    const { plate } = useParams();

    const [vehicle, setVehicle] =
        useState(null);

    const [loading, setLoading] =
        useState(true);

    useEffect(() => {
        loadVehicle();
    }, []);

    async function loadVehicle() {
        try {
            const data =
                await getVehicleByPlate(plate);

            setVehicle(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="text-zinc-500">
                Carregando veículo...
            </div>
        );
    }

    if (!vehicle) {
        return (
            <div className="text-zinc-500">
                Veículo não encontrado
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
                <div className="flex items-start justify-between">
                    <div>
                        <h1
                            className="
                text-4xl font-bold
                font-mono
              "
                        >
                            {vehicle.plate}
                        </h1>

                        <p className="mt-2 text-zinc-400">
                            {vehicle.insuredName}
                        </p>
                    </div>

                    <StatusBadge
                        status={vehicle.status}
                    />
                </div>

                <div className="mt-8 grid gap-4 lg:grid-cols-3">
                    <div
                        className="
    rounded-2xl border border-zinc-800
    bg-zinc-950 p-4
  "
                    >
                        <p className="text-sm text-zinc-500">
                            PLATAFORMA
                        </p>

                        <div className="mt-3">
                            <PlatformBadge
                                platform={vehicle.platform}
                            />
                        </div>
                    </div>

                    <Card
                        title="DISPOSITIVO"
                        value={vehicle.activeDevice}
                    />

                    <Card
                        title="BATERIA"
                        value={`${vehicle.batteryLevel}%`}
                    />

                    <Card
                        title="FABRICANTE"
                        value={vehicle.manufacturer}
                    />

                    <Card
                        title="MODELO"
                        value={vehicle.model}
                    />

                    <Card
                        title="LINHA"
                        value={vehicle.lineNumber}
                    />

                    <Card
                        title="OPERADORA"
                        value={vehicle.operator}
                    />

                    <Card
                        title="ONLINE"
                        value={
                            vehicle.online
                                ? "SIM"
                                : "NÃO"
                        }
                    />

                    <Card
                        title="MANUTENÇÃO"
                        value={
                            vehicle.inMaintenance
                                ? "SIM"
                                : "NÃO"
                        }
                    />

                    <Card
                        title="OPERADOR MANUTENÇÃO"
                        value={
                            vehicle.maintenanceOperator
                        }
                    />

                    <Card
                        title="ÚLTIMA POSIÇÃO"
                        value={`${vehicle.positionDate} ${vehicle.positionTime}`}
                    />

                    <Card
                        title="STALE UPDATE"
                        value={
                            vehicle.staleUpdate
                                ? "SIM"
                                : "NÃO"
                        }
                    />

                    <Card
                        title="LOW BATTERY"
                        value={
                            vehicle.lowBattery
                                ? "SIM"
                                : "NÃO"
                        }
                    />
                </div>
            </div>
        </div>
    );
}

function Card({ title, value }) {
    return (
        <div
            className="
        rounded-2xl border border-zinc-800
        bg-zinc-950 p-4
      "
        >
            <p className="text-sm text-zinc-500">
                {title}
            </p>

            <p className="mt-2 text-lg font-semibold">
                {value || "-"}
            </p>
        </div>
    );
}