import {
    LayoutDashboard,
    ClipboardList,
    Upload,
    Car,
    ShieldCheck,
} from "lucide-react";

import { NavLink } from "react-router-dom";

const items = [
    {
        label: "Grid",
        icon: ClipboardList,
        path: "/",
    },
    {
        label: "Dashboard",
        icon: LayoutDashboard,
        path: "/dashboard",
    },
    {
        label: "Importações",
        icon: Upload,
        path: "/imports",
    },
    {
        label: "Veículos",
        icon: Car,
        path: "/vehicles",
    },
    {
        label: "Auditoria",
        icon: ShieldCheck,
        path: "/audit",
    },
];

export default function Sidebar() {
    return (
        <aside
            className="
        flex w-72 flex-col
        border-r border-zinc-800
        bg-zinc-950
      "
        >
            <div className="border-b border-zinc-800 p-6">
                <div className="flex items-center gap-3">
                    <div
                        className="
              flex h-11 w-11 items-center justify-center
              rounded-2xl bg-white text-black
              font-bold
            "
                    >
                        F
                    </div>

                    <div>
                        <h1 className="text-xl font-bold text-white">
                            Fusion
                        </h1>

                        <p className="text-sm text-zinc-500">
                            Operational Center
                        </p>
                    </div>
                </div>
            </div>

            <nav className="flex flex-1 flex-col gap-2 p-4">
                {items.map((item) => {
                    const Icon = item.icon;

                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `
                group flex items-center gap-3
                rounded-2xl px-4 py-3
                transition-all duration-200
                ${isActive
                                    ? "bg-white text-black shadow-lg"
                                    : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                                }
              `
                            }
                        >
                            <Icon size={20} />

                            <span className="font-medium">
                                {item.label}
                            </span>
                        </NavLink>
                    );
                })}
            </nav>

            <div className="border-t border-zinc-800 p-4">
                <div
                    className="
            rounded-2xl border border-zinc-800
            bg-zinc-900 p-4
          "
                >
                    <p className="text-sm font-medium">
                        Fusion Core
                    </p>

                    <p className="mt-1 text-xs text-zinc-500">
                        Plataforma operacional corporativa
                    </p>
                </div>
            </div>
        </aside>
    );
}