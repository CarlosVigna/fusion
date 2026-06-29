import { Outlet } from "react-router-dom";

import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";
import EtlStatusBanner from "../components/operational/EtlStatusBanner";

export default function AppLayout() {
  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100 print:h-auto">
      <div className="print:hidden">
        <EtlStatusBanner />
      </div>

      <div className="flex flex-1 overflow-hidden print:overflow-visible">
        <div className="print:hidden">
          <Sidebar />
        </div>

        <div className="flex flex-1 flex-col overflow-hidden print:overflow-visible">
          <div className="print:hidden">
            <Header />
          </div>

          <main className="flex-1 overflow-y-auto print:overflow-visible">
            <div className="min-w-full p-6 print:p-0">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}