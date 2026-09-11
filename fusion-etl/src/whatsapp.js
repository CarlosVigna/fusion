const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const path = require('path');
const { log } = require('./file-utils');

let sock = null;
const AUTH_DIR = path.join(__dirname, '../whatsapp-auth');
const GROUP_ID = process.env.WHATSAPP_GROUP_ID; // ex: '120363xxxxxxxx@g.us'

async function connectWhatsApp() {

    if (!GROUP_ID) {
        log('[WHATSAPP] WHATSAPP_GROUP_ID não configurado — conexão não iniciada.');
        return;
    }

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
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            log(`[WHATSAPP] Conexão encerrada — reconectar: ${shouldReconnect}`);
            if (shouldReconnect) setTimeout(connectWhatsApp, 5000);
        }

    });

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
