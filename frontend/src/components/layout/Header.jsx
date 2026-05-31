import { Bell, Search } from "lucide-react";

import { useAuthStore } from "../../store/authStore";

export default function Header() {
  const user = useAuthStore(
    (state) => state.user
  );

  return (
    <header
      className="
        flex items-center justify-between
        border-b border-zinc-800
        bg-zinc-900 px-6 py-4
      "
    >
      <div>
        <h2 className="text-xl font-semibold text-white">
          Fusion Operational Center
        </h2>

        <p className="text-sm text-zinc-400">
          Central operacional unificada
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div
          className="
            flex items-center gap-2
            rounded-xl border border-zinc-800
            bg-zinc-950 px-3 py-2
          "
        >
          <Search
            size={18}
            className="text-zinc-500"
          />

          <input
            type="text"
            placeholder="Buscar..."
            className="
              bg-transparent text-sm
              outline-none
              placeholder:text-zinc-500
            "
          />
        </div>

        <button
          className="
            rounded-xl border border-zinc-800
            bg-zinc-950 p-3
            transition hover:bg-zinc-800
          "
        >
          <Bell size={18} />
        </button>

        <div
          className="
            flex items-center gap-3
            rounded-xl border border-zinc-800
            bg-zinc-950 px-4 py-2
          "
        >
          <div
            className="
              flex h-9 w-9 items-center
              justify-center rounded-full
              bg-zinc-800 font-bold
            "
          >
            {user?.name?.[0] || "U"}
          </div>

          <div>
            <p className="text-sm font-medium">
              {user?.name || "Usuário"}
            </p>

            <p className="text-xs text-zinc-500">
              {user?.role || "Operador"}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}