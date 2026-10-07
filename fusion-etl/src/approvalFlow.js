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
// Fase 2 — fluxo paralelo pra aprovacao de pagamento de Installation
// (!aprovar-inst), independente do fluxo de ServiceOrder acima (Map
// separado, pendingInstApprovals, mesmo que a placa coincida):
//   !aprovar-inst {placa} {valor} {cpf_tecnico}  — so' de
//     WHATSAPP_DEILA_NUMBER. Busca a instalacao via GET /installations/
//     by-plate e o tecnico via GET /technicians/by-cpf, confere que o
//     tecnico tem lat/lon cadastrada e abre a pendencia com o valor
//     declarado (digitado no comando, nao calculado).
//   !aprovado-inst / !rejeitar-inst {placa} — so' de
//     WHATSAPP_GERENTE_NUMBER. Chama PUT /installations/{id}/
//     financial-approval com o valor declarado.
//   !cancelar-inst {placa} — so' de WHATSAPP_DEILA_NUMBER, estado local.
//
// Fase 2c — calculo de deslocamento migrado pro proprio ETL (Node, ver
// ./geocode.js) em vez de chamar o backend: geocode.maps.co responde
// quando chamado do browser ou daqui, mas falha quando chamado do
// backend Java no Railway (InstallationService.calculateDisplacement()
// e o endpoint GET /installations/{id}/calculate-displacement foram
// removidos por isso). !aprovar-inst geocodifica o endereco do cliente
// e calcula ida+volta via OSRM direto aqui. Se der certo, o km e o
// deslocamento calculados entram na mensagem pro gerente e sao
// guardados em pendingInstApprovals pra ir junto no PUT de aprovacao.
// Se falhar (geocode nao achou endereco, OSRM fora do ar etc.), NAO
// bloqueia a solicitacao — so' entra um aviso ⚠️ na mensagem e os campos
// calculados ficam null.

const axios = require('axios');
const { log } = require('./file-utils');
const { geocode, calculateRoundTripKm, calculateDisplacement } = require('./geocode');

const BACKEND_URL = process.env.BACKEND_URL;
const ETL_API_KEY = process.env.ETL_API_KEY;

const WHATSAPP_DEILA_NUMBER = normalizeNumber(process.env.WHATSAPP_DEILA_NUMBER);
const WHATSAPP_GERENTE_NUMBER = normalizeNumber(process.env.WHATSAPP_GERENTE_NUMBER);

const REMINDER_AFTER_MS = 2 * 60 * 60 * 1000; // 2h

// Map<placa, { serviceOrderId, requestedBy, reminderTimer }>
const pendingApprovals = new Map();

// Map<placa, { installationId, technicianId, declaredValue, requestedBy, reminderTimer }>
const pendingInstApprovals = new Map();

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

function fmtMoney(value) {
    return value != null ? Number(value).toFixed(2) : '0.00';
}

// Separador decimal brasileiro (110,00) — so' pra mensagens novas do
// fluxo !aprovar-inst; buildApprovalMessage (ServiceOrder) continua com
// ponto, de proposito, pra nao mudar o formato de algo que ja' esta' em
// produção sem pedido.
function fmtMoneyBr(value) {
    return fmtMoney(value).replace('.', ',');
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

function buildInstApprovalMessage(installation, technician, declaredValue, calculatedKm, calculatedDisplacement, warning) {
    const lines = [
        '*SOLICITAÇÃO DE APROVAÇÃO — INSTALAÇÃO*',
        '',
        `PLACA: ${installation.plate || '--'}`,
        `SEGURADO: ${installation.customerName || '--'}`,
        `TÉCNICO: ${technician.name || '--'}`,
        `CPF TÉCNICO: ${technician.cpf || '--'}`,
        `VALOR DECLARADO: R$ ${fmtMoneyBr(declaredValue)}`,
    ];

    // So' mostra as duas linhas de calculo quando o calculo deu certo —
    // quando falha, warning (calcNote) ja' explica o motivo, sem linha
    // de "nao disponivel" redundante.
    if (calculatedKm != null) {
        lines.push(`DISTÂNCIA CALCULADA: ${calculatedKm} km (ida+volta)`);
        lines.push(`DESLOCAMENTO CALCULADO: R$ ${fmtMoneyBr(calculatedDisplacement)}`);
    }

    if (warning) {
        lines.push(warning);
    }

    lines.push('');
    lines.push(`Responda !aprovado-inst ${installation.plate} ou !rejeitar-inst ${installation.plate}`);

    return lines.join('\n');
}

async function handleIncomingMessage(msg, sendToGroup) {

    if (msg.key.fromMe) return;

    const textDebug = extractText(msg).trim();
    const senderDebug = senderNumber(msg);
    log(`[APPROVAL-FLOW DEBUG] msg recebida — sender: ${senderDebug}, text: "${textDebug}"`);

    const text = extractText(msg).trim();

    if (!text.startsWith('!')) return;

    const parts = text.split(/\s+/);
    const command = parts[0].toLowerCase();
    const sender = senderNumber(msg);

    if (![
        '!aprovar', '!aprovado', '!rejeitar', '!cancelar',
        '!aprovar-inst', '!aprovado-inst', '!rejeitar-inst', '!cancelar-inst',
    ].includes(command)) {
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

async function handleAprovarInst(parts, sender, sendToGroup) {

    if (sender !== WHATSAPP_DEILA_NUMBER) return;

    const plateRaw = parts[1];
    const valorRaw = parts[2];
    const cpfRaw = parts[3];

    if (!plateRaw || !valorRaw || !cpfRaw) {
        await sendToGroup('Uso: !aprovar-inst {placa} {valor} {cpf_tecnico}');
        return;
    }

    const plate = plateRaw.toUpperCase();
    const declaredValue = Number(valorRaw.replace(',', '.'));

    if (Number.isNaN(declaredValue)) {
        await sendToGroup('Valor inválido. Uso: !aprovar-inst {placa} {valor} {cpf_tecnico}');
        return;
    }

    if (pendingInstApprovals.has(plate)) {
        await sendToGroup(`Já existe uma aprovação de instalação pendente para ${plate}. Use !cancelar-inst ${plate} antes de abrir outra.`);
        return;
    }

    const installationResponse = await axios.get(
        `${BACKEND_URL}/installations/by-plate`,
        {
            params: { plate },
            headers: { 'X-ETL-Key': ETL_API_KEY },
        }
    );

    const installation = installationResponse.data;

    const technicianResponse = await axios.get(
        `${BACKEND_URL}/technicians/by-cpf`,
        {
            params: { cpf: cpfRaw },
            headers: { 'X-ETL-Key': ETL_API_KEY },
        }
    );

    const technician = technicianResponse.data;

    let calculatedKm = null;
    let calculatedDisplacement = null;
    let warning = '';

    try {

        const clientCoords = await geocode(installation.address, installation.city, installation.state);
        calculatedKm = await calculateRoundTripKm(
            technician.latitude, technician.longitude,
            clientCoords.lat, clientCoords.lon
        );
        calculatedDisplacement = calculateDisplacement(calculatedKm);

        if (declaredValue > 0) {
            const diffPct = Math.abs(declaredValue - calculatedDisplacement) / declaredValue * 100;
            if (diffPct > 20) {
                warning = `⚠️ ATENÇÃO: diferença de ${diffPct.toFixed(0)}% entre declarado e calculado.`;
            }
        }

    } catch (e) {

        log(`[APPROVAL-FLOW] Falha ao calcular deslocamento de ${plate}: ${e.message}`);
        warning = `⚠️ Cálculo automático indisponível: ${e.message}`;

    }

    const reminderTimer = setTimeout(
        () => sendReminderInst(plate, sendToGroup),
        REMINDER_AFTER_MS
    );

    pendingInstApprovals.set(plate, {
        installationId: installation.id,
        technicianId: technician.id,
        declaredValue,
        calculatedKm,
        calculatedDisplacement,
        requestedBy: sender,
        reminderTimer,
    });

    await sendToGroup(buildInstApprovalMessage(installation, technician, declaredValue, calculatedKm, calculatedDisplacement, warning));

    log(`[APPROVAL-FLOW] Aprovação de instalação iniciada para ${plate} por ${sender} (installation ${installation.id})`);

}

async function sendReminderInst(plate, sendToGroup) {

    if (!pendingInstApprovals.has(plate)) return;

    await sendToGroup(
        `⏰ LEMBRETE: aprovação de instalação de ${plate} está pendente há mais de 2h. ` +
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
            calculatedKm: pending.calculatedKm,
            calculatedDisplacement: pending.calculatedDisplacement,
        },
        { headers: { 'X-ETL-Key': ETL_API_KEY } }
    );

    clearTimeout(pending.reminderTimer);
    pendingInstApprovals.delete(plate);

    const emoji = financialApprovalStatus === 'APROVADO' ? '✅' : '❌';
    const label = financialApprovalStatus === 'APROVADO' ? 'aprovado' : 'rejeitado';
    await sendToGroup(`${emoji} Pagamento de instalação de ${plate} ${label}.`);

    log(`[APPROVAL-FLOW] Instalação ${plate} ${label} por ${sender} (installation ${pending.installationId})`);

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

    await sendToGroup(`Solicitação de aprovação de instalação de ${plate} cancelada.`);

    log(`[APPROVAL-FLOW] Instalação ${plate} cancelada por ${sender}`);

}

module.exports = { handleIncomingMessage };
