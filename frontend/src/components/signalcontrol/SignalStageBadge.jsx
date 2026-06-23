const STAGE_CONFIG = {
  OK: {
    emoji: "🟢",
    label: "OK",
    className: "bg-green-500/10 text-green-400",
  },
  MONITORING: {
    emoji: "🟡",
    label: "Monitorando",
    className: "bg-yellow-500/10 text-yellow-400",
  },
  AWAITING_COMMAND: {
    emoji: "🟡",
    label: "Enviar comandos",
    className: "bg-yellow-500/10 text-yellow-400",
  },
  CONTACT_INSURED: {
    emoji: "🟠",
    label: "Contatar segurado",
    className: "bg-orange-500/10 text-orange-400",
  },
  SUSPENSION_PENDING: {
    emoji: "🔴",
    label: "Carta de suspensão",
    className: "bg-red-500/10 text-red-400",
  },
  MAINTENANCE_PENDING: {
    emoji: "🔴",
    label: "Manutenção",
    className: "bg-red-500/10 text-red-400",
  },
  SIGNAL_RETURNED: {
    emoji: "🟢",
    label: "Sinal retornou — verificar",
    className: "bg-green-500/10 text-green-400",
  },
};

export default function SignalStageBadge({ stage }) {

  const config =
    STAGE_CONFIG[stage] || STAGE_CONFIG.OK;

  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        rounded-full px-3 py-1
        text-xs font-semibold
        ${config.className}
      `}
    >
      <span>{config.emoji}</span>
      {config.label}
    </span>
  );

}
