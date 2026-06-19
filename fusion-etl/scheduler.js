require('dotenv').config();

const cron = require('node-cron');

const { run: runUltimaPosicao } = require('./index-ultima-posicao');
const { run: runDispositivos } = require('./index');
const { run: runVinculo } = require('./index-vinculo');

// Última posição: a cada 30 minutos
cron.schedule('*/30 * * * *', async () => {

    console.log(
        '[CRON]',
        new Date().toISOString(),
        '— rodando última posição...'
    );

    try {

        await runUltimaPosicao();

        console.log('[CRON] última posição concluída');

    } catch (err) {

        console.error(
            '[CRON] erro última posição:',
            err.message
        );

    }

});

// Dispositivos e vínculo: uma vez por dia às 02:00
cron.schedule('0 2 * * *', async () => {

    console.log(
        '[CRON]',
        new Date().toISOString(),
        '— rodando dispositivos e vínculo...'
    );

    try {

        await runDispositivos();
        await runVinculo();

        console.log('[CRON] dispositivos e vínculo concluídos');

    } catch (err) {

        console.error(
            '[CRON] erro dispositivos/vínculo:',
            err.message
        );

    }

});

console.log('[CRON] Agendador iniciado.');
console.log('[CRON] Última posição: a cada 30 minutos.');
console.log('[CRON] Dispositivos e vínculo: diariamente às 02:00.');
