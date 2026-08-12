import TracknMeCard from "../components/imports/TracknMeCard";
import MultiportalDeviceCard from "../components/imports/MultiportalDeviceCard";
import MultiportalOperationalCard from "../components/imports/MultiportalOperationalCard";
import EtlTriggersCard from "../components/imports/EtlTriggersCard";
import I4ProTracknMeCard from "../components/imports/I4ProTracknMeCard";

export default function Imports() {
  return (
    <div className="space-y-6">
      <EtlTriggersCard />

      <I4ProTracknMeCard />

      <TracknMeCard />

      <MultiportalDeviceCard />

      <MultiportalOperationalCard />
    </div>
  );
}