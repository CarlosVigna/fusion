// Fluxo de aprovacao de pagamento via WhatsApp — comandos digitados no
// MESMO grupo que ja recebe os alertas de instalacao nova (ver
// whatsapp.js). Estado em memoria (perdido num restart do processo,
// mesmo trade-off ja aceito em EtlTriggerService/VerificationJob no
// backend Java — pior caso e' reiniciar a solicitacao com !aprovar de
// novo).
//
// Comandos:
//   !aprovar {placa} {cpf} {valor}   — so' de WHATSAPP_DEILA_NUMBER.
//     Busca o resumo formatado em POST /installations/whatsapp-approve
//     e posta no grupo, abrindo uma pendingApproval pra essa placa.
//   !aprovado {placa}                — so' de WHATSAPP_GERENTE_NUMBER.
//     Chama POST /installations/{id}/approve-payment e fecha a pendencia.
//   !rejeitar {placa}                — so' de WHATSAPP_GERENTE_NUMBER.
//     So' avisa no grupo e fecha a pendencia (nao muda status no backend
//     — nao existe endpoint de "reject"; REVISAR se precisar persistir
//     rejeicao).
//   !cancelar {placa}                — so' de WHATSAPP_DEILA_NUMBER.
//     Desiste da solicitacao antes do gerente responder.
//
// Suporta multiplas aprovacoes simultaneas porque cada uma vive numa
// chave diferente do Map (a placa) — nao ha estado global unico.

const axios = require('axios');
const { log } = require('./file-utils');

const BACKEND_URL = process.env.BACKEND_URL;
const ETL_API_KEY = process.env.ETL_API_KEY;

const WHATSAPP_DEILA_NUMBER = normalizeNumber(process.env.WHATSAPP_DEILA_NUMBER);
const WHATSAPP_GERENTE_NUMBER = normalizeNumber(process.env.WHATSAPP_GERENTE_NUMBER);

const REMINDER_AFTER_MS = 2 * 60 * 60 * 1000; // 2h

// Map<placa, { installationId, requestedBy, reminderTimer }>
const pendingApprovals = new Map();

function normalizeNumber(raw) {
    if (!raw) return null;
    return String(raw).replace(/\D/g, '');
}

function senderNumber(msg) {
    const jid = msg.key.participant || msg.key.remoteJid || '';
    return normalizeNumber(jid.split('@')[0]);
}

function extractText(msg) {
    return (
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        ''
    );
}

async function handleIncomingMessage(msg, sendToGroup) {

    if (msg.key.fromMe) return;

    const text = extractText(msg).trim();

    if (!text.startsWith('!')) return;

    const parts = text.split(/\s+/);
    const command = parts[0].toLowerCase();
    const sender = senderNumber(msg);

    if (!['!aprovar', '!aprovado', '!rejeitar', '!cancelar'].includes(command)) {
        return;
    }

    if (!BACKEND_URL || !ETL_API_KEY) {
        log('[APPROVAL-FLOW] BACKEND_URL/ETL_API_KEY não configurados — comando ignorado');
        return;
    }

    try {

        if (command === '!aprovar') {
            await handleAprovar(parts, sender, sendToGroup);
        } else if (command === '!aprovado') {
            await handleAprovado(parts, sender, sendToGroup);
        } else if (command === '!rejeitar') {
            await handleRejeitar(parts, sender, sendToGroup);
        } else if (command === '!cancelar') {
            await handleCancelar(parts, sender, sendToGroup);
        }

    } catch (e) {

        const detail = e.response?.data?.error || e.message;
        log(`[APPROVAL-FLOW] Erro processando "${text}": ${detail}`);
        await sendToGroup(`⚠️ Erro ao processar "${command}": ${detail}`);

    }

}

async function handleAprovar(parts, sender, sendToGroup) {

    if (sender !== WHATSAPP_DEILA_NUMBER) return;

    const [, plateRaw, cpf, valueStr] = parts;

    if (!plateRaw || !cpf || !valueStr) {
        await sendToGroup('Uso: !aprovar {placa} {cpf} {valor}');
        return;
    }

    const plate = plateRaw.toUpperCase();

    if (pendingApprovals.has(plate)) {
        await sendToGroup(`Já existe uma aprovação pendente para ${plate}. Use !cancelar ${plate} antes de abrir outra.`);
        return;
    }

    const value = Number(valueStr.replace(',', '.'));

    const response = await axios.post(
        `${BACKEND_URL}/installations/whatsapp-approve`,
        { plate, technicianCpf: cpf, value },
        { headers: { 'X-ETL-Key': ETL_API_KEY } }
    );

    const summary = response.data;

    const reminderTimer = setTimeout(
        () => sendReminder(plate, sendToGroup),
        REMINDER_AFTER_MS
    );

    pendingApprovals.set(plate, {
        installationId: summary.installationId,
        requestedBy: sender,
        reminderTimer,
    });

    await sendToGroup(summary.formattedMessage);

    log(`[APPROVAL-FLOW] Aprovação de pagamento iniciada para ${plate} por ${sender}`);

}

async function sendReminder(plate, sendToGroup) {

    if (!pendingApprovals.has(plate)) return;

    await sendToGroup(
        `⏰ LEMBRETE: aprovação de pagamento de ${plate} está pendente há mais de 2h. ` +
        `Responda !aprovado ${plate} ou !rejeitar ${plate}.`
    );

}

async function handleAprovado(parts, sender, sendToGroup) {

    if (sender !== WHATSAPP_GERENTE_NUMBER) return;

    const plate = (parts[1] || '').toUpperCase();
    const pending = pendingApprovals.get(plate);

    if (!pending) {
        await sendToGroup(`Nenhuma aprovação pendente para ${plate}.`);
        return;
    }

    await axios.post(
        `${BACKEND_URL}/installations/${pending.installationId}/approve-payment`,
        null,
        { headers: { 'X-ETL-Key': ETL_API_KEY } }
    );

    clearTimeout(pending.reminderTimer);
    pendingApprovals.delete(plate);

    await sendToGroup(`✅ Pagamento aprovado para ${plate}.`);

    log(`[APPROVAL-FLOW] ${plate} aprovado por ${sender}`);

}

async function handleRejeitar(parts, sender, sendToGroup) {

    if (sender !== WHATSAPP_GERENTE_NUMBER) return;

    const plate = (parts[1] || '').toUpperCase();
    const pending = pendingApprovals.get(plate);

    if (!pending) {
        await sendToGroup(`Nenhuma aprovação pendente para ${plate}.`);
        return;
    }

    clearTimeout(pending.reminderTimer);
    pendingApprovals.delete(plate);

    await sendToGroup(`❌ Pagamento de ${plate} rejeitado.`);

    log(`[APPROVAL-FLOW] ${plate} rejeitado por ${sender}`);

}

async function handleCancelar(parts, sender, sendToGroup) {

    if (sender !== WHATSAPP_DEILA_NUMBER) return;

    const plate = (parts[1] || '').toUpperCase();
    const pending = pendingApprovals.get(plate);

    if (!pending) {
        await sendToGroup(`Nenhuma aprovação pendente para ${plate}.`);
        return;
    }

    clearTimeout(pending.reminderTimer);
    pendingApprovals.delete(plate);

    await sendToGroup(`Solicitação de aprovação de ${plate} cancelada.`);

    log(`[APPROVAL-FLOW] ${plate} cancelado por ${sender}`);

}

module.exports = { handleIncomingMessage };
