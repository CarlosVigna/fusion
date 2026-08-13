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

    // ETL_API_KEY ausente → backend rejeita com 401. Confirmar que a variável
    // está configurada no Railway tanto no backend quanto no ETL com o mesmo valor.
    if (!ETL_API_KEY) {
        log(`[HEARTBEAT] AVISO: ETL_API_KEY não configurada — heartbeat será rejeitado pelo backend (401)`);
    }

    try {

        await axios.get(`${BACKEND_URL}/setup/etl-heartbeat`, {
            params: { type, status, durationMs, error, recordsProcessed, nextRunAt, tk: ETL_API_KEY },
            timeout: 15000,
        });

    } catch (err) {

        log(`[HEARTBEAT] Falha ao reportar status (type=${type}, status=${status}): ${err.message}`);

    }

}

module.exports = { reportHeartbeat };
