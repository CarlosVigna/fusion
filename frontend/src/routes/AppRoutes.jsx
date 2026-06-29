import {
    Routes,
    Route,
    Navigate,
} from "react-router-dom";

import AppLayout from "../layouts/AppLayout";

import Dashboard from "../pages/Dashboard";
import Grid from "../pages/Grid";
import Imports from "../pages/Imports";
import Vehicles from "../pages/Vehicles";
import Monitoring from "../pages/Monitoring";
import SignalControl from "../pages/SignalControl";
import Letters from "../pages/Letters";
import Maintenance from "../pages/Maintenance";
import EtlMonitor from "../pages/EtlMonitor";
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
                    element={<Grid />}
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
                    path="audit"
                    element={<Monitoring />}
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
                    path="etl"
                    element={<EtlMonitor />}
                />
            </Route>

            <Route
                path="*"
                element={<Navigate to="/" replace />}
            />
        </Routes>
    );
}