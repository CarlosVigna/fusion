import { useEffect, useRef, useState } from "react";

import { useNavigate } from "react-router-dom";

import { exchangeMicrosoftCode } from "../services/microsoftAuthService";

export default function MicrosoftCallback() {

  const navigate = useNavigate();

  const [status, setStatus] = useState("connecting");

  const [error, setError] = useState(null);

  const called = useRef(false);

  useEffect(() => {

    if (called.current) return;
    called.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const errorParam = params.get("error");

    if (errorParam) {
      setStatus("error");
      setError(params.get("error_description") || "Autenticação recusada pelo Microsoft.");
      return;
    }

    if (!code) {
      setStatus("error");
      setError("Código de autorização não encontrado na URL.");
      return;
    }

    exchangeMicrosoftCode(code)
      .then(() => {
        setStatus("success");
        setTimeout(() => navigate("/shift-handover"), 2000);
      })
      .catch((err) => {
        setStatus("error");
        setError(err.message || "Erro ao trocar o código pelo token.");
      });

  }, [navigate]);

  return (
    <div
      className="
        flex min-h-screen items-center justify-center
        bg-zinc-950 text-zinc-100
      "
    >
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">

        {status === "connecting" && (
          <>
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-zinc-700 border-t-white" />
            <p className="text-lg font-semibold">Conectando ao Microsoft...</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20 text-green-400 text-2xl">
              ✓
            </div>
            <p className="text-lg font-semibold text-green-400">Conta Microsoft conectada!</p>
            <p className="mt-2 text-sm text-zinc-400">Redirecionando para Passagem de Turno...</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 text-red-400 text-2xl">
              ✕
            </div>
            <p className="text-lg font-semibold text-red-400">Erro na autenticação</p>
            <p className="mt-2 text-sm text-zinc-400">{error}</p>
            <button
              onClick={() => navigate("/shift-handover")}
              className="
                mt-5 rounded-xl border border-zinc-700
                bg-zinc-950 px-5 py-2.5
                text-sm font-semibold
                transition hover:bg-zinc-800
              "
            >
              Voltar
            </button>
          </>
        )}

      </div>
    </div>
  );

}
