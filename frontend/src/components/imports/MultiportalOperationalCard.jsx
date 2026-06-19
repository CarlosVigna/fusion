import { useState } from "react";

import toast from "react-hot-toast";

import { updateOperational } from "../../services/multiportalOperationalService";

export default function MultiportalOperationalCard() {
  const [rawContent, setRawContent] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [result, setResult] =
    useState(null);

  async function handleUpdate() {
    try {
      setLoading(true);

      const response =
        await updateOperational(
          rawContent
        );

      setResult(response);

      setRawContent("");

      toast.success(
        `${response.updatedVehicles} veículos atualizados`
      );
    } catch (error) {
      console.error(error);

      toast.error("Erro ao processar a importação");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="
        rounded-2xl border
        border-zinc-800
        bg-zinc-900 p-6
      "
    >
      <div>
        <h2 className="text-xl font-semibold">
          Multiportal Operational
        </h2>

        <p className="mt-1 text-sm text-zinc-500">
          Atualização operacional via
          copy/paste
        </p>
      </div>

      <textarea
        value={rawContent}
        onChange={(e) =>
          setRawContent(
            e.target.value
          )
        }
        placeholder="
Cole aqui os dados operacionais do Multiportal..."
        className="
          mt-6 h-80 w-full
          rounded-2xl border
          border-zinc-800
          bg-zinc-950 p-4
          text-sm outline-none
        "
      />

      <button
        onClick={handleUpdate}
        disabled={
          loading || !rawContent
        }
        className="
          mt-4 rounded-2xl
          bg-white px-5 py-3
          font-semibold text-black
          transition hover:opacity-90
          disabled:opacity-50
        "
      >
        {loading
          ? "Atualizando..."
          : "Atualizar Grid"}
      </button>

      {result && (
        <div className="mt-6 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div
              className="
                rounded-2xl border
                border-green-500/20
                bg-green-500/10 p-5
              "
            >
              <p className="text-sm text-green-300">
                Atualizados
              </p>

              <h2 className="mt-3 text-4xl font-bold">
                {
                  result.updatedVehicles
                }
              </h2>
            </div>

            <div
              className="
                rounded-2xl border
                border-red-500/20
                bg-red-500/10 p-5
              "
            >
              <p className="text-sm text-red-300">
                Não encontrados
              </p>

              <h2 className="mt-3 text-4xl font-bold">
                {
                  result.notFoundVehicles
                }
              </h2>
            </div>
          </div>

          {result.notFoundPlates
            ?.length > 0 && (
            <div
              className="
                rounded-2xl border
                border-zinc-800
                bg-zinc-950 p-5
              "
            >
              <h3 className="font-semibold">
                Placas não encontradas
              </h3>

              <div
                className="
                  mt-4 flex flex-wrap
                  gap-2
                "
              >
                {result.notFoundPlates.map(
                  (plate) => (
                    <span
                      key={plate}
                      className="
                        rounded-full
                        bg-red-500/15
                        px-3 py-1
                        text-sm text-red-400
                      "
                    >
                      {plate}
                    </span>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}