require('dotenv').config();

const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');
const AdmZip = require('adm-zip');
const { launchBrowser, loginMultiportal, waitForFrame } = require('./multiportal-auth');
const { log } = require('./src/file-utils');
const { uploadSinistroResult } = require('./src/uploadSinistroResult');

// ATENCAO: os seletores de KM Mensal e Excesso de Velocidade abaixo
// seguem exatamente o que foi passado na especificacao da tarefa, mas
// NAO foram validados contra o portal Multiportal de verdade (sem
// acesso a essa automacao neste ambiente). Rodar manualmente com
// ETL_HEADLESS=false na primeira vez pra confirmar cada seletor antes
// de deixar isso automatico — se algo mudou no portal, o lugar certo
// pra corrigir e' downloadKmMensal()/downloadExcessoVelocidade() abaixo.
//
// "/app/data/sinistro/{plate}/" do pedido original e' um caminho de
// container Linux — este ETL roda como Task Scheduler no Windows do
// usuario (mesma maquina que roda index.js, index-vinculo.js etc.),
// entao os arquivos ficam em SINISTRO_DIR (Windows) em vez disso.
const SINISTRO_DIR =
    process.env.ETL_SINISTRO_DIR
    || 'C:/FusionData/sinistro';

function isoToBr(isoDate) {
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
}

// Quebra [startDate, endDate] em blocos de no maximo 7 dias — limite do
// relatorio de Excesso de Velocidade do Multiportal.
function buildWeeklyBlocks(startIso, endIso) {

    const blocks = [];

    let blockStart = new Date(startIso + 'T00:00:00');
    const end = new Date(endIso + 'T00:00:00');

    let index = 1;

    while (blockStart <= end) {

        const blockEnd = new Date(blockStart);
        blockEnd.setDate(blockEnd.getDate() + 6);

        if (blockEnd > end) {
            blockEnd.setTime(end.getTime());
        }

        blocks.push({
            index,
            start: blockStart.toISOString().slice(0, 10),
            end: blockEnd.toISOString().slice(0, 10),
        });

        const next = new Date(blockEnd);
        next.setDate(next.getDate() + 1);
        blockStart = next;
        index++;

    }

    return blocks;

}

// Categoria "Relatórios" no menu hierárquico do Multiportal — confirmado
// contra o portal real (mesmo padrao table[onclick="openMenu(N)"] usado
// por index.js e index-ultima-posicao.js pras outras categorias).
const RELATORIOS_MENU_ID = 175;

// O menu do Multiportal e' hierarquico — o item filho (ex: KM Mensal)
// so fica clicavel depois do item pai ("Relatórios") expandir. So clica
// no pai se o filho ainda nao estiver visivel: o clique no pai parece
// ser toggle, entao clicar de novo com o menu ja aberto (ex: entre o
// download de KM Mensal e o de Excesso de Velocidade, ambos sob
// "Relatórios") corre o risco de FECHAR o que um passo anterior ja
// deixou aberto.
async function expandParentMenuIfNeeded(menuFrame, childSelector) {

    const child = menuFrame.locator(childSelector);

    const isVisible = await child.isVisible().catch(() => false);

    if (isVisible) {
        return;
    }

    // Aguardar o frame mymenu carregar completamente antes de interagir
    await menuFrame.page().waitForTimeout(3000);

    // Chamar openMenu() via JS — o elemento tem class="menu_off" que o
    // torna oculto via CSS, então click() normal falha. evaluate() ignora
    // visibilidade completamente.
    await menuFrame.evaluate(`openMenu(${RELATORIOS_MENU_ID})`);

    // Aguardar até 10s para o filho ficar visível; se não acontecer,
    // tentar clicar nele também via JS como último recurso.
    await child.waitFor({ state: 'visible', timeout: 10000 }).catch(async () => {
        await menuFrame.evaluate((sel) => {
            const tr = document.querySelector(sel);
            if (tr) tr.click();
        }, childSelector);
    });

}

// Aguarda o download disparado pelo click e salva em destPath — se vier
// zipado, extrai o primeiro .xls/.xlsx de dentro; senao salva direto.
async function captureDownload(page, clickAction, destPath) {

    const downloadPromise = page.waitForEvent('download');

    await clickAction();

    const download = await downloadPromise;

    const suggested = download.suggestedFilename() || '';

    if (suggested.toLowerCase().endsWith('.zip')) {

        const tempZip = destPath + '.zip';

        await download.saveAs(tempZip);

        const zip = new AdmZip(tempZip);

        const entry = zip.getEntries().find(e =>
            /\.xlsx?$/i.test(e.entryName)
        );

        if (!entry) {
            throw new Error(`Nenhum XLS encontrado dentro do ZIP baixado (${suggested})`);
        }

        fs.writeFileSync(destPath, zip.readFile(entry));

        fs.unlinkSync(tempZip);

    } else {

        await download.saveAs(destPath);

    }

    return destPath;

}

async function downloadKmMensal(page, plate, startIso, endIso, outputDir) {

    log('[SINISTRO] Abrindo KM Mensal...');

    // Garante que o frame de menu carregou via URL, depois acessa pelo name
    await waitForFrame(page, '/system/layout/menu.seam');
    const menuFrame = page.frame({ name: 'mymenu' });

    await expandParentMenuIfNeeded(
        menuFrame,
        'tr[id="/system/reports/kmMensalList.seam"]'
    );

    // Navegar via doSubmit — os itens filhos podem continuar hidden no CSS
    // após openMenu(), então click() no locator ainda falha.
    await menuFrame.evaluate(() => {
        doSubmit(
            document.querySelector('tr[id="/system/reports/kmMensalList.seam"]'),
            '/system/reports/kmMensalList.seam'
        );
    });

    const bodyFrame = await waitForFrame(page, '/system/reports/kmMensalList.seam');

    await bodyFrame.locator(
        '[name="KmMensalDataList:paramPesquisa:placa"]'
    ).fill(plate);

    await bodyFrame.locator(
        '[name="KmMensalDataList:paramPesquisa:datainicial"]'
    ).fill(`${isoToBr(startIso)} 00:00`);

    await bodyFrame.locator(
        '[name="KmMensalDataList:paramPesquisa:datafinal"]'
    ).fill(`${isoToBr(endIso)} 23:59`);

    // O botão Excel só fica ativo depois que a pesquisa carrega o grid —
    // clicar em Pesquisar primeiro garante isso.
    await bodyFrame.evaluate(() => {
        const btn = document.querySelector(
            '[id="KmMensalDataList:paramPesquisa:btnPesquisa"]'
        );
        if (btn) btn.click();
    });

    await page.waitForTimeout(2000);

    const destPath = path.join(
        outputDir,
        `km_mensal_${plate}_${startIso}_${endIso}.xls`
    );

    // Usar evaluate no botão Excel — site JSF onde click() do Playwright
    // pode não disparar o evento correto e causar timeout no download.
    await captureDownload(
        page,
        () => bodyFrame.evaluate(() => {
            const btn = document.querySelector(
                '[id="KmMensalDataList:paramPesquisa:btnExportXLS"]'
            );
            if (btn) btn.click();
        }),
        destPath
    );

    log(`[SINISTRO] KM Mensal salvo: ${destPath}`);

    return destPath;

}

async function downloadExcessoVelocidadeBlock(page, plate, blockStartIso, blockEndIso, blockIndex, outputDir) {

    log(`[SINISTRO] Abrindo Excesso de Velocidade (bloco ${blockIndex}: ${blockStartIso} a ${blockEndIso})...`);

    // Garante que o frame de menu carregou via URL, depois acessa pelo name
    await waitForFrame(page, '/system/layout/menu.seam');
    const menuFrame = page.frame({ name: 'mymenu' });

    await expandParentMenuIfNeeded(
        menuFrame,
        'tr[id="/system/reports/excessoVelocidadeList.seam"]'
    );

    // Navegar via doSubmit pelo mesmo motivo que kmMensalList acima.
    await menuFrame.evaluate(() => {
        doSubmit(
            document.querySelector('tr[id="/system/reports/excessoVelocidadeList.seam"]'),
            '/system/reports/excessoVelocidadeList.seam'
        );
    });

    const bodyFrame = await waitForFrame(page, '/system/reports/excessoVelocidadeList.seam');

    await bodyFrame.locator(
        '[name="ExcessoVelocidadeDataList:paramPesquisa:veiculo"]'
    ).fill(plate);

    await bodyFrame.locator(
        '[name="ExcessoVelocidadeDataList:paramPesquisa:dataInicio"]'
    ).fill(`${isoToBr(blockStartIso)} 00:00`);

    await bodyFrame.locator(
        '[name="ExcessoVelocidadeDataList:paramPesquisa:dataFim"]'
    ).fill(`${isoToBr(blockEndIso)} 23:59`);

    const destPath = path.join(
        outputDir,
        `excesso_velocidade_${plate}_${blockStartIso}_${blockEndIso}_bloco${blockIndex}.xls`
    );

    await captureDownload(
        page,
        () => bodyFrame.locator('a.flaticon-excel-file').click(),
        destPath
    );

    log(`[SINISTRO] Excesso de Velocidade bloco ${blockIndex} salvo: ${destPath}`);

    return destPath;

}

async function run(job) {

    const { id, plate, startDate, endDate } = job;

    log(`[SINISTRO] Análise iniciada: plate=${plate} periodo=${startDate} a ${endDate} (id=${id})`);

    const outputDir = path.join(SINISTRO_DIR, plate);

    await fse.ensureDir(outputDir);

    const browser = await launchBrowser();

    const context = await browser.newContext({ acceptDownloads: true });

    const page = await context.newPage();

    let kmMensalFile = null;

    const speedFiles = [];

    try {

        await loginMultiportal(page);

        log('[SINISTRO] Login realizado.');

        kmMensalFile = await downloadKmMensal(page, plate, startDate, endDate, outputDir);

        const blocks = buildWeeklyBlocks(startDate, endDate);

        for (const block of blocks) {

            const speedFile = await downloadExcessoVelocidadeBlock(
                page,
                plate,
                block.start,
                block.end,
                block.index,
                outputDir
            );

            speedFiles.push(speedFile);

        }

        await browser.close();

        await uploadSinistroResult({
            sinistroId: id,
            kmMensalFile,
            speedFiles,
            status: 'SUCCESS',
        });

        log(`[SINISTRO] Análise ${id} concluída com sucesso.`);

    } catch (error) {

        log(`[SINISTRO] Erro na análise ${id}: ${error.message}`);

        await browser.close().catch(() => {});

        await uploadSinistroResult({
            sinistroId: id,
            kmMensalFile,
            speedFiles,
            status: 'ERROR',
            error: error.message,
        }).catch(() => {});

        throw error;

    }

}

module.exports = { run };
