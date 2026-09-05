export function todayForFilename() {

  const date = new Date();

  const pad = (n) => String(n).padStart(2, "0");

  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;

}

export function formatDateTimeForExport(value) {

  if (!value) {
    return "";
  }

  const date = new Date(value + "Z"); // força interpretação como UTC

  // date.getHours()/getDate() usam o fuso LOCAL do navegador/maquina
  // que gera o export — em vez de sempre Brasilia, ficava certo so por
  // coincidencia se quem exportasse estivesse nesse fuso. Fixo em
  // America/Sao_Paulo via Intl, mesmo motivo/tecnica do
  // formatLocalDateTime em dateUtils.js.
  const parts = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Sao_Paulo",
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";

  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;

}

export function formatDelayDaysHours(minutes) {

  if (minutes == null) {
    return "";
  }

  const totalHours = Math.floor(minutes / 60);

  const days = Math.floor(totalHours / 24);

  const hours = totalHours % 24;

  return `${days} dias e ${hours}h`;

}
