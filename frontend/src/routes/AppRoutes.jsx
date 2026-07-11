import {
    Routes,
    Route,
    Navigate,
} from "react-router-dom";

import AppLayout from "../layouts/AppLayout";

import Home from "../pages/Home";
import Dashboard from "../pages/Dashboard";
import Grid from "../pages/Grid";
import Imports from "../pages/Imports";
import Vehicles from "../pages/Vehicles";
import SignalControl from "../pages/SignalControl";
import Letters from "../pages/Letters";
import Maintenance from "../pages/Maintenance";
import Installations from "../pages/Installations";
import InstallationReports from "../pages/InstallationReports";
import Policies from "../pages/Policies";
import EtlMonitor from "../pages/EtlMonitor";
import Reports from "../pages/Reports";
import Account from "../pages/Account";
import Login from "../pages/Login";
import VehicleDetails from "../pages/VehicleDetails";

import ProtectedRoute from "./ProtectedRoute";

export default function AppRoutes() {
    return (
        <Routes>
            <Route
                path="/login"
                element={<Login />}
            />

            <Route
                path="/"
                element={
                    <ProtectedRoute>
                        <AppLayout />
                    </ProtectedRoute>
                }
            >
                <Route
                    index
                    element={<Home />}
                />

                <Route
                    path="dashboard"
                    element={<Dashboard />}
                />

                <Route
                    path="grid"
                    element={<Grid />}
                />

                <Route
                    path="imports"
                    element={<Imports />}
                />

                <Route
                    path="vehicles"
                    element={<Vehicles />}
                />

                <Route
                    path="vehicles/:plate"
                    element={<VehicleDetails />}
                />

                <Route
                    path="signal-control"
                    element={<SignalControl />}
                />

                <Route
                    path="letters"
                    element={<Letters />}
                />

                <Route
                    path="maintenance"
                    element={<Maintenance />}
                />

                <Route
                    path="installations"
                    element={<Installations />}
                />

                <Route
                    path="installations/reports"
                    element={<InstallationReports />}
                />

                <Route
                    path="policies"
                    element={<Policies />}
                />

                <Route
                    path="etl"
                    element={<EtlMonitor />}
                />

                <Route
                    path="reports"
                    element={<Reports />}
                />

                <Route
                    path="account"
                    element={<Account />}
                />
            </Route>

            <Route
                path="*"
                element={<Navigate to="/" replace />}
            />
        </Routes>
    );
}