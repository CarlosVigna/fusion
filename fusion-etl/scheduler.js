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

const ONE_HOUR_MS = 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

// Última posição: 1x por hora (no início de cada hora)
scheduleWithRetry(
    '0 * * * *',
    runUltimaPosicao,
    'Última posição',
    'MULTIPORTAL_ULTIMA_POSICAO',
    ONE_HOUR_MS
);

// Dispositivos: 04:00 UTC = 01:00 Brasília
scheduleWithRetry(
    '0 4 * * *',
    runDispositivos,
    'Dispositivos',
    'MULTIPORTAL_DEVICE',
    TWENTY_FOUR_HOURS_MS
);

// Vínculo: 05:00 UTC = 02:00 Brasília (1h após dispositivos para não colidir)
scheduleWithRetry(
    '0 5 * * *',
    runVinculo,
    'Vínculo',
    'MULTIPORTAL_LINKAGE',
    TWENTY_FOUR_HOURS_MS
);

// Instalações: gerenciado pelo InstallationSyncService no backend (@Scheduled 1x por hora, cron "0 0 * * * *")

log('[CRON] Agendador iniciado.');
log('[CRON] Última posição: 1x por hora (início de cada hora).');
log('[CRON] Dispositivos: diariamente às 04:00 UTC (01:00 Brasília).');
log('[CRON] Vínculo: diariamente às 05:00 UTC (02:00 Brasília).');
