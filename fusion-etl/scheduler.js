require('dotenv').config();

const cron = require('node-cron');

const { run: runUltimaPosicao } = require('./index-ultima-posicao');
const { run: runDispositivos } = require('./index');
const { run: runVinculo } = require('./index-vinculo');
const { log } = require('./src/file-utils');
const { withRetry } = require('./src/retry');
const { reportHeartbeat } = require('./src/etlStatusReporter');

// withRetry ja loga e relanca o erro definitivo — aqui so precisamos
// absorver essa rejeicao pra nao gerar um unhandled promise rejection,
// ja que o cron nao tem ninguem aguardando o resultado.
function scheduleWithRetry(cronExpression, fn, name, type, nextRunOffsetMs) {

    cron.schedule(cronExpression, async () => {

        const startedAt = Date.now();

        await reportHeartbeat({ type, status: 'RUNNING' });

        try {

            await withRetry(fn, name);

            await reportHeartbeat({
                type,
                status: 'SUCCESS',
                durationMs: Date.now() - startedAt,
                nextRunAt: new Date(Date.now() + nextRunOffsetMs).toISOString(),
            });

        } catch (error) {

            await reportHeartbeat({
                type,
                status: 'ERROR',
                durationMs: Date.now() - startedAt,
                error: error.message,
                nextRunAt: new Date(Date.now() + nextRunOffsetMs).toISOString(),
            });

        }

    });

}

const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

// Última posição: a cada 30 minutos
scheduleWithRetry(
    '*/30 * * * *',
    runUltimaPosicao,
    'Última posição',
    'MULTIPORTAL_ULTIMA_POSICAO',
    THIRTY_MINUTES_MS
);

// Dispositivos e vínculo: uma vez por dia às 02:00
scheduleWithRetry(
    '0 2 * * *',
    runDispositivos,
    'Dispositivos',
    'MULTIPORTAL_DEVICE',
    TWENTY_FOUR_HOURS_MS
);

scheduleWithRetry(
    '0 2 * * *',
    runVinculo,
    'Vínculo',
    'MULTIPORTAL_LINKAGE',
    TWENTY_FOUR_HOURS_MS
);

log('[CRON] Agendador iniciado.');
log('[CRON] Última posição: a cada 30 minutos.');
log('[CRON] Dispositivos e vínculo: diariamente às 02:00.');
