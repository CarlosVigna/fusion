require('dotenv').config();

const express = require('express');

const { run: runDevices } = require('./index');
const { run: runLinkage } = require('./index-vinculo');
const { run: runOperational } = require('./index-ultima-posicao');
const { log } = require('./src/file-utils');
const { withRetry } = require('./src/retry');

// Delay menor que o do scheduler (60s) — aqui tem um usuario esperando
// a resposta HTTP do clique em "Atualizar agora".
const HTTP_RETRY_DELAY_MS = 30000;

const app = express();

const PORT = process.env.ETL_SERVER_PORT || 3001;

const running = {
    device: false,
    linkage: false,
    operational: false,
};

async function handleScrape(req, res, key, runFn, label) {

    if (running[key]) {

        return res.status(409).json({
            status: 'ALREADY_RUNNING',
            message: `Scraper de ${label} já está em execução`,
        });

    }

    running[key] = true;

    log(`[server] Scraper ${label} acionado via HTTP`);

    try {

        await withRetry(runFn, label, 1, HTTP_RETRY_DELAY_MS);

        log(`[server] Scraper ${label} concluído com sucesso`);

        res.json({
            status: 'SUCCESS',
            message: `Scraper de ${label} concluído`,
        });

    } catch (error) {

        log(`[server] Erro no scraper ${label}: ${error.message}`);

        res.status(500).json({
            status: 'ERROR',
            message: error.message,
        });

    } finally {

        running[key] = false;

    }

}

app.post('/scrape/device', (req, res) =>
    handleScrape(req, res, 'device', runDevices, 'dispositivos')
);

app.post('/scrape/linkage', (req, res) =>
    handleScrape(req, res, 'linkage', runLinkage, 'vínculo')
);

app.post('/scrape/operational', (req, res) =>
    handleScrape(req, res, 'operational', runOperational, 'última posição')
);

app.get('/health', (req, res) => {
    res.json({ status: 'UP', running });
});

app.listen(PORT, () => {
    console.log(`[ETL SERVER] Rodando na porta ${PORT}`);
});
