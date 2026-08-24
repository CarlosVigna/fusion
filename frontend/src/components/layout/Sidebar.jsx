import {
    Activity,
    AlertTriangle,
    Bell,
    CheckSquare,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ClipboardCheck,
    ClipboardList,
    FileSpreadsheet,
    FileText,
    History,
    LayoutGrid,
    Mail,
    MapPin,
    Monitor,
    Package,
    Radio,
    Satellite,
    ScrollText,
    Send,
    Settings,
    Upload,
    UserCog,
    Users,
    WifiOff,
    Wrench,
} from "lucide-react";

import { useEffect, useRef, useState } from "react";

import { NavLink, useLocation } from "react-router-dom";

import { useAuthStore } from "../../store/authStore";

import { getSignalControl } from "../../services/signalControlService";

import { getInstallationsPendingCount } from "../../services/installationService";

import {
    getCancelledPolicies,
    getClosedPolicies,
    getExpiredPolicies,
    getExpiringPolicies,
    getPolicyBadgeCounts,
} from "../../services/policyService";

import { notifyInstallationsNew } from "../../services/notificationService";

import { getPendingConfirmations } from "../../services/stockService";

import { getOverdueMaintenanceRecords } from "../../services/maintenanceService";

import { getLettersPendingBaixa } from "../../services/letterService";

import { FusionLogo } from "../../assets/FusionLogo";

const GROUPS = [
    {
        key: "multiportal",
        label: "Monitoramento Multiportal",
        icon: Monitor,
        items: [
            { label: "Grid",                      icon: LayoutGrid,      path: "/grid" },
            { label: "Relatório Multiportal",     icon: FileSpreadsheet, path: "/reports/multiportal" },
            { label: "Relatório de Dispositivos", icon: FileSpreadsheet, path: "/reports/devices" },
            { label: "Histórico de Frota",        icon: History,         path: "/reports/fleet-history" },
        ],
    },
    {
        key: "tracknme",
        label: "TracknMe",
        icon: Satellite,
        items: [
            { label: "Grid TracknMe",         icon: LayoutGrid,      path: "/tracknme/grid" },
            { label: "Histórico",             icon: History,         path: "/tracknme/history" },
            { label: "Pendentes de Cadastro", icon: MapPin,          path: "/tracknme/pending" },
            { label: "Relatório TracknMe",    icon: FileSpreadsheet, path: "/reports/tracknme" },
        ],
    },
    {
        key: "operational",
        label: "Operacional",
        icon: Bell,
        items: [
            { label: "Controle de Sinais",  icon: Radio,  path: "/signal-control", badgeKey: "signalControl" },
            { label: "Cartas de Suspensão", icon: Mail,   path: "/letters", badgeKey: "lettersPending" },
            { label: "Manutenções",         icon: Wrench, path: "/maintenance", badgeKey: "maintenanceOverdue" },
        ],
    },
    {
        key: "policies",
        label: "Apólices",
        icon: FileText,
        items: [
            { label: "Conferência", icon: ScrollText,    path: "/policies", end: true, badgeKey: "policiesExpired" },
            { label: "Alertas",     icon: AlertTriangle, path: "/policies/alerts", badgeKey: "policiesExpiring" },
        ],
    },
    {
        key: "serviceorders",
        label: "Ordens de Serviço",
        icon: ClipboardList,
        items: [
            { label: "Dashboard",  icon: ClipboardCheck,  path: "/service-orders/dashboard" },
            { label: "Ordens",     icon: ClipboardList,   path: "/service-orders", end: true },
            { label: "Técnicos",   icon: UserCog,         path: "/technicians" },
            { label: "Relatórios", icon: FileSpreadsheet, path: "/service-orders/reports" },
            { label: "Estoque",       icon: Package,     path: "/stock", end: true, badgeKey: "stockPending" },
            { label: "Confirmações",  icon: CheckSquare, path: "/stock/confirmations" },
        ],
    },
    {
        key: "admin",
        label: "Administração",
        icon: Settings,
        adminOnly: true,
        items: [
            { label: "Usuários",           icon: Users,         path: "/users" },
            { label: "Import Center",      icon: Upload,        path: "/imports" },
            { label: "Monitor ETL",        icon: Activity,      path: "/etl" },
            { label: "Mudanças Pendentes", icon: ClipboardList, path: "/pending-changes" },
            { label: "Sem Comunicação",    icon: WifiOff,       path: "/no-communication" },
            { label: "Passagem de Turno",  icon: Send,          path: "/shift-handover" },
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
    return { multiportal: false, tracknme: false, operational: false, policies: false, serviceorders: false, admin: true };
}

// Auto-recolhe apenas no Grid (tabela densa); Home e demais ficam abertos.
const GRID_PATHS = ["/grid"];

export default function Sidebar() {

    const location = useLocation();
    const { user } = useAuthStore();
    const isAdmin = user?.role === "ADMIN" || user?.role === "OPERATOR";
    const isFieldOrTech = user?.role === "FIELD" || user?.role === "TECHNICIAN";

    const isGridPage = GRID_PATHS.includes(location.pathname);

    const [manualOverride, setManualOverride] = useState(null);

    const [hovering, setHovering] = useState(false);

    const [signalControlCount, setSignalControlCount] = useState(0);

    const [installationsCount, setInstallationsCount] = useState(0);

    const [installationsCriticalCount, setInstallationsCriticalCount] = useState(0);

    const [policiesExpiredCount, setPoliciesExpiredCount] = useState(0);

    const [policiesExpiringCount, setPoliciesExpiringCount] = useState(0);

    const [policyAlertsCount, setPolicyAlertsCount] = useState(0);

    const [stockPendingCount, setStockPendingCount] = useState(0);

    const [maintenanceOverdueCount, setMaintenanceOverdueCount] = useState(0);

    const [lettersPendingCount, setLettersPendingCount] = useState(0);

    const prevInstallationsCountRef = useRef(null);

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
        if (isFieldOrTech) return;

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

    }, [isFieldOrTech]);

    useEffect(() => {
        if (isFieldOrTech) return;

        async function loadMaintenanceOverdueCount() {
            try {
                const data = await getOverdueMaintenanceRecords();
                setMaintenanceOverdueCount(Array.isArray(data) ? data.length : 0);
            } catch (error) {
                console.error(error);
            }
        }

        loadMaintenanceOverdueCount();
        const interval = setInterval(loadMaintenanceOverdueCount, POLL_INTERVAL_MS);
        return () => clearInterval(interval);

    }, [isFieldOrTech]);

    useEffect(() => {
        if (isFieldOrTech) return;

        async function loadLettersPendingCount() {
            try {
                const data = await getLettersPendingBaixa();
                setLettersPendingCount(Array.isArray(data) ? data.length : 0);
            } catch (error) {
                console.error(error);
            }
        }

        loadLettersPendingCount();
        const interval = setInterval(loadLettersPendingCount, POLL_INTERVAL_MS);
        return () => clearInterval(interval);

    }, [isFieldOrTech]);

    useEffect(() => {
        if (isFieldOrTech) return;

        async function loadInstallationsCount() {
            try {
                const data = await getInstallationsPendingCount();
                const count = data?.count ?? 0;
                const critical = data?.critical ?? 0;
                if (prevInstallationsCountRef.current !== null && count > prevInstallationsCountRef.current) {
                    notifyInstallationsNew(count - prevInstallationsCountRef.current);
                }
                prevInstallationsCountRef.current = count;
                setInstallationsCount(count);
                setInstallationsCriticalCount(critical);
            } catch (error) {
                console.error(error);
            }
        }

        loadInstallationsCount();
        const interval = setInterval(loadInstallationsCount, POLL_INTERVAL_MS);
        return () => clearInterval(interval);

    }, [isFieldOrTech]);

    useEffect(() => {

        async function loadPolicyCounts() {
            if (!isAdmin) return;
            try {
                const data = await getPolicyBadgeCounts();
                setPoliciesExpiredCount(data?.noPolicy ?? 0);
                setPoliciesExpiringCount(data?.terminated ?? 0);
            } catch (error) {
                console.error(error);
            }
        }

        loadPolicyCounts();
        const interval = setInterval(loadPolicyCounts, POLL_INTERVAL_MS);
        return () => clearInterval(interval);

    }, [isAdmin]);

    useEffect(() => {

        // Soma das 4 categorias da pagina /policies/alerts (Vencidas +
        // Vencendo + Canceladas + Encerradas) — mesma fonte de dados da
        // pagina, pra o numero do badge sempre bater com o que ela mostra.
        async function loadPolicyAlertsCount() {
            if (!isAdmin) return;
            try {
                const [expired, expiring, cancelled, closed] = await Promise.all([
                    getExpiredPolicies(),
                    getExpiringPolicies(30),
                    getCancelledPolicies(),
                    getClosedPolicies(),
                ]);
                const total = [expired, expiring, cancelled, closed]
                    .reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
                setPolicyAlertsCount(total);
            } catch (error) {
                console.error(error);
            }
        }

        loadPolicyAlertsCount();
        const interval = setInterval(loadPolicyAlertsCount, POLL_INTERVAL_MS);
        return () => clearInterval(interval);

    }, [isAdmin]);

    useEffect(() => {

        // Visivel pra todo mundo (ADMIN/OPERATOR/FIELD/TECHNICIAN) — o
        // grupo "Ordens de Servico" (onde fica Estoque) ja e' liberado
        // pra FIELD/TECHNICIAN, entao esse badge nao pode ficar preso a
        // isAdmin como os outros.
        async function loadStockPendingCount() {
            try {
                const data = await getPendingConfirmations();
                setStockPendingCount(Array.isArray(data) ? data.length : 0);
            } catch (error) {
                console.error(error);
            }
        }

        loadStockPendingCount();
        const interval = setInterval(loadStockPendingCount, POLL_INTERVAL_MS);
        return () => clearInterval(interval);

    }, []);

    const badgeCounts = {
        signalControl: signalControlCount,
        installations: installationsCriticalCount,
        policiesExpired: policiesExpiredCount,
        policiesExpiring: policiesExpiringCount,
        policyAlerts: policyAlertsCount,
        stockPending: stockPendingCount,
        maintenanceOverdue: maintenanceOverdueCount,
        lettersPending: lettersPendingCount,
    };

    // Filtra grupos e itens conforme o perfil do usuário
    const visibleGroups = GROUPS
        .filter(group => {
            if (isFieldOrTech && group.key !== "serviceorders") return false;
            if (group.adminOnly && !isAdmin) return false;
            return true;
        })
        .map(group => ({
            ...group,
            items: group.items.filter(item => {
                if (item.adminOnly && !isAdmin) return false;
                return true;
            }),
        }))
        .filter(group => group.items.length > 0);

    return (
        <aside
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
            className={`
                relative flex h-full flex-col
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

                {visibleGroups.map((group) => {

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

                                    const resolvedBadges = item.badges
                                        ? item.badges.filter(b => badgeCounts[b.key] > 0)
                                        : item.badgeKey && badgeCounts[item.badgeKey] > 0
                                        ? [{ key: item.badgeKey, color: "bg-red-500" }]
                                        : [];

                                    return (
                                        <NavLink
                                            key={item.path + item.label}
                                            to={item.path}
                                            end={!!item.end}
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

                                            {resolvedBadges.map((b, i) => (
                                                <span
                                                    key={i}
                                                    className={`rounded-full px-2 py-0.5 text-xs font-bold text-white ${b.color}`}
                                                >
                                                    {badgeCounts[b.key]}
                                                </span>
                                            ))}
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
