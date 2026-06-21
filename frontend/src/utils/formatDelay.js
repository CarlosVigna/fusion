export function formatDelay(minutes) {

  if (minutes == null) {
    return "--";
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const totalHours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (totalHours < 24) {
    return remainingMinutes > 0
      ? `${totalHours}h ${remainingMinutes}min`
      : `${totalHours}h`;
  }

  const days = Math.floor(totalHours / 24);
  const remainingHours = totalHours % 24;

  return remainingHours > 0
    ? `${days}d ${remainingHours}h`
    : `${days}d`;

}
