const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { log } = require('./file-utils');

const BACKEND_URL = process.env.BACKEND_URL;
const ETL_API_KEY = process.env.ETL_API_KEY;

// Sem BACKEND_URL configurado, nao faz nada — comportamento local
// (so salva em pending/) continua igual, pro orquestrador ler sozinho.
// Com BACKEND_URL, entrega o arquivo via HTTP pro backend (necessario
// quando o backend roda na nuvem e nao compartilha mais o sistema de
// arquivos com este PC).
async function uploadToBackend(filePath, type) {

    if (!BACKEND_URL) {
        return;
    }

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
