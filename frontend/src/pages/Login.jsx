import { useState } from "react";

import { useNavigate } from "react-router-dom";

import { CheckCircle2, Circle, Loader2 } from "lucide-react";

import { getMe, login } from "../services/authService";

import { getEtlStatus } from "../services/etlStatusService";

import { triggerImport } from "../services/importStatusService";

import { useAuthStore } from "../store/authStore";

import { useThemeStore } from "../store/themeStore";

import { ETL_LABELS } from "../constants/etlSteps";

import { FusionLogo } from "../assets/FusionLogo";

// Disparados em sequencia apos o login pra a Grid ja abrir com dado
// fresco, sem esperar o proximo ciclo manual do Import Center.
const SYNC_TYPES = [
  "MULTIPORTAL_ULTIMA_POSICAO",
  "MULTIPORTAL_DEVICE",
  "MULTIPORTAL_LINKAGE",
];

const SYNC_POLL_MS = 3000;

// O trigger so enfileira o pedido — quem processa de fato e' o ETL local
// rodando no PC (poll de 15s + scrape no portal), que pode estar
// desligado. Sem um teto, a tela de loading ficaria presa pra sempre
// nesse caso — 90s da folga pra um ciclo completo dos 3 tipos e ainda
// deixa o login seguir mesmo se o ETL local nao responder.
const SYNC_MAX_WAIT_MS = 90000;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function Login() {
  const navigate = useNavigate();

  const setAuth = useAuthStore(
    (state) => state.setAuth
  );

  const loadTheme = useThemeStore(
    (state) => state.loadTheme
  );

  const [email, setEmail] = useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] = useState("");

  const [syncing, setSyncing] = useState(false);

  const [syncStatus, setSyncStatus] = useState(
    () => Object.fromEntries(SYNC_TYPES.map((type) => [type, "pending"]))
  );

  // Dispara os 3 imports manuais e espera cada um sair de RUNNING antes
  // de liberar o sistema — assim a Grid ja abre com posicionamento/
  // dispositivos/vinculos frescos, sem o usuario precisar ir no Import
  // Center manualmente logo depois de logar.
  async function runPostLoginSync() {

    setSyncing(true);

    setSyncStatus(
      Object.fromEntries(SYNC_TYPES.map((type) => [type, "pending"]))
    );

    // Snapshot do updatedAt de cada tipo ANTES de disparar — sem isso, um
    // status SUCCESS/ERROR de um trigger manual anterior (de horas atras)
    // faria o polling abaixo achar que esse sync novo ja tinha terminado
    // sem nem ter comecado.
    const baseline = {};

    try {

      const before = await getEtlStatus();

      for (const type of SYNC_TYPES) {
        const entry = Array.isArray(before)
          ? before.find((s) => s.type === type)
          : null;
        baseline[type] = entry?.updatedAt ?? null;
      }

    } catch (err) {
      console.error(err);
    }

    await Promise.allSettled(
      SYNC_TYPES.map((type) => triggerImport(type))
    );

    setSyncStatus(
      Object.fromEntries(SYNC_TYPES.map((type) => [type, "running"]))
    );

    const pending = new Set(SYNC_TYPES);
    const startedAt = Date.now();

    while (pending.size > 0 && Date.now() - startedAt < SYNC_MAX_WAIT_MS) {

      try {

        const list = await getEtlStatus();

        for (const type of [...pending]) {

          const entry = Array.isArray(list)
            ? list.find((s) => s.type === type)
            : null;

          const isNewRun =
            entry?.updatedAt && entry.updatedAt !== baseline[type];

          if (entry && isNewRun && entry.status !== "RUNNING") {

            pending.delete(type);

            setSyncStatus((prev) => ({
              ...prev,
              [type]: entry.status === "ERROR" ? "error" : "done",
            }));

          }

        }

      } catch (err) {
        console.error(err);
      }

      if (pending.size === 0) {
        break;
      }

      await wait(SYNC_POLL_MS);

    }

    // O backend ja dispara o motor sozinho apos o import de Posicionamento
    // terminar (EngineAsyncService.runAfterImport(), dentro de POST
    // /imports/upload) — mas so' se MULTIPORTAL_ULTIMA_POSICAO realmente
    // rodou (ETL local ligado). Chamada explicita aqui garante o
    // recalculo mesmo quando so' Dispositivos/Vinculos foram atualizados.
    // Fire-and-forget: nao trava o login esperando o motor terminar, a
    // Grid se atualiza sozinha via WebSocket GRID_UPDATED quando ele acaba.
    try {
      await triggerImport("OPERATIONAL_ENGINE");
    } catch (err) {
      console.error(err);
    }

    setSyncing(false);

  }

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setLoading(true);

      setError("");

      const response = await login({
        email,
        password,
      });

      setAuth(response);

      try {

        const me = await getMe();

        setAuth({ token: response.token, user: me });

        await loadTheme();

      } catch (meError) {

        console.error(meError);

      }

      await runPostLoginSync();

      navigate("/");
    } catch (error) {
  console.error(error.message);

      setError(
        "Credenciais inválidas"
      );
    } finally {
      setLoading(false);
    }
  }

  if (syncing) {
    return (
      <div
        className="
          flex min-h-screen items-center
          justify-center bg-zinc-950
        "
      >
        <div
          className="
            w-full max-w-md rounded-3xl
            border border-zinc-800
            bg-zinc-900 p-8
          "
        >
          <div className="flex flex-col items-center">
            <FusionLogo size={80} />
            <h1 className="mt-3 text-3xl font-bold">Fusion</h1>
            <p className="mt-1 text-zinc-400">Atualizando dados antes de entrar...</p>
          </div>

          <div className="mt-8 space-y-3">
            {SYNC_TYPES.map((type) => {
              const status = syncStatus[type];
              const label = ETL_LABELS[type] || type;

              return (
                <div
                  key={type}
                  className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3"
                >
                  {status === "done" && (
                    <CheckCircle2 size={18} className="shrink-0 text-emerald-500" />
                  )}
                  {status === "error" && (
                    <Circle size={18} className="shrink-0 text-red-500" />
                  )}
                  {(status === "pending" || status === "running") && (
                    <Loader2
                      size={18}
                      className={`shrink-0 text-zinc-400 ${status === "running" ? "animate-spin" : ""}`}
                    />
                  )}

                  <span className="text-sm text-zinc-300">
                    {status === "done" || status === "error"
                      ? label
                      : `Atualizando ${label.toLowerCase()}...`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="
        flex min-h-screen items-center
        justify-center bg-zinc-950
      "
    >
      <form
        onSubmit={handleSubmit}
        className="
          w-full max-w-md rounded-3xl
          border border-zinc-800
          bg-zinc-900 p-8
        "
      >
        <div className="flex flex-col items-center">
          <FusionLogo size={80} />
          <h1 className="mt-3 text-3xl font-bold">Fusion</h1>
          <p className="mt-1 text-zinc-400">Plataforma operacional corporativa</p>
        </div>

        <div className="mt-8 space-y-4">
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            className="
              w-full rounded-2xl border
              border-zinc-800 bg-zinc-950
              px-4 py-3 outline-none
            "
          />

          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            className="
              w-full rounded-2xl border
              border-zinc-800 bg-zinc-950
              px-4 py-3 outline-none
            "
          />

          {error && (
            <div
              className="
                rounded-xl border
                border-red-500/20
                bg-red-500/10 px-4 py-3
                text-sm text-red-400
              "
            >
              {error}
            </div>
          )}

          <button
            disabled={loading}
            className="
              w-full rounded-2xl bg-white
              py-3 font-semibold text-black
              transition hover:opacity-90
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            {loading
              ? "Entrando..."
              : "Entrar"}
          </button>
        </div>
      </form>
    </div>
  );
}