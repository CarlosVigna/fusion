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

    const ultimaPosicao = {
        run: require('../index-ultima-posicao').run,
        label: 'última posição',
    };

    return {
        MULTIPORTAL_DEVICE: {
            run: require('../index').run,
            label: 'dispositivos',
        },
        MULTIPORTAL_LINKAGE: {
            run: require('../index-vinculo').run,
            label: 'vínculo',
        },
        // Mesmo job, dois nomes de ImportType diferentes em uso: o cron
        // deste arquivo (scheduler.js) reporta heartbeat como
        // MULTIPORTAL_ULTIMA_POSICAO, mas so' MULTIPORTAL_OPERATIONAL
        // estava registrado aqui. Um POST /imports/trigger?type=
        // MULTIPORTAL_ULTIMA_POSICAO manual caia nesse buraco: o backend
        // enfileirava normalmente, o ETL buscava via /etl/poll, mas
        // `runners[data.type]` batia em undefined — sem runner, sem
        // heartbeat, sem log, sem erro. Ficava pendurado ate' expirar
        // sozinho, e o Monitor ETL nunca mostrava nada. Registrando as
        // duas chaves pro mesmo runner ate' unificar em um nome so'.
        MULTIPORTAL_OPERATIONAL: ultimaPosicao,
        MULTIPORTAL_ULTIMA_POSICAO: ultimaPosicao,
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

    if (data?.type) {
        log(`[POLL] Trigger recebido: type=${data.type}`);
        log(`[POLL] Runner encontrado: ${!!runners[data.type]}`);
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

        // Esvazia a fila imediatamente sem esperar o próximo tick do
        // setInterval (15s). Se DEVICE + LINKAGE + ULTIMA_POSICAO
        // chegaram juntos, processa um, termina, e já busca o próximo
        // em vez de aguardar 15s parado. Se a fila estiver vazia, o
        // poll retorna sem fazer nada e o setInterval assume de novo.
        setTimeout(() => pollOnce(runners), 500);

        return;

    }

    // Busca de apolices i4pro — recebe placa opcional (null = bulk).
    // Retorna {populated, notFound} incluido no heartbeat de resultado.
    if (data?.type === 'I4PRO') {

        running = true;

        const startedAt    = Date.now();
        const triggerPlate = data.triggerPlate || null;

        log(`[POLL] Busca i4pro recebida (placa=${triggerPlate || 'bulk'})`);

        await reportHeartbeat({ type: 'I4PRO', status: 'RUNNING' });

        try {

            const { populated, notFound } = await require('../index-i4pro').run(triggerPlate);

            await reportHeartbeat({
                type: 'I4PRO',
                status: 'SUCCESS',
                durationMs: Date.now() - startedAt,
                recordsProcessed: populated,
            });

            log(`[POLL] i4pro concluido — ${populated} populadas, ${notFound} nao encontradas`);

        } catch (error) {

            await reportHeartbeat({
                type: 'I4PRO',
                status: 'ERROR',
                durationMs: Date.now() - startedAt,
                error: error.message,
            });

        } finally {

            running = false;

        }

        setTimeout(() => pollOnce(runners), 500);

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

        // Idem: esvazia a fila em vez de aguardar o próximo tick.
        setTimeout(() => pollOnce(runners), 500);

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
