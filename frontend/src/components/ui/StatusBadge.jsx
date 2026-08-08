const statusStyles = {
  ONLINE:
    "bg-green-200 text-green-800 dark:bg-green-500/15 dark:text-green-400",

  OFFLINE:
    "bg-red-200 text-red-800 dark:bg-red-500/15 dark:text-red-400",

  STALE:
    "bg-red-200 text-red-800 dark:bg-red-500/15 dark:text-red-400",

  LOW_BATTERY:
    "bg-yellow-200 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-400",

  MAINTENANCE:
    "bg-blue-200 text-blue-800 dark:bg-blue-500/15 dark:text-blue-400",
};

export default function StatusBadge({
  status,
}) {
  const style =
    statusStyles[status] ||
    "bg-gray-100 text-gray-600 dark:bg-zinc-500/15 dark:text-zinc-400";

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