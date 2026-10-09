// Fluxo de aprovacao de pagamento via WhatsApp — comandos digitados no
// MESMO grupo que ja recebe os alertas de instalacao nova (ver
// whatsapp.js). Estado em memoria (perdido num restart do processo,
// mesmo trade-off ja aceito em EtlTriggerService/VerificationJob no
// backend Java — pior caso e' reiniciar a solicitacao com !aprovar de
// novo).
//
// Migrado pra trabalhar com Ordens de Servico (ServiceOrder) em vez
// do fluxo antigo de Installation — tecnico, distanceKm e
// displacementValue agora vem direto da OS (ja calculados antes, no
// fluxo normal de agendamento em updateScheduling()), entao !aprovar
// so' precisa da placa — nao pede mais cpf/valor como antes.
//
// Comandos:
//   !aprovar {placa}      — so' de WHATSAPP_DEILA_NUMBER.
//     Busca a OS aberta em GET /service-orders/by-plate, monta a
//     mensagem com os dados ja calculados na OS e posta no grupo,
//     abrindo uma pendingApproval pra essa placa.
//   !aprovado {placa}     — so' de WHATSAPP_GERENTE_NUMBER.
//     Chama PUT /service-orders/{id}/financial-approval-whatsapp com
//     financialApprovalStatus=APROVADO e fecha a pendencia.
//   !rejeitar {placa}     — so' de WHATSAPP_GERENTE_NUMBER.
//     Mesma chamada com financialApprovalStatus=REPROVADO — ao
//     contrario do fluxo antigo (Installation nao tinha essa opcao),
//     agora reprovar de fato reverte a OS pro estado ABERTO no
//     backend (ver ServiceOrderService.updateFinancialApproval()).
//   !cancelar {placa}     — so' de WHATSAPP_DEILA_NUMBER.
//     Desiste da solicitacao antes do gerente responder — so' estado
//     local, nao chama o backend.
//
// Suporta multiplas aprovacoes simultaneas porque cada uma vive numa
// chave diferente do Map (a placa) — nao ha estado global unico.
//
// Fase 2 — fluxo paralelo para Instalacoes:
//   !aprovar-inst {placa} {valor} {cpf} — so' de WHATSAPP_DEILA_NUMBER
//   !aprovado-inst {placa}              — so' de WHATSAPP_GERENTE_NUMBER
//   !rejeitar-inst {placa}              — so' de WHATSAPP_GERENTE_NUMBER
//   !cancelar-inst {placa}              — so' de WHATSAPP_DEILA_NUMBER

const axios = require('axios');
const { log } = require('./file-utils');

const BACKEND_URL = process.env.BACKEND_URL;
const ETL_API_KEY = process.env.ETL_API_KEY;

const WHATSAPP_DEILA_NUMBER = normalizeNumber(process.env.WHATSAPP_DEILA_NUMBER);
const WHATSAPP_GERENTE_NUMBER = normalizeNumber(process.env.WHATSAPP_GERENTE_NUMBER);

const REMINDER_AFTER_MS = 2 * 60 * 60 * 1000; // 2h

// Map<placa, { serviceOrderId, requestedBy, reminderTimer }>
const pendingApprovals = new Map();

// Map<placa, { installationId, technicianId, declaredValue, calculatedKm, calculatedDisplacement, requestedBy, reminderTimer }>
const pendingInstApprovals = new Map();

function normalizeNumber(raw) {
    if (!raw) return null;
    return String(raw).replace(/\D/g, '');
}

// Em grupo, msg.key.participant e' o JID de quem enviou — mas o WhatsApp
// passou a entregar como LID (ex.: 86625228967979@lid), cujos digitos
// NAO sao o telefone. Nesse caso o Baileys 7 traz o JID de telefone em
// participantAlt (5517996230262@s.whatsapp.net), que e' o que bate com
// WHATSAPP_*_NUMBER. Tira tambem o sufixo de device (":12") antes de
// extrair os digitos, senao ele vira parte do numero.
function senderNumber(msg) {
    const candidates = [msg.key.participant, msg.key.participantAlt, msg.key.remoteJid]
        .filter(Boolean);
    const jid = candidates.find(j => j.endsWith('@s.whatsapp.net')) || candidates[0] || '';
    return normalizeNumber(jid.split('@')[0].split(':')[0]);
}

function extractText(msg) {
    return (
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        ''
    );
}

function fmtMoney(value) {
    return value != null ? Number(value).toFixed(2) : '0.00';
}

function buildApprovalMessage(so) {
    const lines = [
        '*SOLICITAÇÃO DE APROVAÇÃO DE PAGAMENTO*',
        '',
        `PLACA: ${so.plate || '--'}`,
        `CLIENTE: ${so.customerName || '--'}`,
        `TÉCNICO: ${so.technician ? so.technician.name : '--'}`,
        `VALOR DO SERVIÇO: R$ ${fmtMoney(so.serviceValue)}`,
    ];

    if (so.distanceKm != null) {
        lines.push(`DISTÂNCIA (ida+volta): ${so.distanceKm} km`);
        lines.push(`DESLOCAMENTO: R$ ${fmtMoney(so.displacementValue)}`);
    } else {
        lines.push('DISTÂNCIA: não calculada ainda nessa OS');
    }

    lines.push(`TOTAL: R$ ${fmtMoney(so.totalValue)}`);
    lines.push('');
    lines.push(`Responda !aprovado ${so.plate} ou !rejeitar ${so.plate}`);

    return lines.join('\n');
}

async function handleIncomingMessage(msg, sendToGroup) {

    if (msg.key.fromMe) return;

    const text = extractText(msg).trim();

    if (!text.startsWith('!')) return;

    const parts = text.split(/\s+/);
    const command = parts[0].toLowerCase();
    const sender = senderNumber(msg);

    if (!['!aprovar', '!aprovado', '!rejeitar', '!cancelar',
          '!aprovar-inst', '!aprovado-inst', '!rejeitar-inst', '!cancelar-inst'].includes(command)) {
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
            await handleDecisao(parts, sender, sendToGroup, 'APROVADO');
        } else if (command === '!rejeitar') {
            await handleDecisao(parts, sender, sendToGroup, 'REPROVADO');
        } else if (command === '!cancelar') {
            await handleCancelar(parts, sender, sendToGroup);
        } else if (command === '!aprovar-inst') {
            await handleAprovarInst(parts, sender, sendToGroup);
        } else if (command === '!aprovado-inst') {
            await handleDecisaoInst(parts, sender, sendToGroup, 'APROVADO');
        } else if (command === '!rejeitar-inst') {
            await handleDecisaoInst(parts, sender, sendToGroup, 'REPROVADO');
        } else if (command === '!cancelar-inst') {
            await handleCancelarInst(parts, sender, sendToGroup);
        }

    } catch (e) {

        const detail = e.response?.data?.error || e.message;
        log(`[APPROVAL-FLOW] Erro processando "${text}": ${detail}`);
        await sendToGroup(`⚠️ Erro ao processar "${command}": ${detail}`);

    }

}

async function handleAprovar(parts, sender, sendToGroup) {

    if (sender !== WHATSAPP_DEILA_NUMBER) return;

    const plateRaw = parts[1];

    if (!plateRaw) {
        await sendToGroup('Uso: !aprovar {placa}');
        return;
    }

    const plate = plateRaw.toUpperCase();

    if (pendingApprovals.has(plate)) {
        await sendToGroup(`Já existe uma aprovação pendente para ${plate}. Use !cancelar ${plate} antes de abrir outra.`);
        return;
    }

    const response = await axios.get(
        `${BACKEND_URL}/service-orders/by-plate`,
        {
            params: { plate },
            headers: { 'X-ETL-Key': ETL_API_KEY },
        }
    );

    const so = response.data;

    const reminderTimer = setTimeout(
        () => sendReminder(plate, sendToGroup),
        REMINDER_AFTER_MS
    );

    pendingApprovals.set(plate, {
        serviceOrderId: so.id,
        requestedBy: sender,
        reminderTimer,
    });

    await sendToGroup(buildApprovalMessage(so));

    log(`[APPROVAL-FLOW] Aprovação de pagamento iniciada para ${plate} por ${sender} (OS ${so.id})`);

}

async function sendReminder(plate, sendToGroup) {

    if (!pendingApprovals.has(plate)) return;

    await sendToGroup(
        `⏰ LEMBRETE: aprovação de pagamento de ${plate} está pendente há mais de 2h. ` +
        `Responda !aprovado ${plate} ou !rejeitar ${plate}.`
    );

}

async function handleDecisao(parts, sender, sendToGroup, financialApprovalStatus) {

    if (sender !== WHATSAPP_GERENTE_NUMBER) return;

    const plate = (parts[1] || '').toUpperCase();
    const pending = pendingApprovals.get(plate);

    if (!pending) {
        await sendToGroup(`Nenhuma aprovação pendente para ${plate}.`);
        return;
    }

    await axios.put(
        `${BACKEND_URL}/service-orders/${pending.serviceOrderId}/financial-approval-whatsapp`,
        { financialApprovalStatus },
        { headers: { 'X-ETL-Key': ETL_API_KEY } }
    );

    clearTimeout(pending.reminderTimer);
    pendingApprovals.delete(plate);

    const emoji = financialApprovalStatus === 'APROVADO' ? '✅' : '❌';
    const label = financialApprovalStatus === 'APROVADO' ? 'aprovado' : 'rejeitado';
    await sendToGroup(`${emoji} Pagamento de ${plate} ${label}.`);

    log(`[APPROVAL-FLOW] ${plate} ${label} por ${sender} (OS ${pending.serviceOrderId})`);

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

// ─── Fase 2: fluxo de instalações ────────────────────────────────────────────

async function handleAprovarInst(parts, sender, sendToGroup) {
    if (sender !== WHATSAPP_DEILA_NUMBER) {
        log(`[APPROVAL-FLOW-INST] !aprovar-inst ignorado: sender=${sender} esperado=${WHATSAPP_DEILA_NUMBER}`);
        return;
    }

    // !aprovar-inst {placa} {valor} {cpf}
    const plateRaw = parts[1];
    const declaredValueRaw = parts[2];
    const cpfRaw = parts[3];

    if (!plateRaw || !declaredValueRaw || !cpfRaw) {
        await sendToGroup('Uso: !aprovar-inst {placa} {valor} {cpf_tecnico}');
        return;
    }

    const plate = plateRaw.toUpperCase();
    const declaredValue = parseFloat(declaredValueRaw.replace(',', '.'));
    const cpf = cpfRaw.replace(/\D/g, '');

    if (isNaN(declaredValue)) {
        await sendToGroup(`Valor inválido: ${declaredValueRaw}`);
        return;
    }

    if (pendingInstApprovals.has(plate)) {
        await sendToGroup(`Já existe aprovação de instalação pendente para ${plate}. Use !cancelar-inst ${plate} antes.`);
        return;
    }

    // Busca a instalação
    const instResp = await axios.get(`${BACKEND_URL}/installations/by-plate`, {
        params: { plate },
        headers: { 'X-ETL-Key': ETL_API_KEY },
    });
    const inst = instResp.data;

    // Busca o técnico por CPF
    const techResp = await axios.get(`${BACKEND_URL}/technicians/by-cpf`, {
        params: { cpf },
        headers: { 'X-ETL-Key': ETL_API_KEY },
    });
    const tech = techResp.data;

    if (!tech.latitude || !tech.longitude) {
        await sendToGroup(`⚠️ Técnico ${tech.name} não tem coordenadas cadastradas. Atualize o cadastro antes.`);
        return;
    }

    // Calcula deslocamento via backend (Nominatim + OSRM)
    let calculatedKm = null;
    let calculatedDisplacement = null;
    let calcWarning = '';

    try {
        const calcResp = await axios.get(
            `${BACKEND_URL}/installations/${inst.id}/calculate-displacement`,
            {
                params: { technicianId: tech.id },
                headers: { 'X-ETL-Key': ETL_API_KEY },
            }
        );
        calculatedKm = calcResp.data.km;
        calculatedDisplacement = calcResp.data.displacement;

        if (calculatedDisplacement != null && calculatedDisplacement > 0) {
            const diff = Math.abs(declaredValue - calculatedDisplacement) / calculatedDisplacement;
            if (diff > 0.20) {
                calcWarning = `\n⚠️ ATENÇÃO: diferença de ${(diff * 100).toFixed(0)}% entre declarado e calculado`;
            }
        }
    } catch (calcErr) {
        const errMsg = calcErr.response?.data?.error || calcErr.message;
        calcWarning = `\n⚠️ Não foi possível calcular automaticamente: ${errMsg}`;
        log(`[APPROVAL-FLOW-INST] Erro no cálculo para ${plate}: ${errMsg}`);
    }

    const lines = [
        '*SOLICITAÇÃO DE APROVAÇÃO — DESLOCAMENTO INSTALAÇÃO*',
        '',
        `PLACA: ${inst.plate || plate}`,
        `SEGURADO: ${inst.customerName || '--'}`,
        `TÉCNICO: ${tech.name}`,
        `CPF TÉCNICO: ${cpfRaw}`,
        `VALOR DECLARADO: R$ ${declaredValue.toFixed(2)}`,
    ];

    if (calculatedKm != null) {
        lines.push(`DISTÂNCIA CALCULADA (ida+volta): ${calculatedKm} km`);
        lines.push(`DESLOCAMENTO CALCULADO: R$ ${calculatedDisplacement != null ? Number(calculatedDisplacement).toFixed(2) : '0.00'}`);
    }

    if (calcWarning) lines.push(calcWarning);

    lines.push('');
    lines.push(`Responda !aprovado-inst ${plate} ou !rejeitar-inst ${plate}`);

    const reminderTimer = setTimeout(
        () => sendReminderInst(plate, sendToGroup),
        REMINDER_AFTER_MS
    );

    pendingInstApprovals.set(plate, {
        installationId: inst.id,
        technicianId: tech.id,
        declaredValue,
        calculatedKm,
        calculatedDisplacement,
        requestedBy: sender,
        reminderTimer,
    });

    await sendToGroup(lines.join('\n'));
    log(`[APPROVAL-FLOW-INST] Aprovação instalação iniciada para ${plate} técnico ${tech.name}`);
}

async function sendReminderInst(plate, sendToGroup) {
    if (!pendingInstApprovals.has(plate)) return;
    await sendToGroup(
        `⏰ LEMBRETE: aprovação de deslocamento de instalação ${plate} pendente há mais de 2h. ` +
        `Responda !aprovado-inst ${plate} ou !rejeitar-inst ${plate}.`
    );
}

async function handleDecisaoInst(parts, sender, sendToGroup, financialApprovalStatus) {
    if (sender !== WHATSAPP_GERENTE_NUMBER) return;

    const plate = (parts[1] || '').toUpperCase();
    const pending = pendingInstApprovals.get(plate);

    if (!pending) {
        await sendToGroup(`Nenhuma aprovação de instalação pendente para ${plate}.`);
        return;
    }

    await axios.put(
        `${BACKEND_URL}/installations/${pending.installationId}/financial-approval`,
        {
            financialApprovalStatus,
            declaredValue: pending.declaredValue,
            technicianId: pending.technicianId,
            calculatedKm: pending.calculatedKm || null,
            calculatedDisplacement: pending.calculatedDisplacement || null,
        },
        { headers: { 'X-ETL-Key': ETL_API_KEY } }
    );

    clearTimeout(pending.reminderTimer);
    pendingInstApprovals.delete(plate);

    const emoji = financialApprovalStatus === 'APROVADO' ? '✅' : '❌';
    const label = financialApprovalStatus === 'APROVADO' ? 'aprovado' : 'rejeitado';
    await sendToGroup(`${emoji} Deslocamento de instalação ${plate} ${label}.`);
    log(`[APPROVAL-FLOW-INST] Instalação ${plate} ${label} por ${sender}`);
}

async function handleCancelarInst(parts, sender, sendToGroup) {
    if (sender !== WHATSAPP_DEILA_NUMBER) return;

    const plate = (parts[1] || '').toUpperCase();
    const pending = pendingInstApprovals.get(plate);

    if (!pending) {
        await sendToGroup(`Nenhuma aprovação de instalação pendente para ${plate}.`);
        return;
    }

    clearTimeout(pending.reminderTimer);
    pendingInstApprovals.delete(plate);
    await sendToGroup(`Solicitação de aprovação de instalação ${plate} cancelada.`);
    log(`[APPROVAL-FLOW-INST] Instalação ${plate} cancelada por ${sender}`);
}

module.exports = { handleIncomingMessage };
