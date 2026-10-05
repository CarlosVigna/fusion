const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const path = require('path');
const { log } = require('./file-utils');
const approvalFlow = require('./approvalFlow');

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

        // Mensagens recebidas no grupo — roteadas pro fluxo de aprovacao
        // de pagamento (approvalFlow.js). Ignora qualquer chat que nao
        // seja o grupo configurado (DM avulsa, outro grupo) e mensagens
        // do tipo != 'notify' (historico sincronizado na reconexao, nao
        // mensagem nova de verdade).
        sock.ev.on('messages.upsert', async ({ messages, type }) => {

            if (type !== 'notify' || !GROUP_ID) return;

            for (const msg of messages) {

                if (msg.key.remoteJid !== GROUP_ID) continue;

                try {
                    await approvalFlow.handleIncomingMessage(msg, sendToGroup);
                } catch (e) {
                    log(`[WHATSAPP] Erro processando mensagem recebida: ${e.message}`);
                }

            }

        });

        sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {

            if (connection === 'open') {

                log('[WHATSAPP] Conectado.');

                // TEMPORARIO — lista os grupos que o bot participa, pra
                // descobrir o GROUP_ID certo sem precisar expor porta HTTP
                // nesse processo (start.js e' de proposito outbound-only,
                // atras do NAT, sem tunel/IP publico). Remover depois de
                // confirmar o GROUP_ID.
                try {
                    const groups = await sock.groupFetchAllParticipating();
                    const list = Object.values(groups).map(g => `${g.id} — ${g.subject}`);
                    log(`[WHATSAPP] Grupos participando (${list.length}):\n${list.join('\n')}`);
                } catch (e) {
                    log(`[WHATSAPP] Falha ao listar grupos: ${e.message}`);
                }

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
