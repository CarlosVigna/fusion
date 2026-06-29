import { useEffect, useState } from "react";

import toast from "react-hot-toast";

import { getNeverCommunicated } from "../../../services/signalControlService";

import { formatLocalDateTime } from "../../../utils/dateUtils";

export default function NeverCommunicatedPanel() {

  const [vehicles, setVehicles] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  async function load() {

    setLoading(true);

    try {

      const data = await getNeverCommunicated();

      setVehicles(data);

    } catch (error) {

      console.error(error);

      toast.error("Erro ao carregar veículos sem comunicação");

    } finally {

      setLoading(false);

    }

  }

  useEffect(() => {

    load();

  }, []);

  if (loading) {
    return (
      <p className="py-10 text-center text-zinc-500">
        Carregando...
      </p>
    );
  }

  if (vehicles.length === 0) {
    return (
      <p className="py-10 text-center text-zinc-500">
        Nenhum veículo nessa condição
      </p>
    );
  }

  return (
    <div className="max-h-[28rem] overflow-y-auto rounded-2xl border border-zinc-800">

      <table className="min-w-full">

        <thead className="sticky top-0 bg-zinc-950">
          <tr className="text-left text-sm text-zinc-400">
            <th className="px-4 py-3">Placa</th>
            <th className="px-4 py-3">Segurado</th>
            <th className="px-4 py-3">Vínculo desde</th>
            <th className="px-4 py-3">Diagnóstico automático</th>
            <th className="px-4 py-3">Ação sugerida</th>
          </tr>
        </thead>

        <tbody>

          {vehicles.map((vehicle) => (

            <tr
              key={vehicle.plate}
              className="border-t border-zinc-800 transition hover:bg-zinc-900"
            >

              <td className="px-4 py-3 font-mono font-semibold">
                {vehicle.plate}
              </td>

              <td className="px-4 py-3">
                {vehicle.insuredName || "--"}
              </td>

              <td className="px-4 py-3 text-zinc-400">
                {formatLocalDateTime(vehicle.linkedSince)}
              </td>

              <td className="px-4 py-3">
                {vehicle.diagnosis}
              </td>

              <td className="px-4 py-3 text-zinc-400">
                {vehicle.suggestedAction}
              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>
  );
}
