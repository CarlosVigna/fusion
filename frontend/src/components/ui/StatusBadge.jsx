const statusStyles = {
  ONLINE:
    "bg-green-500/15 text-green-400",

  OFFLINE:
    "bg-red-500/15 text-red-400",

  STALE:
    "bg-red-500/15 text-red-400",

  LOW_BATTERY:
    "bg-yellow-500/15 text-yellow-400",

  MAINTENANCE:
    "bg-blue-500/15 text-blue-400",
};

export default function StatusBadge({
  status,
}) {
  const style =
    statusStyles[status] ||
    "bg-zinc-500/15 text-zinc-400";

  return (
    <span
      className={`
        inline-flex items-center
        rounded-full px-3 py-1
        text-xs font-semibold
        ${style}
      `}
    >
      {status || "UNKNOWN"}
    </span>
  );
}