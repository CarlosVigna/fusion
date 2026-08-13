const axios = require('axios');
const { log } = require('./file-utils');

const BACKEND_URL = process.env.BACKEND_URL;

// Reporta status pro backend (RUNNING/SUCCESS/ERROR) — alimenta a tela
// de monitoramento do ETL no Fusion. Sem BACKEND_URL configurado (uso
// 100% local, sem nuvem), so' loga local e nao tenta nada por HTTP.
//
// Sem chave/token — /setup/etl-heartbeat nao valida mais nada, fica
// protegido so pelo permitAll() de /setup/** no backend.
async function reportHeartbeat({
    type,
    status,
    durationMs,
    error,
    recordsProcessed,
    nextRunAt,
}) {

    if (!BACKEND_URL) {
        return;
    }

    try {

        await axios.get(`${BACKEND_URL}/setup/etl-heartbeat`, {
            params: { type, status, durationMs, error, recordsProcessed, nextRunAt },
            timeout: 15000,
        });

    } catch (err) {

        log(`[HEARTBEAT] Falha ao reportar status (type=${type}, status=${status}): ${err.message}`);

    }

}

module.exports = { reportHeartbeat };
