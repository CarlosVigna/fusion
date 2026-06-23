import {
    LayoutDashboard,
    ClipboardList,
    Upload,
    Car,
    ShieldCheck,
    RadioTower,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";

import { useEffect, useState } from "react";

import { NavLink } from "react-router-dom";

import { getSignalControl } from "../../services/signalControlService";

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
        label: "Controle de Sinais",
        icon: RadioTower,
        path: "/signal-control",
        badgeKey: "signalControl",
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
        label: "Monitoramento",
        icon: ShieldCheck,
        path: "/audit",
    },
];

const POLL_INTERVAL_MS = 60000;

export default function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);

    const [signalControlCount, setSignalControlCount] = useState(0);

    useEffect(() => {

        async function loadCount() {

            try {

                const data = await getSignalControl();

                setSignalControlCount(data.length);

            } catch (error) {

                console.error(error);

            }

        }

        loadCount();

        const interval = setInterval(loadCount, POLL_INTERVAL_MS);

        return () => clearInterval(interval);

    }, []);

    const badgeCounts = {
        signalControl: signalControlCount,
    };

    return (
        <aside
            className={`
        relative flex flex-col
        border-r border-zinc-800
        bg-zinc-950
        transition-all duration-200
        ${collapsed ? "w-20" : "w-72"}
      `}
        >
            <button
                onClick={() => setCollapsed(!collapsed)}
                title={collapsed ? "Expandir menu" : "Recolher menu"}
                className="
          absolute -right-3 top-8 z-10
          flex h-6 w-6 items-center justify-center
          rounded-full border border-zinc-800
          bg-zinc-900 text-zinc-400
          transition hover:bg-zinc-800 hover:text-white
        "
            >
                {collapsed ? (
                    <ChevronRight size={14} />
                ) : (
                    <ChevronLeft size={14} />
                )}
            </button>

            <div className="border-b border-zinc-800 p-6">
                <div className="flex items-center gap-3">
                    <div
                        className="
              flex h-11 w-11 shrink-0 items-center justify-center
              rounded-2xl bg-white text-black
              font-bold
            "
                    >
                        F
                    </div>

                    {!collapsed && (
                        <div>
                            <h1 className="text-xl font-bold text-white">
                                Fusion
                            </h1>

                            <p className="text-sm text-zinc-500">
                                Operational Center
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <nav className="flex flex-1 flex-col gap-2 p-4">
                {items.map((item) => {
                    const Icon = item.icon;

                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            title={collapsed ? item.label : undefined}
                            className={({ isActive }) =>
                                `
                group flex items-center gap-3
                rounded-2xl px-4 py-3
                transition-all duration-200
                ${collapsed ? "justify-center" : ""}
                ${isActive
                                    ? "bg-white text-black shadow-lg"
                                    : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                                }
              `
                            }
                        >
                            <Icon size={20} />

                            {!collapsed && (
                                <span className="flex-1 font-medium">
                                    {item.label}
                                </span>
                            )}

                            {item.badgeKey &&
                                badgeCounts[item.badgeKey] > 0 && (
                                    <span
                                        className="
                      rounded-full bg-red-500
                      px-2 py-0.5 text-xs font-bold
                      text-white
                    "
                                    >
                                        {badgeCounts[item.badgeKey]}
                                    </span>
                                )}
                        </NavLink>
                    );
                })}
            </nav>

            {!collapsed && (
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
            )}
        </aside>
    );
}