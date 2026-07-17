require('dotenv').config();

const { launchBrowser, loginMultiportal, waitForFrame } = require('./multiportal-auth');

const RELATORIOS_MENU_ID = 175;
const PLATE = 'FXZ9249';
const DATA_INICIO = '01/07/2026 00:00';
const DATA_FIM = '07/07/2026 23:59'; // limite: 7 dias

function listClickable(frame) {
    return frame.evaluate(() =>
        [...document.querySelectorAll('a, button, input[type="button"], input[type="submit"]')]
            .map(el => ({
                tag: el.tagName,
                id: el.id || '(sem id)',
                name: el.name || '(sem name)',
                text: el.textContent.trim().slice(0, 80),
                visible: el.offsetParent !== null,
            }))
            .filter(b => b.text || b.id !== '(sem id)')
    );
}

(async () => {

    const browser = await launchBrowser();
    const context = await browser.newContext({ acceptDownloads: true });
    const page    = await context.newPage();

    page.on('request', req => {
        const url = req.url();
        if (
            url.includes('.seam')
            || url.includes('download')
            || url.includes('xls')
            || url.includes('export')
            || url.includes('relat')
        ) {
            console.log('[REQUEST]', req.method(), url);
        }
    });

    page.on('response', async res => {
        const ct   = res.headers()['content-type'] || '';
        const url  = res.url();
        const disp = res.headers()['content-disposition'] || '';
        // Loga TUDO que vem de excessoVelocidade (para diagnosticar export)
        if (url.includes('excessoVelocidade') || url.includes('Excesso')) {
            console.log('[RESPONSE]', res.status(), url);
            console.log('  content-type:', ct);
            console.log('  content-disposition:', disp || '(none)');
        }
        // Qualquer resposta com conteúdo binário
        if (
            ct.includes('excel')
            || ct.includes('spreadsheet')
            || ct.includes('octet-stream')
            || url.includes('xls')
            || url.includes('download')
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

    // ── Login ────────────────────────────────────────────────────────────
    console.log('[INFO] Fazendo login...');
    await loginMultiportal(page);
    console.log('[INFO] Login OK. Aguardando frameset...');

    // ── Menu ─────────────────────────────────────────────────────────────
    await waitForFrame(page, '/system/layout/menu.seam');
    const menuFrame = page.frame({ name: 'mymenu' });

    // Aguarda o JS do frame de menu inicializar antes de chamar openMenu
    await page.waitForTimeout(3000);
    console.log('[INFO] Abrindo menu Relatórios (175)...');
    await menuFrame.evaluate((id) => openMenu(id), RELATORIOS_MENU_ID);
    await page.waitForTimeout(2000);

    console.log('[INFO] Navegando para Excesso de Velocidade via doSubmit...');
    await menuFrame.evaluate(() => {
        doSubmit(
            document.querySelector('tr[id="/system/reports/excessoVelocidadeList.seam"]'),
            '/system/reports/excessoVelocidadeList.seam'
        );
    });

    // ── Aguardar frame body ───────────────────────────────────────────────
    console.log('[INFO] Aguardando frame body carregar excessoVelocidadeList...');
    const bodyFrame = await waitForFrame(page, '/system/reports/excessoVelocidadeList.seam', 20000);
    console.log('[INFO] Frame body URL:', bodyFrame.url());

    // ── 1. Listar botões antes de preencher ───────────────────────────────
    console.log('\n[STEP 1] Elementos clicáveis ANTES de preencher (imediato):');
    const antes = await listClickable(bodyFrame);
    antes.forEach(b => console.log(' ', b.tag, `id="${b.id}"`, `name="${b.name}"`, `visible=${b.visible}`, '|', b.text));

    // Diagnóstico anterior: JS da página leva ~5s para inicializar
    console.log('\n[INFO] Aguardando 5s para JS da página inicializar...');
    await page.waitForTimeout(5000);

    console.log('[STEP 1b] Elementos clicáveis APÓS 5s:');
    const antesB = await listClickable(bodyFrame);
    antesB.forEach(b => console.log(' ', b.tag, `id="${b.id}"`, `name="${b.name}"`, `visible=${b.visible}`, '|', b.text));

    // ── 2-3. Preencher formulário ─────────────────────────────────────────
    console.log('\n[STEP 2-3] Preenchendo formulário...');

    // Tenta os dois nomes possíveis de campo (pode ser "veiculo" ou "placa")
    const camposVeiculo = [
        '[name="ExcessoVelocidadeDataList:paramPesquisa:veiculo"]',
        '[name="ExcessoVelocidadeDataList:paramPesquisa:placa"]',
    ];
    for (const sel of camposVeiculo) {
        const count = await bodyFrame.locator(sel).count();
        if (count > 0) {
            console.log(`[INFO] Campo veículo encontrado: ${sel}`);
            await bodyFrame.locator(sel).fill(PLATE);
            break;
        }
    }

    const camposInicio = [
        '[name="ExcessoVelocidadeDataList:paramPesquisa:dataInicio"]',
        '[name="ExcessoVelocidadeDataList:paramPesquisa:datainicial"]',
    ];
    for (const sel of camposInicio) {
        const count = await bodyFrame.locator(sel).count();
        if (count > 0) {
            console.log(`[INFO] Campo dataInicio encontrado: ${sel}`);
            await bodyFrame.locator(sel).fill(DATA_INICIO);
            break;
        }
    }

    const camposFim = [
        '[name="ExcessoVelocidadeDataList:paramPesquisa:dataFim"]',
        '[name="ExcessoVelocidadeDataList:paramPesquisa:datafinal"]',
    ];
    for (const sel of camposFim) {
        const count = await bodyFrame.locator(sel).count();
        if (count > 0) {
            console.log(`[INFO] Campo dataFim encontrado: ${sel}`);
            await bodyFrame.locator(sel).fill(DATA_FIM);
            break;
        }
    }

    // ── 4. Listar botões após preencher ───────────────────────────────────
    console.log('\n[STEP 4] Elementos clicáveis APÓS preencher:');
    const apos = await listClickable(bodyFrame);
    apos.forEach(b => console.log(' ', b.tag, `id="${b.id}"`, `name="${b.name}"`, `visible=${b.visible}`, '|', b.text));

    // ── 5. Tentar Pesquisar ───────────────────────────────────────────────
    console.log('\n[STEP 5] Tentando clicar em Pesquisar...');
    const btnPesquisar = await bodyFrame.evaluate(() => {
        const candidatos = [
            // buttonFindHidden: INPUT JSF real confirmado pelo diagnóstico anterior
            document.querySelector('[id="ExcessoVelocidadeDataList:buttonFindHidden"]'),
            document.querySelector('[id="ExcessoVelocidadeDataList:btnUpdateCallByJS"]'),
            document.querySelector('[id="ExcessoVelocidadeDataList:paramPesquisa:btnPesquisa"]'),
            // fallback: qualquer input/button cujo texto contenha "pesquisar"
            ...[...document.querySelectorAll('a, button, input')]
                .filter(el => el.textContent.trim().toLowerCase().includes('pesquisar')),
        ].filter(Boolean);

        if (candidatos.length === 0) return null;

        const el = candidatos[0];
        console.log('Clicando em:', el.tagName, el.id, el.textContent.trim().slice(0, 40));
        el.click();
        return el.id || el.textContent.trim().slice(0, 40);
    });
    console.log('[INFO] Botão Pesquisar usado:', btnPesquisar ?? 'NENHUM ENCONTRADO');

    // ── 6. Aguardar 8s (mesmo padrão do KM Mensal) e inspecionar grid ────
    console.log('\n[STEP 6] Aguardando 8s para grid carregar...');
    await page.waitForTimeout(8000);

    // Contar linhas no grid para confirmar se Pesquisar retornou dados
    const gridInfo = await bodyFrame.evaluate(() => {
        // Tenta encontrar tabela de resultados (tbody com tr de dados)
        const tbodies = [...document.querySelectorAll('tbody')];
        const rows = tbodies.flatMap(t => [...t.querySelectorAll('tr')]);
        const firstRow = rows[0] ? rows[0].textContent.trim().slice(0, 120) : '(sem linhas)';
        return { totalRows: rows.length, firstRow };
    });
    console.log(`[STEP 6] Grid: ${gridInfo.totalRows} linhas encontradas`);
    console.log(`[STEP 6] Primeira linha: ${gridInfo.firstRow}`);

    console.log('[STEP 6] Elementos clicáveis APÓS pesquisar:');
    const aposP = await listClickable(bodyFrame);
    aposP.forEach(b => console.log(' ', b.tag, `id="${b.id}"`, `name="${b.name}"`, `visible=${b.visible}`, '|', b.text));

    // ── 6b. Inspecionar DOM: encontrar o toggle do dropdown de export ─────
    console.log('\n[STEP 6b] Procurando toggle do dropdown de exportar...');
    const dropdownInfo = await bodyFrame.evaluate(() => {
        // Elementos com onclick que mencionem export/excel/lote
        const withOnclick = [...document.querySelectorAll('[onclick]')]
            .map(el => ({
                tag: el.tagName, id: el.id, cls: el.className,
                onclick: el.getAttribute('onclick').slice(0, 100),
                text: el.textContent.trim().slice(0, 60),
            }))
            .filter(e =>
                e.onclick.toLowerCase().includes('export')
                || e.onclick.toLowerCase().includes('excel')
                || e.onclick.toLowerCase().includes('lote')
                || e.onclick.toLowerCase().includes('dropdown')
                || e.onclick.toLowerCase().includes('show')
                || e.onclick.toLowerCase().includes('toggle')
            );

        // Elementos com class contendo export/excel/lote/dropdown
        const withClass = [...document.querySelectorAll('[class]')]
            .map(el => ({ tag: el.tagName, id: el.id, cls: el.className, text: el.textContent.trim().slice(0, 60) }))
            .filter(e =>
                e.cls.toLowerCase().includes('export')
                || e.cls.toLowerCase().includes('excel')
                || e.cls.toLowerCase().includes('lote')
                || (e.cls.toLowerCase().includes('dropdown') && !e.cls.includes('menu'))
            );

        // href do link Excel (pode ter URL direta)
        const excelLink = document.querySelector('a.flaticon-excel-file');
        const excelHref = excelLink ? excelLink.getAttribute('href') : null;
        const excelOnclick = excelLink ? excelLink.getAttribute('onclick') : null;

        // Toggle Bootstrap (data-toggle ou data-bs-toggle)
        const toggles = [...document.querySelectorAll('[data-toggle],[data-bs-toggle]')]
            .map(el => ({
                tag: el.tagName, id: el.id, cls: el.className.slice(0, 60),
                text: el.textContent.trim().slice(0, 40),
                dataToggle: el.getAttribute('data-toggle') || el.getAttribute('data-bs-toggle'),
                dataTarget: el.getAttribute('data-target') || el.getAttribute('data-bs-target') || '',
            }))
            .filter(e => e.dataToggle === 'dropdown' || e.dataToggle === 'collapse');

        return { withOnclick, withClass, excelHref, excelOnclick, toggles };
    });

    console.log('[STEP 6b] Elementos com onclick export/toggle:', dropdownInfo.withOnclick.length);
    dropdownInfo.withOnclick.forEach(e => console.log(' ', e.tag, e.id || '(sem id)', e.cls.slice(0, 40), '| onclick:', e.onclick));
    console.log('[STEP 6b] Elementos com class export/excel/lote:', dropdownInfo.withClass.length);
    dropdownInfo.withClass.forEach(e => console.log(' ', e.tag, e.id || '(sem id)', e.cls.slice(0, 60), '|', e.text.slice(0, 40)));
    console.log('[STEP 6b] Excel A href:', dropdownInfo.excelHref);
    console.log('[STEP 6b] Excel A onclick:', dropdownInfo.excelOnclick);
    console.log('[STEP 6b] Bootstrap toggles:', dropdownInfo.toggles.length);
    dropdownInfo.toggles.forEach(e => console.log(' ', e.tag, e.id || '(sem id)', e.cls, '| toggle:', e.dataToggle, '| target:', e.dataTarget, '|', e.text));

    // ── 6c. Inspecionar o tipo real do exportarExcel INPUT e a estrutura do form
    console.log('\n[STEP 6c] Inspecionando exportarExcel INPUT e form...');
    const inputInfo = await bodyFrame.evaluate(() => {
        const el = document.querySelector('[id="ExcessoVelocidadeDataList:paramPesquisa:exportarExcel"]');
        if (!el) return { found: false };
        const form = el.closest('form');
        const allInputs = form
            ? [...form.querySelectorAll('input')].map(i => ({
                id: i.id, name: i.name, type: i.type, value: i.value.slice(0, 40)
              }))
            : [];
        return {
            found: true,
            type: el.type,
            value: el.value,
            formId: form ? form.id : null,
            formAction: form ? form.action : null,
            allInputs,
        };
    });
    console.log('[STEP 6c] exportarExcel:', JSON.stringify(inputInfo, null, 2).slice(0, 1500));

    // ── 7. Tentar exportar Excel e capturar corpo da resposta ────────────
    console.log('\n[STEP 7] Tentando exportar via exportarExcel INPUT...');

    // Captura TODAS as respostas POST e verifica os bytes da resposta
    let postCount = 0;
    page.on('response', async (r) => {
        if (!r.url().includes('excessoVelocidadeList.seam') || r.request().method() !== 'POST') return;
        postCount++;
        const reqBody = r.request().postData() || '';
        const ct = r.headers()['content-type'] || '';
        const disp = r.headers()['content-disposition'] || '';
        console.log(`[STEP 7] POST #${postCount} req params (2000):`, reqBody.slice(0, 2000));
        console.log(`[STEP 7] POST #${postCount} response: ${r.status()} ${ct} | disp: ${disp || '(none)'}`);
        // Captura os primeiros bytes para detectar XLS (D0CF11E0) vs HTML
        try {
            const buf = await r.body();
            const hex4 = buf.slice(0, 4).toString('hex').toUpperCase();
            const isXls  = hex4 === 'D0CF11E0';  // OLE2 (xls)
            const isZip  = buf.slice(0, 2).toString('ascii') === 'PK'; // xlsx
            const isHtml = buf.slice(0, 5).toString('ascii').toLowerCase().includes('<') ;
            console.log(`[STEP 7] POST #${postCount} body magic: hex=${hex4} isXLS=${isXls} isXLSX=${isZip} isHTML=${isHtml} size=${buf.length}`);
            if (isXls || isZip) {
                const savePath = require('path').join(__dirname, `excesso_diagnose_${postCount}.xls`);
                require('fs').writeFileSync(savePath, buf);
                console.log(`[STEP 7] *** XLS salvo em: ${savePath} ***`);
            }
        } catch (e) {
            console.log(`[STEP 7] POST #${postCount} erro ao ler body:`, e.message);
        }
    });

    // Hipótese confirmada: servidor envia XLS mas com Content-Type: text/html
    // (sem Content-Disposition: attachment). Playwright não dispara download
    // event — o frame tenta "navegar" para o conteúdo binário.
    // Solução: page.route() intercepta ANTES do frame consumir e salva os bytes.

    const capturePath = require('path').join(__dirname, 'excesso_diagnose_capture.xls');
    let capturedByRoute = false;

    await page.route('**excessoVelocidadeList.seam**', async (route, request) => {
        if (request.method() !== 'POST') {
            await route.continue();
            return;
        }
        const response = await route.fetch();
        const body = await response.body();
        const hex4 = body.slice(0, 4).toString('hex').toUpperCase();
        const isXls  = hex4 === 'D0CF11E0';
        const isZip  = body.slice(0, 2).toString('ascii') === 'PK';
        const ct     = response.headers()['content-type'] || '';
        const disp   = response.headers()['content-disposition'] || '';
        console.log(`[ROUTE] POST response: ${response.status()} ${ct} | disp:${disp || '(none)'} | hex=${hex4} | size=${body.length} | isXLS=${isXls} isXLSX=${isZip}`);

        // Salva para análise: procura por window.open/location/download em HTML
        const bodyStr = body.toString('utf8');
        const downloadMatches = bodyStr.match(/(window\.(open|location)|href=["'][^"']*\.(xls|download|export)[^"']*["']|download\s*=|Content-Disposition|attachment)/gi) || [];
        if (downloadMatches.length > 0) {
            console.log(`[ROUTE] *** DOWNLOAD TRIGGERS encontrados:`, downloadMatches.slice(0, 10));
        }

        if (isXls || isZip) {
            require('fs').writeFileSync(capturePath, body);
            capturedByRoute = true;
            console.log(`[ROUTE] *** XLS interceptado e salvo: ${capturePath} ***`);
            await route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>export ok</body></html>' });
        } else {
            // Salva as respostas HTML/XML para análise manual
            const debugPath = require('path').join(__dirname, `excesso_debug_${Date.now()}.html`);
            require('fs').writeFileSync(debugPath, body);
            console.log(`[ROUTE] Resposta salva para análise: ${debugPath}`);
            await route.fulfill({ status: response.status(), headers: response.headers(), body });
        }
    });

    // Inspecionar variáveis de export após pesquisar
    const exportFns = await bodyFrame.evaluate(() => {
        const info = {};
        try { info.printEXCEL = typeof printEXCEL !== 'undefined' ? printEXCEL.toString().slice(0, 1000) : 'undefined'; } catch(e) { info.printEXCEL = 'error: ' + e.message; }
        try { info.printType  = typeof printType  !== 'undefined' ? printType : 'undefined'; } catch(e) { info.printType = 'error'; }
        try { info.url        = typeof url        !== 'undefined' ? url        : 'undefined'; } catch(e) { info.url = 'error: ' + e.message; }
        try { info.thisurl    = typeof thisurl    !== 'undefined' ? thisurl    : 'undefined'; } catch(e) { info.thisurl = 'error: ' + e.message; }
        try { info.printValidateOk = document.getElementById('ExcessoVelocidadeDataList:printValidateOk')?.value; } catch(e) { info.printValidateOk = 'error'; }
        return info;
    });
    console.log('[STEP 7] printType:', exportFns.printType, '| url:', exportFns.url, '| thisurl:', exportFns.thisurl, '| printValidateOk:', exportFns.printValidateOk);
    console.log('[STEP 7] printEXCEL fn:', exportFns.printEXCEL);

    // Abordagem confirmada: printEXCEL → window.open(popup) → XLS
    // O download event dispara no page pai (não no popup).
    console.log('[STEP 7] Chamando printEXCEL diretamente (abordagem confirmada)...');
    await page.unroute('**excessoVelocidadeList.seam**');

    const [dl] = await Promise.all([
        page.waitForEvent('download', { timeout: 30000 }),
        bodyFrame.evaluate(() => {
            if (typeof printEXCEL === 'function') {
                printEXCEL('ExcessoVelocidadeDataList', '');
            } else {
                console.log('printEXCEL não definida');
            }
        }),
    ]);

    if (dl) {
        const savePath = require('path').join(__dirname, 'excesso_diagnose_FINAL.xls');
        await dl.saveAs(savePath);
        console.log(`[STEP 7] DOWNLOAD CAPTURADO: ${dl.suggestedFilename()} → ${savePath}`);
    } else {
        console.log('[STEP 7] Nenhum download em 30s.');
    }

    console.log('\n[INFO] Aguardando 10s para observar rede restante...');
    await page.waitForTimeout(10000);

    console.log('[INFO] Frames abertos:');
    page.frames().forEach(f => console.log(' ', f.name() || '(sem nome)', '|', f.url()));

    console.log('[INFO] Mantendo browser aberto por mais 30s — inspecione manualmente.');
    await page.waitForTimeout(30000);

    await browser.close();
    console.log('[INFO] Concluído.');

})().catch(err => {
    console.error('[ERRO]', err.message);
    process.exit(1);
});
