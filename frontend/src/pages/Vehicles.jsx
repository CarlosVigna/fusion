import { useEffect, useState } from "react";
import PlatformBadge from "../components/ui/PlatformBadge";
import { getVehicles } from "../services/vehicleService";

export default function Vehicles() {
    const [vehicles, setVehicles] =
        useState([]);

    const [loading, setLoading] =
        useState(true);

    useEffect(() => {
        loadVehicles();
    }, []);

    async function loadVehicles() {
        try {
            const data = await getVehicles();

            setVehicles(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">
                    Veículos
                </h1>

                <p className="mt-1 text-zinc-400">
                    Cadastro operacional consolidado
                </p>
            </div>

            <div
                className="
          overflow-x-auto rounded-2xl
          border border-zinc-800
          bg-zinc-900
        "
            >
                <table className="min-w-full">
                    <thead className="bg-zinc-950">
                        <tr className="text-left text-sm text-zinc-400">
                            <th className="px-4 py-4">
                                Placa
                            </th>

                            <th className="px-4 py-4">
                                Segurado
                            </th>

                            <th className="px-4 py-4">
                                Plataforma
                            </th>

                            <th className="px-4 py-4">
                                Fabricante
                            </th>

                            <th className="px-4 py-4">
                                Modelo
                            </th>

                            <th className="px-4 py-4">
                                Linha
                            </th>

                            <th className="px-4 py-4">
                                Operadora
                            </th>
                        </tr>
                    </thead>

                    <tbody>
                        {loading ? (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="
                    px-6 py-10 text-center
                    text-zinc-500
                  "
                                >
                                    Carregando veículos...
                                </td>
                            </tr>
                        ) : vehicles.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="
                    px-6 py-10 text-center
                    text-zinc-500
                  "
                                >
                                    Nenhum veículo encontrado
                                </td>
                            </tr>
                        ) : (
                            vehicles.map((vehicle) => (
                                <tr
                                    key={vehicle.id}
                                    className="
                    border-t border-zinc-800
                    transition hover:bg-zinc-800
                  "
                                >
                                    <td
                                        className="
                      px-4 py-4 font-mono
                      font-semibold
                    "
                                    >
                                        {vehicle.plate}
                                    </td>

                                    <td className="px-4 py-4">
                                        {vehicle.insuredName}
                                    </td>

                                    <td className="px-4 py-4">
                                        <PlatformBadge
                                            platform={vehicle.platform}
                                        />
                                    </td>

                                    <td className="px-4 py-4">
                                        {vehicle.manufacturer}
                                    </td>

                                    <td className="px-4 py-4">
                                        {vehicle.model}
                                    </td>

                                    <td className="px-4 py-4">
                                        {vehicle.lineNumber}
                                    </td>

                                    <td className="px-4 py-4">
                                        {vehicle.operator}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}