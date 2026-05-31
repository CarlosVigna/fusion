import TracknMeCard from "../components/imports/TracknMeCard";

import MultiportalDeviceCard from "../components/imports/MultiportalDeviceCard";

import MultiportalOperationalCard from "../components/imports/MultiportalOperationalCard";

export default function Imports() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          Import Center
        </h1>

        <p className="mt-1 text-zinc-400">
          Central operacional de
          importações
        </p>
      </div>

      <TracknMeCard />

      <MultiportalDeviceCard />

      <MultiportalOperationalCard />
    </div>
  );
}