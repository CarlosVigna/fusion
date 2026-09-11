const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const path = require('path');
const { log } = require('./file-utils');

let sock = null;
const AUTH_DIR = path.join(__dirname, '../whatsapp-auth');
const GROUP_ID = process.env.WHATSAPP_GROUP_ID; // ex: '120363xxxxxxxx@g.us'

async function connectWhatsApp() {

    // Sem WHATSAPP_GROUP_ID ainda da' pra conectar — e' exatamente o
    // caso de descobrir o ID pela primeira vez (ver listener de grupos
    // abaixo). sendToGroup() ja' e' seguro sem GROUP_ID (no-op).
    if (!GROUP_ID) {
        log('[WHATSAPP] WHATSAPP_GROUP_ID não configurado ainda — conectando mesmo assim para listar os grupos disponíveis.');
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: require('pino')({ level: 'silent' })
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {

        if (connection === 'open') {

            log('[WHATSAPP] Conectado.');

            // TEMPORÁRIO — remover depois de copiar o ID do grupo certo
            // (ex: "Teste de integração") e configurar WHATSAPP_GROUP_ID.
            try {

                const groups = await sock.groupFetchAllParticipating();

                Object.values(groups).forEach(g => {
                    console.log(`[WHATSAPP] Grupo: "${g.subject}" → ID: ${g.id}`);
                });

            } catch (e) {

                console.log('[WHATSAPP] Erro ao listar grupos:', e.message);

            }

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
