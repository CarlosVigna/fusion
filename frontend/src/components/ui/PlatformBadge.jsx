const platformStyles = {
  TRACKNME:
    "bg-blue-500/15 text-blue-400",

  MULTIPORTAL:
    "bg-purple-500/15 text-purple-400",
};

export default function PlatformBadge({
  platform,
}) {
  const style =
    platformStyles[platform] ||
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
      {platform || "UNKNOWN"}
    </span>
  );
}