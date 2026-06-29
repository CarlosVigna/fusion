// Ponto único de entrada do ETL: sobe o agendador (scheduler.js) e o
// polling de atualização manual (triggerPoller.js) no mesmo processo
// Node. Não expõe mais nenhuma porta HTTP — o ETL só faz chamadas de
// saída (poll + upload), nunca recebe chamadas de fora, então não
// precisa mais de túnel/IP público pra "Atualizar agora" funcionar.
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const logDir = process.env.ETL_LOG_DIR || 'C:/FusionData/log';

fs.mkdirSync(logDir, { recursive: true });

fs.appendFileSync(
    path.join(logDir, 'etl-startup.log'),
    `[${new Date().toISOString()}] ETL iniciado (scheduler + polling)\n`
);

console.log('[START] Iniciando scheduler...');
require('./scheduler');

console.log('[START] Iniciando polling de atualização manual...');
require('./src/triggerPoller').start();
