// Status das instalacoes no portal parceiro (portalStatus, vindo da
// Installation vinculada a OS) e seus rotulos — compartilhado entre a
// tela de Instalacoes (abas) e o Relatorio de Instalacoes.
export const PORTAL_STATUSES = [
  { key: "AGUARDANDO_AGENDAMENTO",       label: "Aguardando Agendamento" },
  { key: "AGENDADO_AGUARDANDO_ATIVACAO", label: "Ag. Ativação" },
  { key: "AGUARDANDO_INSTALACAO",        label: "Aguardando Instalação" },
  { key: "PENDENTE_INSTALACAO",          label: "Pendente" },
  { key: "INSTALACAO_EM_ANALISE",        label: "Em Análise" },
  { key: "INSTALACAO_ENVIADA",           label: "Enviada" },
  { key: "INSTALACAO_CONCLUIDA_SUCESSO", label: "Concluída ✅" },
  { key: "INSTALACAO_CONCLUIDA_FALHA",   label: "Falha ❌" },
];

export function portalStatusLabel(status) {
  if (!status) return "—";
  return PORTAL_STATUSES.find((s) => s.key === status)?.label ?? status;
}
