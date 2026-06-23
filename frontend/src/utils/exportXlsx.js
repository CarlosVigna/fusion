import * as XLSX from "xlsx";

export function exportRowsToXlsx(filename, headers, rows) {

  const worksheet = XLSX.utils.aoa_to_sheet([
    headers,
    ...rows,
  ]);

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    "Sheet1"
  );

  XLSX.writeFile(workbook, filename);

}

export function todayForFilename() {

  const date = new Date();

  const pad = (n) => String(n).padStart(2, "0");

  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;

}

export function formatDateTimeForExport(value) {

  if (!value) {
    return "";
  }

  const date = new Date(value);

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
