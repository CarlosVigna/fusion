import {
    LayoutDashboard,
    ClipboardList,
    FileSpreadsheet,
    Upload,
    Car,
    RadioTower,
    Mail,
    Wrench,
    HardHat,
    Workflow,
    UserCircle,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";

import { useEffect, useState } from "react";

import { NavLink, useLocation } from "react-router-dom";

import { getSignalControl } from "../../services/signalControlService";

import { getInstallationsPendingCount } from "../../services/installationService";

const items = [
    {
        label: "Grid",
        icon: ClipboardList,
        path: "/",
    },
    {
        label: "Central Operacional",
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
        label: "Cartas de Suspensão",
        icon: Mail,
        path: "/letters",
    },
    {
        label: "Manutenção",
        icon: Wrench,
        path: "/maintenance",
    },
    {
        label: "Instalações",
        icon: HardHat,
        path: "/installations",
        badgeKey: "installations",
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
        label: "Relatórios",
        icon: FileSpreadsheet,
        path: "/reports",
    },
    {
        label: "ETL",
        icon: Workflow,
        path: "/etl",
    },
    {
        label: "Minha Conta",
        icon: UserCircle,
        path: "/account",
    },
];

const POLL_INTERVAL_MS = 60000;

const GRID_PATHS = ["/", "/grid"];

export default function Sidebar() {
    const location = useLocation();

    const isGridPage = GRID_PATHS.includes(location.pathname);

    // null = segue a regra automatica (recolhida em paginas com Grid,
    // aberta nas demais). Um clique no toggle fixa a preferencia do
    // usuario, sem precisar de efeito pra sincronizar com a rota.
    const [manualOverride, setManualOverride] = useState(null);

    const [hovering, setHovering] = useState(false);

    const [signalControlCount, setSignalControlCount] = useState(0);

    const [installationsCount, setInstallationsCount] = useState(0);

    const collapsed =
        manualOverride !== null ? manualOverride : isGridPage;

    // Passar o mouse expande temporariamente sem mudar o estado
    // "recolhido" de base — ao tirar o mouse, volta a recolher se a
    // regra automatica (pagina do Grid) ainda se aplicar.
    const expanded = !collapsed || hovering;

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

    useEffect(() => {

        async function loadInstallationsCount() {

            try {

                const data = await getInstallationsPendingCount();

                setInstallationsCount(data.count ?? 0);

            } catch (error) {

                console.error(error);

            }

        }

        loadInstallationsCount();

        const interval = setInterval(loadInstallationsCount, POLL_INTERVAL_MS);

        return () => clearInterval(interval);

    }, []);

    const badgeCounts = {
        signalControl: signalControlCount,
        installations: installationsCount,
    };

    return (
        <aside
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
            className={`
        relative flex flex-col
        border-r border-zinc-800
        bg-zinc-950
        transition-all duration-200
        ${expanded ? "w-72" : "w-20"}
      `}
        >
            <button
                onClick={() => setManualOverride(!collapsed)}
                title={collapsed ? "Fixar menu aberto" : "Recolher menu"}
                className="
          absolute -right-3 top-8 z-10
          flex h-6 w-6 items-center justify-center
          rounded-full border border-zinc-800
          bg-zinc-900 text-zinc-400
          transition hover:bg-zinc-800 hover:text-white
        "
            >
                {expanded ? (
                    <ChevronLeft size={14} />
                ) : (
                    <ChevronRight size={14} />
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

                    {expanded && (
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
                            title={!expanded ? item.label : undefined}
                            className={({ isActive }) =>
                                `
                group flex items-center gap-3
                rounded-2xl px-4 py-3
                transition-all duration-200
                ${!expanded ? "justify-center" : ""}
                ${isActive
                                    ? "bg-white text-black shadow-lg"
                                    : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                                }
              `
                            }
                        >
                            <Icon size={20} />

                            {expanded && (
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

            {expanded && (
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