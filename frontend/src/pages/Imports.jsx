import TracknMeCard from "../components/imports/TracknMeCard";

import MultiportalDeviceCard from "../components/imports/MultiportalDeviceCard";

import MultiportalOperationalCard from "../components/imports/MultiportalOperationalCard";

import EtlTriggersCard from "../components/imports/EtlTriggersCard";

export default function Imports() {
  return (
    <div className="space-y-6">
      <EtlTriggersCard />

      <TracknMeCard />

      <MultiportalDeviceCard />

      <MultiportalOperationalCard />
    </div>
  );
}