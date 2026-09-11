const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const path = require('path');
const { log } = require('./file-utils');

let sock = null;
const AUTH_DIR = path.join(__dirname, '../whatsapp-auth');
const GROUP_ID = process.env.WHATSAPP_GROUP_ID; // ex: '120363xxxxxxxx@g.us'

async function connectWhatsApp() {

    if (!GROUP_ID) {
        log('[WHATSAPP] WHATSAPP_GROUP_ID não configurado ainda.');
    }

    try {

        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

        sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            logger: require('pino')({ level: 'silent' })
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {

            if (connection === 'open') {
                log('[WHATSAPP] Conectado.');
            }

            if (connection === 'close') {

                // statusCode logado explicitamente (nao so' o boolean) pra
                // dar pra diagnosticar de verdade qual DisconnectReason
                // causou o fechamento, em vez de so' ver "reconectar: false"
                // sem saber o motivo.
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const isLoggedOut = statusCode === DisconnectReason.loggedOut;

                log(`[WHATSAPP] Conexão encerrada (statusCode=${statusCode}) — reconectar: ${!isLoggedOut}`);

                if (!isLoggedOut) {
                    setTimeout(connectWhatsApp, 5000);
                } else {
                    log('[WHATSAPP] Sessão deslogada (statusCode 401) — não reconecta sozinho. Apague fusion-etl/whatsapp-auth e reinicie pra parear de novo.');
                }

            }

        });

    } catch (e) {

        // Sem isso, uma falha aqui (ex.: whatsapp-auth/ corrompido ou
        // ausente depois de um redeploy) nunca chega no listener de
        // connection.update acima — o processo simplesmente nunca mais
        // tentaria se conectar, silenciosamente, sem nenhum log de erro.
        log(`[WHATSAPP] Falha ao conectar: ${e.message} — tentando de novo em 5s`);
        setTimeout(connectWhatsApp, 5000);

    }

}

async function sendToGroup(message) {
    if (!sock || !GROUP_ID) return;
    try {
        await sock.sendMessage(GROUP_ID, { text: message });
        console.log('[WHATSAPP] Mensagem enviada ao grupo');
    } catch(e) {
        console.log('[WHATSAPP] Erro ao enviar:', e.message);
    }
}

module.exports = { connectWhatsApp, sendToGroup };
