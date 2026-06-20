import { Outlet } from "react-router-dom";

import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";
import EtlStatusBanner from "../components/operational/EtlStatusBanner";

export default function AppLayout() {
  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <EtlStatusBanner />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />

          <main className="flex-1 overflow-y-auto">
            <div className="min-w-full p-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}