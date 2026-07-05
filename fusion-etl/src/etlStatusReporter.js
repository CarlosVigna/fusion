const axios = require('axios');
const { log } = require('./file-utils');

const BACKEND_URL = process.env.BACKEND_URL;
const ETL_API_KEY = process.env.ETL_API_KEY;

// Reporta status pro backend (RUNNING/SUCCESS/ERROR) — alimenta a tela
// de monitoramento do ETL no Fusion. Sem BACKEND_URL configurado (uso
// 100% local, sem nuvem), so' loga local e nao tenta nada por HTTP.
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

        await axios.post(`${BACKEND_URL}/etl/status`, {
            type,
            status,
            durationMs,
            error,
            recordsProcessed,
            nextRunAt,
        }, {
            headers: { 'X-ETL-Key': ETL_API_KEY },
            timeout: 15000,
        });

    } catch (err) {

        log(`[HEARTBEAT] Falha ao reportar status (type=${type}, status=${status}): ${err.message}`);

    }

}

module.exports = { reportHeartbeat };
