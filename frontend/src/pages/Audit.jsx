import { useEffect, useState } from "react";

import { getImportHistory } from "../services/auditService";

export default function Audit() {
  const [history, setHistory] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      const data =
        await getImportHistory();

      setHistory(data);
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
          Auditoria
        </h1>

        <p className="mt-1 text-zinc-400">
          Histórico operacional e rastreabilidade
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
                Data
              </th>

              <th className="px-4 py-4">
                Tipo
              </th>

              <th className="px-4 py-4">
                Usuário
              </th>

              <th className="px-4 py-4">
                Plataforma
              </th>

              <th className="px-4 py-4">
                Registros
              </th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  className="
                    px-6 py-10 text-center
                    text-zinc-500
                  "
                >
                  Carregando auditoria...
                </td>
              </tr>
            ) : history.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="
                    px-6 py-10 text-center
                    text-zinc-500
                  "
                >
                  Nenhum registro encontrado
                </td>
              </tr>
            ) : (
              history.map((item) => (
                <tr
                  key={item.id}
                  className="
                    border-t border-zinc-800
                    transition hover:bg-zinc-800
                  "
                >
                  <td className="px-4 py-4">
                    {item.createdAt}
                  </td>

                  <td className="px-4 py-4">
                    {item.type}
                  </td>

                  <td className="px-4 py-4">
                    {item.userName}
                  </td>

                  <td className="px-4 py-4">
                    {item.platform}
                  </td>

                  <td className="px-4 py-4">
                    {item.totalRecords}
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