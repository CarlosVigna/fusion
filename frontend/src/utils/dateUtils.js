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

// Formata só a data.
// Strings date-only (yyyy-MM-dd) são tratadas como data de calendário — sem
// conversão de fuso — para evitar que "2025-01-01Z" (inválido) ou UTC-3
// desloque o dia exibido. Strings com horário seguem o path UTC→Brasília.
export function formatLocalDate(str) {
  if (!str) return "--";
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split("-");
    return `${d}/${m}/${y}`;
  }
  const date = new Date(str + "Z");
  return date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

// Formata só a hora
export function formatLocalTime(utcString) {
  if (!utcString) return "--";
  const date = new Date(utcString + "Z");
  return date.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

// Calcula atraso em minutos a partir do timestamp UTC do banco.
// Chamado a cada minuto via setInterval para manter o valor ao vivo.
export function calculateDelayMinutes(lastCommunicationAt) {
  if (!lastCommunicationAt) return null;
  const last = new Date(lastCommunicationAt + "Z");
  return Math.max(0, Math.floor((Date.now() - last.getTime()) / 60000));
}
