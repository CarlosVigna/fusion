import {
    Activity,
    Car,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    FileSpreadsheet,
    HardHat,
    LayoutGrid,
    Mail,
    MonitorCheck,
    Radio,
    Shield,
    Wrench,
} from "lucide-react";

import { useEffect, useState } from "react";

import { NavLink, useLocation } from "react-router-dom";

import { getSignalControl } from "../../services/signalControlService";

import { getInstallationsPendingCount } from "../../services/installationService";

import { FusionLogo } from "../../assets/FusionLogo";

const GROUPS = [
    {
        key: "monitoring",
        label: "Monitoramento",
        icon: MonitorCheck,
        items: [
            { label: "Grid",                icon: LayoutGrid,     path: "/grid" },
            { label: "Central Operacional", icon: Shield,         path: "/dashboard" },
            { label: "Controle de Sinais",  icon: Radio,          path: "/signal-control", badgeKey: "signalControl" },
            { label: "Cartas de Suspensão", icon: Mail,           path: "/letters" },
            { label: "Manutenções",         icon: Wrench,         path: "/maintenance" },
            { label: "Veículos",            icon: Car,            path: "/vehicles" },
            { label: "Relatórios",          icon: FileSpreadsheet,path: "/reports" },
            { label: "Monitor ETL",         icon: Activity,       path: "/etl" },
        ],
    },
    {
        key: "installations",
        label: "Instalações",
        icon: HardHat,
        items: [
            { label: "Instalações", icon: ClipboardList, path: "/installations", badgeKey: "installations" },
        ],
    },
];

const POLL_INTERVAL_MS = 60000;

const GROUPS_STORAGE_KEY = "fusion_sidebar_groups_collapsed";

function loadGroupState() {
    try {
        const saved = localStorage.getItem(GROUPS_STORAGE_KEY);
        if (saved) return JSON.parse(saved);
    } catch {}
    return { monitoring: true, installations: true };
}

// Auto-recolhe apenas no Grid (tabela densa); Home e demais ficam abertos.
const GRID_PATHS = ["/grid"];

export default function Sidebar() {

    const location = useLocation();

    const isGridPage = GRID_PATHS.includes(location.pathname);

    const [manualOverride, setManualOverride] = useState(null);

    const [hovering, setHovering] = useState(false);

    const [signalControlCount, setSignalControlCount] = useState(0);

    const [installationsCount, setInstallationsCount] = useState(0);

    const [collapsedGroups, setCollapsedGroups] = useState(loadGroupState);

    function toggleGroup(key) {
        setCollapsedGroups((prev) => {
            const next = { ...prev, [key]: !prev[key] };
            localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    }

    const collapsed =
        manualOverride !== null ? manualOverride : isGridPage;

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
                {expanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>

            {/* Logo */}
            <div className="border-b border-zinc-800 p-5">
                <div className="flex items-center gap-3">
                    <div className="shrink-0">
                        <FusionLogo size={36} />
                    </div>
                    {expanded && (
                        <div>
                            <h1 className="text-xl font-bold text-white">Fusion</h1>
                            <p className="text-sm text-zinc-500">Operational Center</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Grupos de navegação */}
            <nav className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">

                {GROUPS.map((group) => {

                    const GroupIcon = group.icon;

                    return (
                        <div key={group.key}>

                            {expanded && (
                                <button
                                    onClick={() => toggleGroup(group.key)}
                                    className="
                                        mb-2 flex w-full items-center gap-2 px-2
                                        text-zinc-500 transition hover:text-zinc-300
                                    "
                                >
                                    <GroupIcon size={13} />
                                    <span className="flex-1 text-left text-xs font-semibold uppercase tracking-wider">
                                        {group.label}
                                    </span>
                                    {collapsedGroups[group.key]
                                        ? <ChevronRight size={13} />
                                        : <ChevronDown size={13} />
                                    }
                                </button>
                            )}

                            {(!expanded || !collapsedGroups[group.key]) && (
                            <div className="flex flex-col gap-1">
                                {group.items.map((item) => {

                                    const Icon = item.icon;
                                    const badge = item.badgeKey
                                        ? badgeCounts[item.badgeKey]
                                        : 0;

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

                                            {badge > 0 && (
                                                <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                                                    {badge}
                                                </span>
                                            )}
                                        </NavLink>
                                    );

                                })}
                            </div>
                            )}

                        </div>
                    );

                })}

            </nav>

            {expanded && (
                <div className="border-t border-zinc-800 p-4">
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                        <p className="text-sm font-medium">Fusion Core</p>
                        <p className="mt-1 text-xs text-zinc-500">
                            Plataforma operacional corporativa
                        </p>
                    </div>
                </div>
            )}

        </aside>
    );

}
