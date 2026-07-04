const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { log } = require('./file-utils');

const BACKEND_URL = process.env.BACKEND_URL;
const ETL_API_KEY = process.env.ETL_API_KEY;

// Acorda o Render antes do upload — no plano free o servidor dorme após
// 15 min sem requisições HTTP, e o cold start pode levar até 2-3 min.
// Faz polling em vez de um único GET com timeout longo, para que cada
// tentativa falhe rápido e o log mostre progresso em vez de silêncio.
async function waitForBackend(url) {

    const maxAttempts = 6;
    const waitMs = 30000;

    for (let i = 1; i <= maxAttempts; i++) {

        try {

            console.log(`[UPLOAD] Verificando backend (tentativa ${i}/${maxAttempts})...`);

            await axios.get(`${url}/actuator/health`, { timeout: 30000 });

            console.log('[UPLOAD] Backend disponível.');

            return;

        } catch (e) {

            if (i < maxAttempts) {

                console.log(`[UPLOAD] Backend não respondeu, aguardando ${waitMs / 1000}s...`);

                await new Promise(r => setTimeout(r, waitMs));

            }

        }

    }

    throw new Error('Backend não ficou disponível após 3 minutos');

}

// Sem BACKEND_URL configurado, nao faz nada — comportamento local
// (so salva em pending/) continua igual, pro orquestrador ler sozinho.
// Com BACKEND_URL, entrega o arquivo via HTTP pro backend (necessario
// quando o backend roda na nuvem e nao compartilha mais o sistema de
// arquivos com este PC).
async function uploadToBackend(filePath, type) {

    if (!BACKEND_URL) {
        return;
    }

    await waitForBackend(BACKEND_URL);

    log(`[UPLOAD] Backend disponível. Aguardando estabilização...`);

    await new Promise(r => setTimeout(r, 3000));

    const form = new FormData();

    form.append('file', fs.createReadStream(filePath), path.basename(filePath));
    form.append('type', type);

    try {

        await axios.post(`${BACKEND_URL}/imports/upload`, form, {
            headers: {
                ...form.getHeaders(),
                'X-ETL-Key': ETL_API_KEY,
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            timeout: 120000,
        });

        log(`[UPLOAD] Arquivo enviado para ${BACKEND_URL}/imports/upload (type=${type})`);

    } catch (error) {

        const detail = error.response
            ? `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`
            : error.message;

        log(`[UPLOAD] Falha ao enviar arquivo para o backend (type=${type}): ${detail}`);

        throw error;

    }

}

module.exports = { uploadToBackend };
