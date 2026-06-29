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

  const pad = (n) => String(n).padStart(2, "0");

  return (
    `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );

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
