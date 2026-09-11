const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const qrcode = require('qrcode-terminal');

async function connect() {
    const { state, saveCreds } = await useMultiFileAuthState(
        path.join(__dirname, 'whatsapp-auth')
    );
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['Fusion', 'Chrome', '120.0.0'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
    });

    sock.ev.on('creds.update', saveCreds);
    
    sock.ev.on('connection.update', async ({ connection, qr, lastDisconnect }) => {
        if (qr) {
            console.log('\n=== ESCANEIE O QR CODE ABAIXO ===\n');
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'open') {
            console.log('\n[CONECTADO!] Listando grupos...\n');
            const groups = await sock.groupFetchAllParticipating();
            Object.values(groups).forEach(g => {
                console.log(`Grupo: "${g.subject}" → ID: ${g.id}`);
            });
        }
        if (connection === 'close') {
            const code = lastDisconnect?.error?.output?.statusCode;
            console.log('Conexão fechada. Código:', code);
            if (code !== DisconnectReason.loggedOut) {
                console.log('Tentando reconectar...');
                setTimeout(connect, 5000);
            }
        }
    });
}

connect().catch(console.error);