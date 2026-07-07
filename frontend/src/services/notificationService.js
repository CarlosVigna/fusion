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
