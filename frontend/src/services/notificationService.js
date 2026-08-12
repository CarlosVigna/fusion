export async function requestPermission() {
  if (!('Notification' in window)) return false;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export function notifyNewInstallation(installation) {
  if (Notification.permission !== 'granted') return;
  const n = new Notification('Fusion — Nova Instalação', {
    body: `${installation.customerName} — ${installation.plate}\n${installation.city}/${installation.state}`,
    icon: '/favicon.ico',
    tag: `installation-${installation.id}`,
  });
  n.onclick = () => {
    window.focus();
    window.location.href = '/installations';
  };
}

export function notifyI4ProComplete(populated, notFound) {
  if (Notification.permission !== 'granted') return;
  const total = populated + notFound;
  const body = total > 0
    ? `${populated} de ${total} placa(s) com apólice encontrada` +
      (notFound > 0 ? ` (${notFound} não encontradas)` : '')
    : 'Nenhuma placa pendente processada';
  const n = new Notification('Fusion — Apólices i4pro', {
    body,
    icon: '/favicon.ico',
    tag: 'i4pro-complete',
  });
  n.onclick = () => {
    window.focus();
    window.location.href = '/tracknme/pending';
  };
}

export function notifyInstallationsNew(delta) {
  if (Notification.permission !== 'granted') return;
  const n = new Notification('Fusion — Nova Instalação', {
    body: `${delta} nova${delta > 1 ? 's instalações pendentes' : ' instalação pendente'}`,
    icon: '/favicon.ico',
    tag: 'installation-new',
  });
  n.onclick = () => {
    window.focus();
    window.location.href = '/installations';
  };
}
