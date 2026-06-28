import TracknMeCard from "../components/imports/TracknMeCard";

import MultiportalDeviceCard from "../components/imports/MultiportalDeviceCard";

import MultiportalOperationalCard from "../components/imports/MultiportalOperationalCard";

export default function Imports() {
  return (
    <div className="space-y-6">
      <TracknMeCard />

      <MultiportalDeviceCard />

      <MultiportalOperationalCard />
    </div>
  );
}