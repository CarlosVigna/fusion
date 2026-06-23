require('dotenv').config();

const cron = require('node-cron');

const { run: runUltimaPosicao } = require('./index-ultima-posicao');
const { run: runDispositivos } = require('./index');
const { run: runVinculo } = require('./index-vinculo');
const { log } = require('./src/file-utils');
const { withRetry } = require('./src/retry');

// withRetry ja loga e relanca o erro definitivo — aqui so precisamos
// absorver essa rejeicao pra nao gerar um unhandled promise rejection,
// ja que o cron nao tem ninguem aguardando o resultado.
function scheduleWithRetry(cronExpression, fn, name) {

    cron.schedule(cronExpression, () => {

        withRetry(fn, name).catch(() => {});

    });

}

// Última posição: a cada 30 minutos
scheduleWithRetry('*/30 * * * *', runUltimaPosicao, 'Última posição');

// Dispositivos e vínculo: uma vez por dia às 02:00
scheduleWithRetry('0 2 * * *', runDispositivos, 'Dispositivos');
scheduleWithRetry('0 2 * * *', runVinculo, 'Vínculo');

log('[CRON] Agendador iniciado.');
log('[CRON] Última posição: a cada 30 minutos.');
log('[CRON] Dispositivos e vínculo: diariamente às 02:00.');
