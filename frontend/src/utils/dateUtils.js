// Converte uma data UTC do banco para exibição no horário de Brasília —
// fixo, independente do fuso do navegador, para bater com o Multiportal.
export function formatLocalDateTime(utcString) {
  if (!utcString) return "--";
  const date = new Date(utcString + "Z"); // força interpretação como UTC
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

// Formata só a data
export function formatLocalDate(utcString) {
  if (!utcString) return "--";
  const date = new Date(utcString + "Z");
  return date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

// Formata só a hora
export function formatLocalTime(utcString) {
  if (!utcString) return "--";
  const date = new Date(utcString + "Z");
  return date.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
