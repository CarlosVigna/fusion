require('dotenv').config();

const { launchBrowser, loginMultiportal, waitForFrame } = require('./multiportal-auth');

const RELATORIOS_MENU_ID = 175;
const PLATE = 'FXZ9249';
const DATA_INICIO = '01/07/2026 00:00';
const DATA_FIM = '15/07/2026 23:59';

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

    // ── 6. Aguardar 5s e listar novamente ────────────────────────────────
    console.log('\n[STEP 6] Aguardando 5s para grid carregar...');
    await page.waitForTimeout(5000);

    console.log('[STEP 6] Elementos clicáveis APÓS pesquisar:');
    const aposP = await listClickable(bodyFrame);
    aposP.forEach(b => console.log(' ', b.tag, `id="${b.id}"`, `name="${b.name}"`, `visible=${b.visible}`, '|', b.text));

    // ── 7. Tentar clicar no botão Excel ──────────────────────────────────
    console.log('\n[STEP 7] Tentando clicar no botão Excel...');
    const btnExcel = await bodyFrame.evaluate(() => {
        const candidatos = [
            document.querySelector('[id="ExcessoVelocidadeDataList:paramPesquisa:btnExportXLS"]'),
            document.querySelector('a.flaticon-excel-file'),
            // fallback: qualquer link/botão que mencione xls ou excel
            ...[...document.querySelectorAll('a, button, input')]
                .filter(el =>
                    el.id.toLowerCase().includes('xls')
                    || el.id.toLowerCase().includes('excel')
                    || el.className.toLowerCase().includes('excel')
                    || el.textContent.trim().toLowerCase().includes('excel')
                ),
        ].filter(Boolean);

        if (candidatos.length === 0) return null;

        const el = candidatos[0];
        console.log('Clicando Excel em:', el.tagName, el.id, el.className, el.textContent.trim().slice(0, 40));
        el.click();
        return el.id || el.className || el.textContent.trim().slice(0, 40);
    });
    console.log('[INFO] Botão Excel usado:', btnExcel ?? 'NENHUM ENCONTRADO');

    console.log('\n[INFO] Aguardando 15s para observar download e rede...');
    await page.waitForTimeout(15000);

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
