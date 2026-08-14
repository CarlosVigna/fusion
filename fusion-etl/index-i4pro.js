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
    log('[i4pro] Tela de login pronta');
    await page.fill('#cd_usuario', I4PRO_USER);
    await page.fill('#nm_senha', I4PRO_PASS);
    await page.click('#botaoEntrar');
    // A URL continua Default.aspx? depois do clique — nao muda. O sinal
    // real de login concluido e' o campo oculto eng_sessao_aberta virar
    // '3' (sessao aberta no servidor).
    await page.waitForSelector('a:has-text("Emissão"), .navbar, #menu-principal', { timeout: 30000 });
    log('[i4pro] Login concluído');
}

async function navigateToApolices(page) {
    try {
        log('[i4pro] Navegando para Emissão > Apólices...');
        // Clique no menu da página principal (fora dos frames)
        await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a, li'));
            const el = links.find(l => l.innerText?.trim() === 'Emissão');
            el?.click();
        });
        await page.waitForTimeout(500);
        await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'));
            const el = links.find(l => l.innerText?.trim() === 'Apólices');
            el?.click();
        });
        await page.waitForTimeout(2000);
        log('[i4pro] Página de apólices carregada');
        return page.url();
    } catch (e) {
        log('[i4pro] ERRO ao navegar para Apólices: ' + e.message);
        await saveErrorScreenshot(page, 'navigate-apolices');
        throw e;
    }
}

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
        log(`[i4pro] Screenshot de diagnóstico salvo: ${filePath}`);
    } catch (screenshotErr) {
        log('[i4pro] Falha ao salvar screenshot de diagnóstico: ' + screenshotErr.message);
    }
}

// Pesquisa uma placa e retorna dados da apólice mais recente
async function processPlate(page, plate, searchUrl) {
    try {
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

        const ifrmPaiFrame = page.frame({ name: 'ifrmPai' });
        if (!ifrmPaiFrame) throw new Error('Frame ifrmPai não encontrado');

        await ifrmPaiFrame.waitForLoadState('domcontentloaded');
        await ifrmPaiFrame.waitForSelector('#id_ramo', { timeout: 30000 });
        log('[i4pro] Formulário pronto no ifrmPai!');

        await ifrmPaiFrame.selectOption('#id_ramo', '16');
        await ifrmPaiFrame.fill('#nm_placa', plate);
        await ifrmPaiFrame.click('#TRBTNC_a999996');
        await page.waitForTimeout(3000);

        // Ler dados da tabela no contexto do frame
        const rows = await ifrmPaiFrame.evaluate(() => {
            const trs = document.querySelectorAll('table tbody tr');
            const data = [];
            trs.forEach((row, idx) => {
                if (idx === 0) return;
                const cells = Array.from(row.querySelectorAll('td'));
                if (cells.length < 10) return;
                const linkEl = row.querySelector('[id^="TDLINK_"]');
                data.push({
                    numero    : cells[0]?.innerText?.trim()  || '',
                    cliente   : cells[1]?.innerText?.trim()  || '',
                    apolice   : cells[6]?.innerText?.trim()  || '',
                    inicioVig : cells[9]?.innerText?.trim()  || '',
                    fimVig    : cells[10]?.innerText?.trim() || '',
                    linkId    : linkEl?.id || null,
                });
            });
            return data;
        });

        log(`[i4pro] Resultado: ${rows.length} linhas`);

        if (!rows.length) {
            log(`[i4pro] Não encontrada: ${plate}`);
            return null;
        }

        // Apólice com Fim Vigência mais recente
        const latest = [...rows].sort(
            (a, b) => parseBrDateObj(b.fimVig) - parseBrDateObj(a.fimVig)
        )[0];

        if (!latest.linkId) {
            log(`[i4pro] Sem link de detalhe para: ${plate} — usando dados da tabela`);
            return {
                policyNumber : latest.apolice || null,
                insuredName  : latest.cliente || null,
                cpfCnpj      : null,
                startDate    : parseBrDate(latest.inicioVig),
                endDate      : parseBrDate(latest.fimVig),
            };
        }

        await ifrmPaiFrame.click(`#${latest.linkId}`);
        await page.waitForTimeout(2000);

        await ifrmPaiFrame.evaluate(() => {
            const tabs = Array.from(document.querySelectorAll('[role="tab"], .nav-tab, a.tab, a'));
            const tab  = tabs.find(t => t.innerText?.trim().toLowerCase() === 'cliente');
            tab?.click();
        });
        await page.waitForTimeout(1000);

        const clienteData = await ifrmPaiFrame.evaluate(() => ({
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
        const searchUrl = await navigateToApolices(page);

        for (const p of plates) {
            log(`[i4pro] Processando: ${p}`);
            try {
                const policy = await processPlate(page, p, searchUrl);
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
