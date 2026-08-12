require('dotenv').config();
const { chromium } = require('playwright');
const axios = require('axios');
const { log } = require('./src/file-utils');
const { reportHeartbeat } = require('./src/etlStatusReporter');

// ── Variáveis de ambiente ────────────────────────────────────────────────────
// I4PRO_URL           — URL do login do i4pro (ex: https://i4pro.usebens.com.br/Default.aspx?)
// I4PRO_USER          — usuário de login do i4pro
// I4PRO_PASSWORD      — senha do i4pro
// BACKEND_URL         — URL do backend Fusion
// FUSION_ETL_USER     — e-mail do usuário Fusion com perfil ADMIN
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

// ── Helpers de data ───────────────────────────────────────────────────────────

// "DD/MM/YYYY" → "YYYY-MM-DD"
function parseBrDate(str) {
    if (!str) return null;
    const m = str.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

// Retorna o índice da linha com a data mais recente na coluna [col]
function mostRecentRowIndex(rowTexts, col) {
    let bestIdx = 0;
    let bestDate = '';
    rowTexts.forEach((row, i) => {
        const iso = parseBrDate(row[col]);
        if (iso && iso > bestDate) { bestDate = iso; bestIdx = i; }
    });
    return bestIdx;
}

// ── Playwright ─────────────────────────────────────────────────────────────────
//
// Arquitetura do i4pro (ASP.NET WebForms):
//   - O formulário de apólices está na PÁGINA PRINCIPAL (Default.aspx).
//   - O iframe presente na página (Blank.aspx) está vazio — não contém o form.
//   - Todos os locators usam `page` diretamente, sem frameLocator.

async function doLogin(page) {
    log('[i4pro] Abrindo login...');
    await page.goto(I4PRO_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.fill('input[name*="usuario" i], #txtUsuario, input[type="text"]', I4PRO_USER);
    await page.fill('input[name*="senha" i], #txtSenha, input[type="password"]', I4PRO_PASS);
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
        page.click('input[type="submit"], button[type="submit"]'),
    ]);
    log('[i4pro] Login concluído');
}

async function navigateToApolices(page) {
    log('[i4pro] Navegando para Emissão > Apólices...');
    await page.click('text=Emissão');
    await page.click('text=Apólices');
    await page.waitForTimeout(2000);
    return page.url();
}

// Extrai texto de todas as linhas do tbody da tabela de resultados
async function getRowTexts(page) {
    try {
        await page.locator('table tbody tr').first().waitFor({ timeout: 8000 });
    } catch {
        return [];
    }
    const rows = await page.locator('table tbody tr').all();
    const result = [];
    for (const row of rows) {
        const cells = row.locator('td');
        const count = await cells.count();
        const texts = [];
        for (let c = 0; c < count; c++) {
            texts.push((await cells.nth(c).innerText()).trim());
        }
        result.push(texts);
    }
    return result;
}

// Retorna o índice da coluna "Fim Vigência" no cabeçalho da tabela
async function findEndDateColumn(page) {
    const headers = page.locator('table thead th, table thead td');
    const hCount = await headers.count();
    for (let i = 0; i < hCount; i++) {
        const text = (await headers.nth(i).innerText()).toLowerCase();
        if (/fim|vigência|venciment/.test(text)) return i;
    }
    return -1;
}

// Extrai nome, CPF, nº apólice e vigências das abas Cliente e Endossos
async function extractDetail(page) {
    const detail = {
        policyNumber : null,
        insuredName  : null,
        cpfCnpj      : null,
        startDate    : null,
        endDate      : null,
    };

    // Nº apólice — pode estar no cabeçalho da tela de detalhe
    const numEl = page.locator('input[name*="apolice" i], input[id*="apolice" i]').first();
    if (await numEl.count() > 0) {
        detail.policyNumber = (await numEl.inputValue().catch(() => '')).trim() || null;
    }

    // ── Aba "Cliente" — nome e CPF/CNPJ ──────────────────────────────────────
    const clienteTab = page.locator('[role="tab"], a, li').filter({ hasText: /^cliente$/i }).first();
    if (await clienteTab.count() > 0) {
        await clienteTab.click();
        await page.locator('input[name*="nome" i]').first().waitFor({ timeout: 5000 }).catch(() => {});

        const nomeEl = page.locator(
            'input[name*="nome" i]:not([name*="social" i]), ' +
            'input[id*="nome" i]:not([id*="social" i])'
        ).first();
        if (await nomeEl.count() > 0) {
            detail.insuredName = (await nomeEl.inputValue()).trim() || null;
        }

        const cpfEl = page.locator(
            'input[name*="cpf" i], input[id*="cpf" i], ' +
            'input[name*="cnpj" i], input[id*="cnpj" i]'
        ).first();
        if (await cpfEl.count() > 0) {
            const raw = (await cpfEl.inputValue()).replace(/\D/g, '');
            detail.cpfCnpj = raw || null;
        }
    }

    // ── Aba "Endossos" — nº apólice/endosso e vigências ──────────────────────
    const endossosTab = page.locator('[role="tab"], a, li').filter({ hasText: /endosso/i }).first();
    if (await endossosTab.count() > 0) {
        await endossosTab.click();
        await page.waitForTimeout(700);

        const eRows = await getRowTexts(page);
        if (eRows.length > 0) {
            for (const cell of eRows[0]) {
                if (!detail.policyNumber && /^\d[\d\-\/]{3,}$/.test(cell)) {
                    detail.policyNumber = cell;
                }
                const dateMatch = cell.match(/\d{2}\/\d{2}\/\d{4}/);
                if (dateMatch) {
                    const iso = parseBrDate(dateMatch[0]);
                    if (!detail.startDate) detail.startDate = iso;
                    else if (!detail.endDate) detail.endDate = iso;
                }
            }
        }
    }

    return detail;
}

// Processa uma única placa — formulário na página principal (sem frameLocator)
async function processPlate(page, plate, searchUrl) {
    try {
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(2000);

        // ── Seleciona Ramo 31-AUTO ────────────────────────────────────────────
        await page.locator('select').filter({ hasText: 'AUTO' }).selectOption({ label: '31-AUTO' });

        // ── Preenche a placa ──────────────────────────────────────────────────
        await page.locator('tr:has-text("Placa do Veículo") input').fill(plate);

        // ── Clica Pesquisar ───────────────────────────────────────────────────
        await page.click('input[value="Pesquisar"], button:has-text("Pesquisar")');
        await page.waitForTimeout(2000);

        // ── Verifica resultados ───────────────────────────────────────────────
        const rowTexts = await getRowTexts(page);
        if (rowTexts.length === 0) {
            log(`[i4pro] Não encontrada: ${plate}`);
            return null;
        }

        // Escolhe a apólice com Fim Vigência mais recente
        const endDateCol = await findEndDateColumn(page);
        const bestIdx    = endDateCol >= 0 ? mostRecentRowIndex(rowTexts, endDateCol) : 0;

        // ── Abre o detalhe da apólice (clique na linha) ───────────────────────
        const allRows = await page.locator('table tbody tr').all();
        await allRows[bestIdx].click();
        await page.waitForTimeout(1500);

        return await extractDetail(page);
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

    reportHeartbeat({ type: 'I4PRO_TRACKNME', status: 'RUNNING' }).catch(() => {});

    run(plateArg)
        .then(({ populated, notFound }) => {
            log(`[i4pro] Resultado final: ${populated} populadas, ${notFound} não encontradas`);
            return reportHeartbeat({
                type            : 'I4PRO_TRACKNME',
                status          : 'SUCCESS',
                durationMs      : Date.now() - startedAt,
                recordsProcessed: populated,
            });
        })
        .then(() => process.exit(0))
        .catch(err => {
            log(`[i4pro] Erro fatal: ${err.message}`);
            reportHeartbeat({
                type      : 'I4PRO_TRACKNME',
                status    : 'ERROR',
                durationMs: Date.now() - startedAt,
                error     : err.message,
            }).catch(() => {});
            process.exit(1);
        });
}
