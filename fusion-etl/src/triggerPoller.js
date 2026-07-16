const axios = require('axios');
const { log } = require('./file-utils');
const { withRetry } = require('./retry');
const { reportHeartbeat } = require('./etlStatusReporter');

const BACKEND_URL = process.env.BACKEND_URL;
const ETL_API_KEY = process.env.ETL_API_KEY;
const POLL_INTERVAL_MS = 15000;
const POLL_RETRY_DELAY_MS = 30000;

// O backend nunca consegue chamar o ETL direto (ele esta atras do NAT
// da rede do usuario, sem tunel/IP publico) — entao e' o ETL quem
// pergunta periodicamente "tem pedido pendente?" via GET /etl/poll.
// Substitui o antigo server.js (que expunha /scrape/* esperando uma
// chamada de fora, o que so funcionava com um tunel ativo).
function buildRunners() {

    return {
        MULTIPORTAL_DEVICE: {
            run: require('../index').run,
            label: 'dispositivos',
        },
        MULTIPORTAL_LINKAGE: {
            run: require('../index-vinculo').run,
            label: 'vínculo',
        },
        MULTIPORTAL_OPERATIONAL: {
            run: require('../index-ultima-posicao').run,
            label: 'última posição',
        },
    };

}

let running = false;

async function pollOnce(runners) {

    if (running) {
        return;
    }

    let data;

    try {

        const response = await axios.get(`${BACKEND_URL}/etl/poll`, {
            headers: { 'X-ETL-Key': ETL_API_KEY },
            timeout: 10000,
        });

        data = response.data;

    } catch {

        // Backend fora do ar ou sem rede — tenta de novo no proximo
        // tick, sem logar a cada 15s pra nao poluir o log local.
        return;

    }

    const runner = data?.type && runners[data.type];

    if (runner) {

        running = true;

        const startedAt = Date.now();

        log(`[POLL] Pedido de atualização manual recebido (${runner.label})`);

        await reportHeartbeat({ type: data.type, status: 'RUNNING' });

        try {

            await withRetry(runner.run, runner.label, 1, POLL_RETRY_DELAY_MS);

            await reportHeartbeat({
                type: data.type,
                status: 'SUCCESS',
                durationMs: Date.now() - startedAt,
            });

        } catch (error) {

            await reportHeartbeat({
                type: data.type,
                status: 'ERROR',
                durationMs: Date.now() - startedAt,
                error: error.message,
            });

        } finally {

            running = false;

        }

        return;

    }

    // Analise de Sinistro — job parametrizado (placa/periodo), por isso
    // nao cabe no mapa fixo de runners por ImportType. Nao usa o
    // heartbeat de EtlStatus: o proprio index-sinistro.js reporta
    // sucesso/erro direto em /sinistro/upload, e a UI acompanha via
    // GET /sinistro/{id}/status, nao pela tela de monitoramento do ETL.
    if (data?.sinistroJob) {

        running = true;

        const job = data.sinistroJob;

        log(`[POLL] Análise de Sinistro pendente recebida (placa=${job.plate}, id=${job.id})`);

        try {

            await require('../index-sinistro').run(job);

        } catch (error) {

            log(`[POLL] Análise de Sinistro ${job.id} falhou: ${error.message}`);

        } finally {

            running = false;

        }

    }

}

function start() {

    if (!BACKEND_URL) {

        log('[POLL] BACKEND_URL não configurado — "Atualizar agora" fica desativado (polling não inicia).');

        return;

    }

    const runners = buildRunners();

    log(`[POLL] Polling de atualização manual iniciado (a cada ${POLL_INTERVAL_MS / 1000}s).`);

    setInterval(() => pollOnce(runners), POLL_INTERVAL_MS);

}

module.exports = { start };
