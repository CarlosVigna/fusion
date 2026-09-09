require('dotenv').config();

const { log } = require('./src/file-utils');

// Crons automáticos (Última posição, Dispositivos, Vínculo) removidos —
// tudo isso agora só roda via trigger manual (botões do Import Center),
// atendido pelo polling de 15s em src/triggerPoller.js. Instalações
// continua gerenciado pelo InstallationSyncService no backend
// (@Scheduled a cada 30min). i4pro continua só manual via trigger, como
// já era.
log('[CRON] Agendador iniciado — sem crons automáticos (tudo via trigger manual).');
