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
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

// Última posição: 1x por hora (no início de cada hora)
scheduleWithRetry(
    '0 * * * *',
    runUltimaPosicao,
    'Última posição',
    'MULTIPORTAL_ULTIMA_POSICAO',
    ONE_HOUR_MS
);

// Dispositivos: 3x/dia, 07/13/19 UTC = 04h/10h/16h Brasília (era 1x/dia às 04:00 UTC)
scheduleWithRetry(
    '0 7,13,19 * * *',
    runDispositivos,
    'Dispositivos',
    'MULTIPORTAL_DEVICE',
    SIX_HOURS_MS
);

// Vínculo: 3x/dia, 1min apos dispositivos pra nao colidir (era 1x/dia às 05:00 UTC)
scheduleWithRetry(
    '1 7,13,19 * * *',
    runVinculo,
    'Vínculo',
    'MULTIPORTAL_LINKAGE',
    SIX_HOURS_MS
);

// Instalações: gerenciado pelo InstallationSyncService no backend (@Scheduled a cada 30min, cron "0 0/30 * * * *")

log('[CRON] Agendador iniciado.');
log('[CRON] Última posição: 1x por hora (início de cada hora).');
log('[CRON] Dispositivos: 3x/dia às 07h/13h/19h UTC (04h/10h/16h Brasília).');
log('[CRON] Vínculo: 3x/dia às 07h01/13h01/19h01 UTC (04h01/10h01/16h01 Brasília).');
