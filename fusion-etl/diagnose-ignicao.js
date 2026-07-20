require('dotenv').config();

const path = require('path');
const fs   = require('fs');

const { launchBrowser, loginMultiportal, waitForFrame } = require('./multiportal-auth');

// ── Parâmetros ────────────────────────────────────────────────────────────────
const RELATORIOS_MENU_ID  = 175;          // mesmo que KM/Excesso — pode mudar
const IGNICAO_SEAM_URL    = '/system/reports/acumuladosReportIgnicao.seam';
const DATALIST_ID         = 'AcumuladosIgnicaoDataList';
const PLATE               = 'SHS1I13';
const DATA_INICIO         = '01/07/2026 00:00';
const DATA_FIM            = '15/07/2026 23:59';

// ── Helper: lista elementos clicáveis em um frame ─────────────────────────────
function listClickable(frame) {
    return frame.evaluate(() =>
        [...document.querySelectorAll('a, button, input[type="button"], input[type="submit"]')]
            .map(el => ({
                tag: el.tagName,
                id:   el.id   || '(sem id)',
                name: el.name || '(sem name)',
                text: el.textContent.trim().slice(0, 80),
                visible: el.offsetParent !== null,
            }))
            .filter(b => b.text || b.id !== '(sem id)')
    );
}

// ── Helper: lista todos os campos de formulário em um frame ──────────────────
function listInputs(frame) {
    return frame.evaluate(() =>
        [...document.querySelectorAll('input, select, textarea')]
            .map(el => ({
                tag:  el.tagName,
                id:   el.id   || '(sem id)',
                name: el.name || '(sem name)',
                type: el.type || '(n/a)',
                value: el.value ? el.value.slice(0, 40) : '',
                visible: el.offsetParent !== null,
            }))
    );
}

(async () => {

    const browser = await launchBrowser();
    const context = await browser.newContext({ acceptDownloads: true });
    const page    = await context.newPage();

    // ── Interceptores ─────────────────────────────────────────────────────────
    page.on('request', req => {
        const url = req.url();
        if (
            url.includes('.seam')
            || url.includes('download')
            || url.includes('xls')
            || url.includes('export')
            || url.includes('relat')
            || url.includes('ignicao')
            || url.includes('acumulado')
        ) {
            console.log('[REQUEST]', req.method(), url);
        }
    });

    page.on('response', async res => {
        const ct   = res.headers()['content-type'] || '';
        const url  = res.url();
        const disp = res.headers()['content-disposition'] || '';
        if (url.includes('ignicao') || url.includes('acumulado') || url.includes('Ignicao') || url.includes('Acumulado')) {
            console.log('[RESPONSE]', res.status(), url);
            console.log('  content-type:', ct);
            console.log('  content-disposition:', disp || '(none)');
        }
        if (
            ct.includes('excel')
            || ct.includes('spreadsheet')
            || ct.includes('octet-stream')
            || disp.includes('attachment')
        ) {
            console.log('[RESPONSE DOWNLOAD]', res.status(), url);
            console.log('  content-type:', ct);
            console.log('  content-disposition:', disp || '(none)');
        }
    });

    page.on('download', download => {
        console.log('[DOWNLOAD EVENT]', download.url());
        console.log('  suggestedFilename:', download.suggestedFilename());
    });

    page.on('popup', popup => {
        console.log('[POPUP]', popup.url());
    });

    // ── 1. Login ──────────────────────────────────────────────────────────────
    console.log('\n[STEP 1] Fazendo login...');
    await loginMultiportal(page);
    console.log('[STEP 1] Login OK.');

    // ── 2. Menu ───────────────────────────────────────────────────────────────
    await waitForFrame(page, '/system/layout/menu.seam');
    const menuFrame = page.frame({ name: 'mymenu' });

    console.log('\n[STEP 2] Aguardando 3s para JS do menu inicializar...');
    await page.waitForTimeout(3000);

    console.log(`[STEP 2] Chamando openMenu(${RELATORIOS_MENU_ID})...`);
    await menuFrame.evaluate((id) => openMenu(id), RELATORIOS_MENU_ID);
    await page.waitForTimeout(2000);

    // Verificar se o item de Ignição já está visível no menu
    const menuItemExists = await menuFrame.evaluate((seam) => {
        const tr = document.querySelector(`tr[id="${seam}"]`);
        return tr ? { found: true, text: tr.textContent.trim().slice(0, 80) } : { found: false };
    }, IGNICAO_SEAM_URL);

    console.log(`[STEP 2] Item "${IGNICAO_SEAM_URL}" no menu:`, menuItemExists);

    if (!menuItemExists.found) {
        // Inspecionar todos os items do menu para descobrir sub-menus de Relatórios
        console.log('\n[STEP 2b] Item não encontrado. Listando todos os itens do menu...');
        const allMenuItems = await menuFrame.evaluate(() => {
            return [...document.querySelectorAll('tr[id]')]
                .map(tr => ({
                    id:   tr.id,
                    text: tr.textContent.trim().slice(0, 80),
                    visible: tr.offsetParent !== null,
                }))
                .filter(item => item.id.includes('/system') || item.id.match(/^\d+$/));
        });
        console.log(`[STEP 2b] Total de itens com id: ${allMenuItems.length}`);
        allMenuItems.forEach(item =>
            console.log(`  visible=${item.visible} | id="${item.id}" | text="${item.text}"`)
        );

        // Tentar encontrar um subMenu "Gerenciais" ou similar
        const gerentaisMenus = await menuFrame.evaluate(() => {
            return [...document.querySelectorAll('[onclick*="openMenu"], [onclick*="openSubMenu"]')]
                .map(el => ({
                    tag:     el.tagName,
                    id:      el.id,
                    onclick: el.getAttribute('onclick'),
                    text:    el.textContent.trim().slice(0, 80),
                }));
        });
        console.log('\n[STEP 2b] Elementos com openMenu/openSubMenu no onclick:');
        gerentaisMenus.forEach(e => console.log(`  ${e.tag} id="${e.id}" text="${e.text}" onclick="${e.onclick}"`));

        // Tentar IDs de subMenu alternativos para Relatórios Gerenciais
        const candidateIds = [176, 177, 178, 179, 180, 185, 190, 200, 210, 220];
        for (const cid of candidateIds) {
            const found = await menuFrame.evaluate((id, seam) => {
                try { openMenu(id); } catch(e) {}
                const tr = document.querySelector(`tr[id="${seam}"]`);
                return tr ? { found: true, text: tr.textContent.trim().slice(0, 60) } : { found: false };
            }, cid, IGNICAO_SEAM_URL);
            if (found.found) {
                console.log(`\n[STEP 2b] *** Item encontrado com openMenu(${cid})! text="${found.text}"`);
                break;
            }
        }
        await page.waitForTimeout(1000);
    }

    // ── 3. Navegar para acumuladosReportIgnicao.seam ──────────────────────────
    console.log('\n[STEP 3] Navegando para Ignição via doSubmit...');
    await menuFrame.evaluate((seam) => {
        const tr = document.querySelector(`tr[id="${seam}"]`);
        if (tr) {
            doSubmit(tr, seam);
        } else {
            console.warn('[DIAGNOSE] Item de menu não encontrado — tentando navegar diretamente');
            // Fallback: submeter direto pelo nome da URL
            doSubmit({ id: seam }, seam);
        }
    }, IGNICAO_SEAM_URL);

    // ── 4. Aguardar frame body ────────────────────────────────────────────────
    console.log('\n[STEP 4] Aguardando frame body carregar acumuladosReportIgnicao...');
    let bodyFrame;
    try {
        bodyFrame = await waitForFrame(page, IGNICAO_SEAM_URL, 20000);
        console.log('[STEP 4] Frame body URL:', bodyFrame.url());
    } catch (e) {
        console.error('[STEP 4] Timeout aguardando frame — tentando pelo nome "mybody":', e.message);
        bodyFrame = page.frame({ name: 'mybody' });
        if (!bodyFrame) {
            console.error('[STEP 4] Frame "mybody" também não encontrado. Frames disponíveis:');
            page.frames().forEach(f => console.log('  ', f.name() || '(sem nome)', '|', f.url()));
            await page.waitForTimeout(30000);
            await browser.close();
            return;
        }
        console.log('[STEP 4] Usando frame mybody URL:', bodyFrame.url());
    }

    // ── 5. Listar campos e botões antes de preencher ──────────────────────────
    console.log('\n[STEP 5a] Aguardando 5s para JS da página inicializar...');
    await page.waitForTimeout(5000);

    console.log('[STEP 5b] Todos os campos do formulário:');
    const inputs = await listInputs(bodyFrame);
    inputs.forEach(f =>
        console.log(`  ${f.tag} type="${f.type}" id="${f.id}" name="${f.name}" value="${f.value}" visible=${f.visible}`)
    );

    console.log('\n[STEP 5c] Elementos clicáveis:');
    const clickables = await listClickable(bodyFrame);
    clickables.forEach(b =>
        console.log(`  ${b.tag} id="${b.id}" name="${b.name}" visible=${b.visible} | "${b.text}"`)
    );

    // ── 6. Preencher formulário ───────────────────────────────────────────────
    console.log('\n[STEP 6] Preenchendo formulário...');

    // Campo placa — vários candidatos possíveis
    const placaCandidates = [
        `[name="${DATALIST_ID}:paramPesquisa:placaSearch"]`,
        `[name="${DATALIST_ID}:paramPesquisa:placa"]`,
        `[name="${DATALIST_ID}:paramPesquisa:veiculo"]`,
        '[name="placaSearch"]',
        '[name="placa"]',
        '[id*="placa"]',
        '[id*="Placa"]',
        '[id*="veiculo"]',
        '[id*="Veiculo"]',
    ];
    let placaFilled = false;
    for (const sel of placaCandidates) {
        const count = await bodyFrame.locator(sel).count();
        if (count > 0) {
            console.log(`[STEP 6] Campo placa encontrado: ${sel}`);
            await bodyFrame.locator(sel).first().fill(PLATE);
            placaFilled = true;
            break;
        }
    }
    if (!placaFilled) console.warn('[STEP 6] *** Campo placa NÃO encontrado em nenhum candidato!');

    // Campo data início
    const inicioCandidates = [
        `[name="${DATALIST_ID}:paramPesquisa:dataInicio"]`,
        `[name="${DATALIST_ID}:paramPesquisa:datainicial"]`,
        `[name="${DATALIST_ID}:paramPesquisa:dataIni"]`,
        '[name*="dataInicio"]',
        '[name*="datainicial"]',
        '[id*="dataInicio"]',
        '[id*="dataIni"]',
    ];
    for (const sel of inicioCandidates) {
        const count = await bodyFrame.locator(sel).count();
        if (count > 0) {
            console.log(`[STEP 6] Campo dataInício encontrado: ${sel}`);
            await bodyFrame.locator(sel).first().fill(DATA_INICIO);
            break;
        }
    }

    // Campo data fim
    const fimCandidates = [
        `[name="${DATALIST_ID}:paramPesquisa:dataFim"]`,
        `[name="${DATALIST_ID}:paramPesquisa:datafinal"]`,
        `[name="${DATALIST_ID}:paramPesquisa:dataFim"]`,
        '[name*="dataFim"]',
        '[name*="datafinal"]',
        '[id*="dataFim"]',
        '[id*="dataFinal"]',
    ];
    for (const sel of fimCandidates) {
        const count = await bodyFrame.locator(sel).count();
        if (count > 0) {
            console.log(`[STEP 6] Campo dataFim encontrado: ${sel}`);
            await bodyFrame.locator(sel).first().fill(DATA_FIM);
            break;
        }
    }

    // ── 7. Pesquisar ──────────────────────────────────────────────────────────
    console.log('\n[STEP 7] Clicando em Pesquisar...');
    const btnUsado = await bodyFrame.evaluate((dl) => {
        const candidatos = [
            document.querySelector(`[id="${dl}:buttonFindHidden"]`),
            document.querySelector(`[id="${dl}:btnUpdateCallByJS"]`),
            document.querySelector(`[id="${dl}:paramPesquisa:btnPesquisa"]`),
            ...[...document.querySelectorAll('a, button, input')]
                .filter(el => el.textContent.trim().toLowerCase().includes('pesquisar')),
        ].filter(Boolean);

        if (candidatos.length === 0) return 'NENHUM';
        const el = candidatos[0];
        el.click();
        return `${el.tagName} id="${el.id}" text="${el.textContent.trim().slice(0, 40)}"`;
    }, DATALIST_ID);
    console.log('[STEP 7] Botão Pesquisar usado:', btnUsado);

    // ── 8. Aguardar grid ──────────────────────────────────────────────────────
    console.log('\n[STEP 8] Aguardando 8s para grid carregar...');
    await page.waitForTimeout(8000);

    const gridInfo = await bodyFrame.evaluate(() => {
        const tbodies = [...document.querySelectorAll('tbody')];
        const rows = tbodies.flatMap(t => [...t.querySelectorAll('tr')]);
        const firstRow = rows[0] ? rows[0].textContent.trim().slice(0, 120) : '(sem linhas)';
        return { totalRows: rows.length, firstRow };
    });
    console.log(`[STEP 8] Grid: ${gridInfo.totalRows} linhas | Primeira: "${gridInfo.firstRow}"`);

    console.log('\n[STEP 8b] Elementos clicáveis APÓS pesquisar:');
    const aposP = await listClickable(bodyFrame);
    aposP.forEach(b =>
        console.log(`  ${b.tag} id="${b.id}" name="${b.name}" visible=${b.visible} | "${b.text}"`)
    );

    // ── 9. Inspecionar variáveis de export na página ──────────────────────────
    console.log('\n[STEP 9] Inspecionando variáveis de export na página...');
    const exportFns = await bodyFrame.evaluate((dl) => {
        const info = {};
        try { info.printEXCEL  = typeof printEXCEL  !== 'undefined' ? printEXCEL.toString().slice(0, 400) : 'undefined'; } catch(e) { info.printEXCEL = 'error: ' + e.message; }
        try { info.printType   = typeof printType   !== 'undefined' ? String(printType)  : 'undefined'; } catch(e) { info.printType = 'error'; }
        try { info.url         = typeof url         !== 'undefined' ? String(url)        : 'undefined'; } catch(e) { info.url = 'error'; }
        try { info.thisurl     = typeof thisurl     !== 'undefined' ? String(thisurl)    : 'undefined'; } catch(e) { info.thisurl = 'error'; }
        try { info.printValOk  = document.getElementById(`${dl}:printValidateOk`)?.value; } catch(e) { info.printValOk = 'error'; }
        return info;
    }, DATALIST_ID);

    console.log('[STEP 9] printType:', exportFns.printType);
    console.log('[STEP 9] url:', exportFns.url);
    console.log('[STEP 9] thisurl:', exportFns.thisurl);
    console.log('[STEP 9] printValidateOk:', exportFns.printValOk);
    console.log('[STEP 9] printEXCEL fn:', exportFns.printEXCEL);

    // Procurar outros elementos com onclick contendo printEXCEL ou export
    const exportOnclicks = await bodyFrame.evaluate(() =>
        [...document.querySelectorAll('[onclick]')]
            .map(el => ({
                tag:     el.tagName,
                id:      el.id,
                onclick: el.getAttribute('onclick').slice(0, 120),
                text:    el.textContent.trim().slice(0, 50),
            }))
            .filter(e =>
                e.onclick.toLowerCase().includes('print')
                || e.onclick.toLowerCase().includes('excel')
                || e.onclick.toLowerCase().includes('export')
            )
    );
    console.log('\n[STEP 9b] Elementos com onclick print/excel/export:');
    exportOnclicks.forEach(e =>
        console.log(`  ${e.tag} id="${e.id}" | onclick="${e.onclick}" | text="${e.text}"`)
    );

    // ── 10. Capturar download via printEXCEL + popup ─────────────────────────
    console.log('\n[STEP 10] Chamando printEXCEL via popup (padrão Excesso de Velocidade)...');

    try {
        const [dl] = await Promise.all([
            page.waitForEvent('download', { timeout: 30000 }),
            bodyFrame.evaluate((dl) => {
                if (typeof printEXCEL === 'function') {
                    printEXCEL(dl, 'list.report.excel');
                } else {
                    console.log('[DIAGNOSE] printEXCEL não definida no contexto da página');
                }
            }, DATALIST_ID),
        ]);

        if (dl) {
            const savePath = path.join(__dirname, 'ignicao_diagnose_FINAL.xls');
            await dl.saveAs(savePath);
            console.log(`\n[STEP 10] *** DOWNLOAD CAPTURADO: ${dl.suggestedFilename()} → ${savePath} ***`);
        } else {
            console.log('[STEP 10] Nenhum download capturado.');
        }
    } catch (e) {
        console.log('[STEP 10] printEXCEL + download falhou:', e.message);

        // Fallback: tentar via popup event
        console.log('[STEP 10b] Tentando via page.waitForEvent("popup")...');
        try {
            const [popup] = await Promise.all([
                page.waitForEvent('popup', { timeout: 15000 }),
                bodyFrame.evaluate((dl) => {
                    if (typeof printEXCEL === 'function') printEXCEL(dl, 'list.report.excel');
                }, DATALIST_ID),
            ]);
            if (popup) {
                console.log('[STEP 10b] Popup capturado URL:', popup.url());
                await popup.waitForLoadState();
                // Tentar download no popup
                const [dlPopup] = await Promise.all([
                    popup.waitForEvent('download', { timeout: 15000 }).catch(() => null),
                ]);
                if (dlPopup) {
                    const savePath = path.join(__dirname, 'ignicao_diagnose_popup.xls');
                    await dlPopup.saveAs(savePath);
                    console.log(`[STEP 10b] Download via popup: ${dlPopup.suggestedFilename()} → ${savePath}`);
                } else {
                    console.log('[STEP 10b] Nenhum download no popup — URL popup:', popup.url());
                }
            }
        } catch (e2) {
            console.log('[STEP 10b] Popup também falhou:', e2.message);
        }
    }

    // ── 11. Inspeção final ────────────────────────────────────────────────────
    console.log('\n[STEP 11] Estado final dos frames:');
    page.frames().forEach(f => console.log(`  name="${f.name() || '(sem nome)'}" | url="${f.url()}"`));

    console.log('\n[INFO] Aguardando 30s — inspecione o browser manualmente se necessário.');
    await page.waitForTimeout(30000);

    await browser.close();
    console.log('[INFO] Concluído.');

})().catch(err => {
    console.error('[ERRO FATAL]', err.message);
    process.exit(1);
});
