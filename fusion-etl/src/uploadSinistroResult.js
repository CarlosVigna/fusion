const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { log } = require('./file-utils');

const BACKEND_URL = process.env.BACKEND_URL;
const ETL_API_KEY = process.env.ETL_API_KEY;

// Entrega o resultado (ou o erro) de uma analise de Sinistro pro backend
// — mesmo padrao do uploadToBackend.js usado pelos outros scrapers, mas
// com varios arquivos (1 KM Mensal + N blocos de Excesso de Velocidade)
// e o sinistroId pra identificar qual analise esta sendo concluida.
async function uploadSinistroResult({
    sinistroId,
    kmMensalFile,
    speedFiles = [],
    ignicaoFile,
    status = 'SUCCESS',
    error,
}) {

    if (!BACKEND_URL) {

        log('[SINISTRO] BACKEND_URL não configurado — resultado não enviado (modo local).');

        return;

    }

    const form = new FormData();

    form.append('sinistroId', sinistroId);
    form.append('status', status);

    if (error) {
        form.append('error', error);
    }

    if (kmMensalFile && fs.existsSync(kmMensalFile)) {
        form.append('kmMensalFile', fs.createReadStream(kmMensalFile), path.basename(kmMensalFile));
    }

    for (const speedFile of speedFiles) {
        if (fs.existsSync(speedFile)) {
            form.append('speedFiles', fs.createReadStream(speedFile), path.basename(speedFile));
        }
    }

    if (ignicaoFile && fs.existsSync(ignicaoFile)) {
        form.append('ignicaoFile', fs.createReadStream(ignicaoFile), path.basename(ignicaoFile));
    }

    try {

        await axios.post(`${BACKEND_URL}/sinistro/upload`, form, {
            headers: {
                ...form.getHeaders(),
                'X-ETL-Key': ETL_API_KEY,
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            timeout: 120000,
        });

        log(`[SINISTRO] Resultado da análise ${sinistroId} enviado (status=${status}).`);

    } catch (uploadError) {

        const detail = uploadError.response
            ? `HTTP ${uploadError.response.status}: ${JSON.stringify(uploadError.response.data)}`
            : uploadError.message;

        log(`[SINISTRO] Falha ao enviar resultado da análise ${sinistroId}: ${detail}`);

        throw uploadError;

    }

}

module.exports = { uploadSinistroResult };
