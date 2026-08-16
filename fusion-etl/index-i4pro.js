require('dotenv').config();
const path = require('path');
const { chromium } = require('playwright');
const axios = require('axios');
const { log } = require('./src/file-utils');
const { reportHeartbeat } = require('./src/etlStatusReporter');

const SCREENSHOT_DIR = path.join(process.env.ETL_LOG_DIR || 'C:/FusionData/log', 'screenshots');

// ── Variáveis de ambiente ────────────────────────────────────────────────────
// I4PRO_URL           — URL base do i4pro (ex: https://i4pro.usebens.com.br)
// I4PRO_USER          — nm_usuario de login
// I4PRO_PASSWORD      — senha
// BACKEND_URL         — URL do backend Fusion
// FUSION_ETL_USER     — e-mail do usuário Fusion (ADMIN)
// FUSION_ETL_PASSWORD — senha do usuário Fusion

const I4PRO_URL  = (process.env.I4PRO_URL  || '').replace(/\/$/, '');
const I4PRO_USER = process.env.I4PRO_USER;
const I4PRO_PASS = process.env.I4PRO_PASSWORD;
const BACKEND    = (process.env.BACKEND_URL || '').replace(/\/$/, '');
const ETL_USER   = process.env.FUSION_ETL_USER;
const ETL_PASS   = process.env.FUSION_ETL_PASSWORD;

// ── Fusion REST ───────────────────────────────────────────────────────────────

async function getFusionToken() {
    const { data } = await axios.post(
        `${BACKEND}/auth/login`,
        { email: ETL_USER, password: ETL_PASS },
        { timeout: 15000 }
    );
    return data.token;
}

async function getPendingPlates(token) {
    const { data } = await axios.get(`${BACKEND}/tracknme/pending`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000,
    });
    return data.map(v => v.plate).filter(Boolean);
}

async function saveToFusion(plate, policy, token) {
    const headers = { Authorization: `Bearer ${token}` };
    if (policy.insuredName) {
        await axios.put(
            `${BACKEND}/vehicles/${encodeURIComponent(plate)}`,
            { insuredName: policy.insuredName },
            { headers, timeout: 15000 }
        );
    }
    if (policy.policyNumber || policy.startDate || policy.endDate) {
        await axios.post(`${BACKEND}/policies`, {
            plate,
            policyNumber : policy.policyNumber  || null,
            startDate    : policy.startDate      || null,
            endDate      : policy.endDate        || null,
            insuredName  : policy.insuredName    || null,
            cpfCnpj      : policy.cpfCnpj        || null,
            status       : 'ACTIVE',
            source       : 'ETL',
        }, { headers, timeout: 15000 });
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// "DD/MM/YYYY" → "YYYY-MM-DD"
function parseBrDate(str) {
    if (!str) return null;
    const m = str.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

// DD/MM/YYYY → Date (para comparação)
function parseBrDateObj(str) {
    if (!str) return new Date(0);
    const [dd, mm, yyyy] = str.split('/');
    return new Date(+yyyy, +mm - 1, +dd);
}

// ── Playwright ────────────────────────────────────────────────────────────────
//
// Arquitetura do i4pro (ASP.NET WebForms):
//   - Login e menu: página principal (Default.aspx)
//   - Formulário de apólices: iframe #ifrmPai — acessado via page.frameLocator()

async function doLogin(page) {
    log('[i4pro] Fazendo login...');
    await page.goto(`${I4PRO_URL}/Default.aspx?`, {
        waitUntil: 'domcontentloaded',
        timeout  : 30000,
    });
    // O i4pro pode passar por uma tela de inicializacao (Atualizando.aspx)
    // antes do form de login existir — esperar a URL nao serve (ela nao
    // muda), entao espera o campo de usuario aparecer de verdade. 120s
    // porque a primeira carga (Atualizando.aspx "aquecendo") pode
    // demorar bem mais que os 60s usados antes.
    log('[i4pro] Aguardando tela de login (pode demorar até 2min na primeira vez)...');
    await page.waitForSelector('#cd_usuario', { timeout: 120000 });
    await page.fill('#cd_usuario', I4PRO_USER);
    await page.fill('#nm_senha', I4PRO_PASS);
    await page.click('#botaoEntrar');
    // A URL continua Default.aspx? depois do clique — nao muda. O sinal
    // real de login concluido e' o campo oculto eng_sessao_aberta virar
    // '3' (sessao aberta no servidor).
    await page.waitForSelector('a:has-text("Emissão"), .navbar, #menu-principal', { timeout: 30000 });
    log('[i4pro] Login concluído');
}

const APOLICES_URL = 'Default.aspx?eng_idtela=59&eng_idmenu=701&eng_idmodulo=1&eng_detalhe=s';

// Screenshot de diagnóstico quando a navegação falha — salva junto do
// etl.log (mesma pasta base, subpasta screenshots/) para inspecionar
// visualmente em qual tela o fluxo travou.
async function saveErrorScreenshot(page, label) {
    try {
        const fs = require('fs');
        fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filePath = path.join(SCREENSHOT_DIR, `${timestamp}_${label}.png`);
        await page.screenshot({ path: filePath, fullPage: true });
    } catch (_) {}
}

// Pesquisa uma placa e retorna dados da apólice mais recente
async function processPlate(page, plate) {
    try {
        await page.goto(`${I4PRO_URL}/${APOLICES_URL}`, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForSelector('#id_ramo', { timeout: 30000 });

        await page.selectOption('#id_ramo', '16');
        await page.fill('#nm_placa', plate);
        await page.click('#TRBTNC_a999996');
        await page.waitForSelector('table tbody tr', { timeout: 10000 }).catch(() => null);

        const rawRows = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('table tbody tr')).map((row, idx) => {
                const cells = Array.from(row.querySelectorAll('td'));
                const link  = row.querySelector('[id^="TDLINK_"]');
                return { index: idx, cells: cells.map(c => c.innerText?.trim()), linkId: link?.id };
            });
        });

        const rows = rawRows
            .filter(r => r.index > 0 && r.cells.length >= 10)
            .map(r => ({
                numero    : r.cells[0]  || '',
                cliente   : r.cells[1]  || '',
                apolice   : r.cells[6]  || '',
                inicioVig : r.cells[9]  || '',
                fimVig    : r.cells[10] || '',
                linkId    : r.linkId    || null,
            }));

        if (!rows.length) {
            log(`[i4pro] Não encontrada: ${plate}`);
            return null;
        }

        // Apólice com Fim Vigência mais recente
        const latest = [...rows].sort(
            (a, b) => parseBrDateObj(b.fimVig) - parseBrDateObj(a.fimVig)
        )[0];

        if (!latest.linkId) {
            return {
                policyNumber : latest.apolice || null,
                insuredName  : latest.cliente || null,
                cpfCnpj      : null,
                startDate    : parseBrDate(latest.inicioVig),
                endDate      : parseBrDate(latest.fimVig),
            };
        }

        await page.click(`#${latest.linkId}`);
        await page.waitForSelector('#nm_pessoa_segurado, [name="nm_pessoa"], #nr_cnpj_cpf, [name="nr_cnpj_cpf"]', { timeout: 8000 }).catch(() => null);

        await page.evaluate(() => {
            const tabs = Array.from(document.querySelectorAll('[role="tab"], .nav-tab, a.tab, a'));
            const tab  = tabs.find(t => t.innerText?.trim().toLowerCase() === 'cliente');
            tab?.click();
        });
        await page.waitForSelector('#nm_pessoa_segurado, [name="nm_pessoa"]', { timeout: 5000 }).catch(() => null);

        const clienteData = await page.evaluate(() => ({
            nome    : document.querySelector('#nm_pessoa_segurado, [name="nm_pessoa"]')?.value?.trim() || '',
            cpfCnpj : document.querySelector('#nr_cnpj_cpf, [name="nr_cnpj_cpf"]')?.value?.replace(/\D/g, '') || '',
        }));

        return {
            policyNumber : latest.apolice                             || null,
            insuredName  : clienteData.nome    || latest.cliente       || null,
            cpfCnpj      : clienteData.cpfCnpj                         || null,
            startDate    : parseBrDate(latest.inicioVig),
            endDate      : parseBrDate(latest.fimVig),
        };
    } catch (err) {
        log(`[i4pro] Erro ao processar ${plate}: ${err.message}`);
        await saveErrorScreenshot(page, 'apolices-erro');
        return null;
    }
}

// ── Função principal exportada ────────────────────────────────────────────────

async function run(plate = null) {
    if (!I4PRO_URL || !I4PRO_USER || !I4PRO_PASS) {
        throw new Error('I4PRO_URL, I4PRO_USER e I4PRO_PASSWORD são obrigatórios');
    }
    if (!BACKEND || !ETL_USER || !ETL_PASS) {
        throw new Error('BACKEND_URL, FUSION_ETL_USER e FUSION_ETL_PASSWORD são obrigatórios');
    }

    const token = await getFusionToken();
    const plates = plate
        ? [plate.trim().toUpperCase()]
        : await getPendingPlates(token);

    log(`[i4pro] ${plates.length} placa(s) para processar (${plate ? 'single' : 'bulk'})`);

    if (plates.length === 0) {
        log('[i4pro] Nenhuma placa pendente — encerrando');
        return { populated: 0, notFound: 0 };
    }

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page    = await context.newPage();

    let populated = 0;
    let notFound  = 0;

    try {
        await doLogin(page);

        for (const p of plates) {
            log(`[i4pro] Processando: ${p}`);
            try {
                const policy = await processPlate(page, p);
                if (!policy || (!policy.insuredName && !policy.policyNumber)) {
                    log(`[i4pro] Sem dados para: ${p}`);
                    notFound++;
                } else {
                    await saveToFusion(p, policy, token);
                    log(`[i4pro] Salvo: ${p} — ${policy.insuredName || '(nome não extraído)'}`);
                    populated++;
                }
            } catch (err) {
                log(`[i4pro] Falha na placa ${p}: ${err.message}`);
                notFound++;
            }
        }
    } finally {
        await browser.close();
    }

    log(`[i4pro] Concluído — ${populated} populadas, ${notFound} não encontradas`);
    return { populated, notFound };
}

module.exports = { run };

// ── CLI: node index-i4pro.js [PLACA] ─────────────────────────────────────────
if (require.main === module) {
    const plateArg  = process.argv[2]?.trim().toUpperCase() || null;
    const startedAt = Date.now();

    reportHeartbeat({ type: 'I4PRO', status: 'RUNNING' }).catch(() => {});

    run(plateArg)
        .then(({ populated, notFound }) => {
            log(`[i4pro] Resultado final: ${populated} populadas, ${notFound} não encontradas`);
            return reportHeartbeat({
                type            : 'I4PRO',
                status          : 'SUCCESS',
                durationMs      : Date.now() - startedAt,
                recordsProcessed: populated,
            });
        })
        .then(() => process.exit(0))
        .catch(err => {
            log(`[i4pro] Erro fatal: ${err.message}`);
            reportHeartbeat({
                type      : 'I4PRO',
                status    : 'ERROR',
                durationMs: Date.now() - startedAt,
                error     : err.message,
            }).catch(() => {});
            process.exit(1);
        });
}
