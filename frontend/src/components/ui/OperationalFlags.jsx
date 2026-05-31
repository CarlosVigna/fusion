export default function OperationalFlags({
  vehicle,
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {vehicle.lowBattery && (
        <span
          className="
            rounded-full
            bg-yellow-500/15
            px-2 py-1 text-xs
            font-semibold text-yellow-400
          "
        >
          LOW BATTERY
        </span>
      )}

      {vehicle.staleUpdate && (
        <span
          className="
            rounded-full
            bg-red-500/15
            px-2 py-1 text-xs
            font-semibold text-red-400
          "
        >
          STALE
        </span>
      )}

      {vehicle.inMaintenance && (
        <span
          className="
            rounded-full
            bg-blue-500/15
            px-2 py-1 text-xs
            font-semibold text-blue-400
          "
        >
          MAINTENANCE
        </span>
      )}

      {!vehicle.online && (
        <span
          className="
            rounded-full
            bg-red-500/15
            px-2 py-1 text-xs
            font-semibold text-red-400
          "
        >
          OFFLINE
        </span>
      )}
    </div>
  );
}