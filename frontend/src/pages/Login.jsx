import { useState } from "react";

import { useNavigate } from "react-router-dom";

import { getMe, login } from "../services/authService";

import { useAuthStore } from "../store/authStore";

import { useThemeStore } from "../store/themeStore";

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
        <h1 className="text-3xl font-bold">
          Fusion
        </h1>

        <p className="mt-2 text-zinc-400">
          Plataforma operacional corporativa
        </p>

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