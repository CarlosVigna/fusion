require('dotenv').config();

const { launchBrowser, loginMultiportal, waitForFrame } = require('./multiportal-auth');

(async () => {

    const browser = await launchBrowser();

    // acceptDownloads: true para capturar o evento download caso venha
    const context = await browser.newContext({ acceptDownloads: true });
    const page    = await context.newPage();

    // ── Interceptores de rede ────────────────────────────────────────────
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
        const ct  = res.headers()['content-type'] || '';
        const url = res.url();
        if (
            ct.includes('excel')
            || ct.includes('spreadsheet')
            || ct.includes('octet-stream')
            || url.includes('xls')
            || url.includes('download')
        ) {
            console.log('[RESPONSE DOWNLOAD]', res.status(), url);
            console.log('  content-type:', ct);
            console.log('  content-disposition:', res.headers()['content-disposition'] || '(none)');
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

    // ── Navegar até KM Mensal ────────────────────────────────────────────
    await waitForFrame(page, '/system/layout/menu.seam');
    const menuFrame = page.frame({ name: 'mymenu' });

    console.log('[INFO] Abrindo menu Relatórios (175)...');
    await menuFrame.evaluate('openMenu(175)');
    await page.waitForTimeout(2000);

    console.log('[INFO] Navegando para KM Mensal via doSubmit...');
    await menuFrame.evaluate(() => {
        doSubmit(
            document.querySelector('tr[id="/system/reports/kmMensalList.seam"]'),
            '/system/reports/kmMensalList.seam'
        );
    });

    // ── Aguardar o frame de body carregar a página de KM Mensal ─────────
    console.log('[INFO] Aguardando frame body carregar kmMensalList...');
    const bodyFrame = await waitForFrame(page, '/system/reports/kmMensalList.seam', 20000);

    // ── Preencher formulário ─────────────────────────────────────────────
    console.log('[INFO] Preenchendo formulário...');
    await bodyFrame.locator('[name="KmMensalDataList:paramPesquisa:placa"]').fill('FXZ9249');
    await bodyFrame.locator('[name="KmMensalDataList:paramPesquisa:datainicial"]').fill('01/07/2026 00:00');
    await bodyFrame.locator('[name="KmMensalDataList:paramPesquisa:datafinal"]').fill('15/07/2026 23:59');

    // ── Pesquisar ────────────────────────────────────────────────────────
    console.log('[INFO] Clicando em Pesquisar...');
    await bodyFrame.evaluate(() => {
        const btn = document.querySelector('[id="KmMensalDataList:paramPesquisa:btnPesquisa"]');
        if (btn) btn.click();
        else console.warn('btnPesquisa não encontrado');
    });

    console.log('[INFO] Aguardando grid carregar (3s)...');
    await page.waitForTimeout(3000);

    // ── Excel ────────────────────────────────────────────────────────────
    console.log('[INFO] Clicando em Excel...');
    console.log('[INFO] Botões disponíveis no body frame:');
    const botoes = await bodyFrame.evaluate(() =>
        [...document.querySelectorAll('a, input[type="button"], button')]
            .map(el => ({ tag: el.tagName, id: el.id, text: el.textContent.trim().slice(0, 60) }))
            .filter(b => b.text || b.id)
    );
    botoes.forEach(b => console.log(' ', b.tag, b.id || '(sem id)', '|', b.text));

    await bodyFrame.evaluate(() => {
        const btn = document.querySelector('[id="KmMensalDataList:paramPesquisa:btnExportXLS"]');
        if (btn) {
            console.log('btnExportXLS encontrado, clicando...');
            btn.click();
        } else {
            console.log('btnExportXLS NÃO encontrado no DOM');
        }
    });

    console.log('[INFO] Aguardando 8s para ver o que acontece...');
    await page.waitForTimeout(8000);

    console.log('[INFO] Estado atual do body frame URL:', bodyFrame.url());
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
