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
        logger: pino({ level: 'silent' })
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
            console.log('Conexão fechada.');
            process.exit(0);
        }
    });
}

connect().catch(console.error);