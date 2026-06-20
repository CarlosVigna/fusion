// Ponto único de entrada do ETL: sobe o agendador (scheduler.js) e a
// API HTTP (server.js) no mesmo processo Node, para facilitar
// monitoramento e reinício (um processo só, em vez de dois separados).
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const logDir = process.env.ETL_LOG_DIR || 'C:/FusionData/log';

fs.mkdirSync(logDir, { recursive: true });

fs.appendFileSync(
    path.join(logDir, 'etl-startup.log'),
    `[${new Date().toISOString()}] ETL iniciado (scheduler + server)\n`
);

console.log('[START] Iniciando scheduler...');
require('./scheduler');

console.log('[START] Iniciando server HTTP...');
require('./server');
