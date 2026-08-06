import {
    Routes,
    Route,
    Navigate,
    Outlet,
} from "react-router-dom";

import { useAuthStore } from "../store/authStore";

import AppLayout from "../layouts/AppLayout";

import Home from "../pages/Home";

function HomeRedirect() {
    const { user } = useAuthStore();
    if (user?.role === "FIELD" || user?.role === "TECHNICIAN") {
        return <Navigate to="/service-orders/dashboard" replace />;
    }
    return <Home />;
}

function FullAccessOnly() {
    const { user } = useAuthStore();
    if (user?.role === "FIELD" || user?.role === "TECHNICIAN") {
        return <Navigate to="/service-orders/dashboard" replace />;
    }
    return <Outlet />;
}
import Dashboard from "../pages/Dashboard";
import Grid from "../pages/Grid";
import Imports from "../pages/Imports";
import Vehicles from "../pages/Vehicles";
import SignalControl from "../pages/SignalControl";
import Letters from "../pages/Letters";
import Maintenance from "../pages/Maintenance";
import Policies from "../pages/Policies";
import EtlMonitor from "../pages/EtlMonitor";
import Reports from "../pages/Reports";
import AnaliseSinistro from "../pages/AnaliseSinistro";
import Users from "../pages/Users";
import Account from "../pages/Account";
import Login from "../pages/Login";
import VehicleDetails from "../pages/VehicleDetails";

import MicrosoftCallback from "../pages/MicrosoftCallback";
import ShiftHandover from "../pages/ShiftHandover";
import ServiceOrderDashboard from "../pages/ServiceOrderDashboard";
import ServiceOrders from "../pages/ServiceOrders";
import Technicians from "../pages/Technicians";
import ServiceOrdersReports from "../pages/ServiceOrdersReports";

import ProtectedRoute from "./ProtectedRoute";

export default function AppRoutes() {
    return (
        <Routes>
            <Route
                path="/login"
                element={<Login />}
            />

            <Route
                path="/auth/microsoft/callback"
                element={
                    <ProtectedRoute>
                        <MicrosoftCallback />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/"
                element={
                    <ProtectedRoute>
                        <AppLayout />
                    </ProtectedRoute>
                }
            >
                <Route index element={<HomeRedirect />} />

                <Route
                    path="account"
                    element={<Account />}
                />

                <Route
                    path="service-orders/dashboard"
                    element={<ServiceOrderDashboard />}
                />

                <Route
                    path="service-orders"
                    element={<ServiceOrders />}
                />

                <Route
                    path="service-orders/reports"
                    element={<ServiceOrdersReports />}
                />

                {/* Rotas bloqueadas para FIELD e TECHNICIAN */}
                <Route element={<FullAccessOnly />}>
                    <Route path="dashboard"        element={<Dashboard />} />
                    <Route path="grid"             element={<Grid />} />
                    <Route path="imports"          element={<Imports />} />
                    <Route path="vehicles"         element={<Vehicles />} />
                    <Route path="vehicles/:plate"  element={<VehicleDetails />} />
                    <Route path="signal-control"   element={<SignalControl />} />
                    <Route path="letters"          element={<Letters />} />
                    <Route path="maintenance"      element={<Maintenance />} />
                    <Route path="policies"         element={<Policies />} />
                    <Route path="etl"              element={<EtlMonitor />} />
                    <Route path="reports"          element={<Reports />} />
                    <Route path="sinistro"         element={<AnaliseSinistro />} />
                    <Route path="users"            element={<Users />} />
                    <Route path="shift-handover"   element={<ShiftHandover />} />
                    <Route path="technicians"      element={<Technicians />} />
                </Route>
            </Route>

            <Route
                path="*"
                element={<Navigate to="/" replace />}
            />
        </Routes>
    );
}