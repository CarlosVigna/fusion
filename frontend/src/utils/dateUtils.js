// Converte uma data UTC do banco para exibição no fuso local do navegador
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
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, // fuso do navegador
  });
}

// Formata só a data
export function formatLocalDate(utcString) {
  if (!utcString) return "--";
  const date = new Date(utcString + "Z");
  return date.toLocaleDateString("pt-BR");
}

// Formata só a hora
export function formatLocalTime(utcString) {
  if (!utcString) return "--";
  const date = new Date(utcString + "Z");
  return date.toLocaleTimeString("pt-BR");
}
