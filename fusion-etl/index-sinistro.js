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
    await menuFrame.evaluate((id) => openMenu(id), RELATORIOS_MENU_ID);

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

    // btnUpdateCallByJS é o botão "Pesquisar" confirmado pelo diagnóstico
    await bodyFrame.evaluate(() => {
        document.querySelector('[id="KmMensalDataList:btnUpdateCallByJS"]').click();
    });

    // Diagnóstico confirmou ~8s para o grid JSF renderizar após pesquisar
    await page.waitForTimeout(8000);

    const destPath = path.join(
        outputDir,
        `km_mensal_${plate}_${startIso}_${endIso}.xls`
    );

    // Promise.all garante que o listener está registrado antes do clique;
    // timeout de 60s porque o JSF pode levar vários segundos para responder.
    const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 60000 }),
        bodyFrame.evaluate(() => {
            document.querySelector(
                '[id="KmMensalDataList:paramPesquisa:btnExportXLS"]'
            ).click();
        }),
    ]);

    // Mesmo tratamento de ZIP que captureDownload
    const suggested = download.suggestedFilename() || '';
    if (suggested.toLowerCase().endsWith('.zip')) {
        const tempZip = destPath + '.zip';
        await download.saveAs(tempZip);
        const zip = new AdmZip(tempZip);
        const entry = zip.getEntries().find(e => /\.xlsx?$/i.test(e.entryName));
        if (!entry) {
            throw new Error(`Nenhum XLS encontrado dentro do ZIP baixado (${suggested})`);
        }
        fs.writeFileSync(destPath, zip.readFile(entry));
        fs.unlinkSync(tempZip);
    } else {
        await download.saveAs(destPath);
    }

    log(`[SINISTRO] KM Mensal salvo: ${destPath}`);

    return destPath;

}

async function downloadExcessoVelocidadeBlock(page, plate, blockStartIso, blockEndIso, blockIndex, outputDir) {

    log(`[SINISTRO] Abrindo Excesso de Velocidade (bloco ${blockIndex}: ${blockStartIso} a ${blockEndIso})...`);

    // Garante que o frame de menu carregou via URL, depois acessa pelo name
    await waitForFrame(page, '/system/layout/menu.seam');
    const menuFrame = page.frame({ name: 'mymenu' });

    // Após o download via popup (printEXCEL → window.open), o bodyFrame fica
    // em estado stale: waitForFrame retorna o frame antigo sem recarregar.
    // Para blocos > 1, forçar uma navegação antecipada + espera antes do
    // fluxo normal para garantir que o frame recarregue do zero.
    if (blockIndex > 1) {
        await menuFrame.evaluate(() => {
            doSubmit(
                document.querySelector('tr[id="/system/reports/excessoVelocidadeList.seam"]'),
                '/system/reports/excessoVelocidadeList.seam'
            );
        });
        await page.waitForTimeout(3000);
    }

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

    // Diagnóstico mostrou que o JS da página leva ~5s para inicializar os
    // campos e botões — sem esse wait os locators retornam vazio.
    await page.waitForTimeout(5000);

    const veiculoLocator = bodyFrame.locator(
        '[name="ExcessoVelocidadeDataList:paramPesquisa:veiculo"]'
    );

    // Interceptar resposta Ajax do autocomplete para capturar o ID interno
    // do veículo — mais confiável do que depender do clique no dropdown.
    let capturedVehicleId = null;
    const autocompleteHandler = async (response) => {
        const url = response.url();
        if (!url.includes('ExcessoVelocidade') && !url.includes('excessoVelocidade')) return;
        const ct = response.headers()['content-type'] || '';
        if (!ct.includes('json') && !ct.includes('xml') && !ct.includes('html')) return;
        try {
            const text = await response.text();
            // RichFaces retorna JSON como [{id:"123",value:"ABC1D23"}, ...]
            // ou XML <suggestions><suggestion id="123">...</suggestion></suggestions>
            const idMatch = text.match(/"id"\s*:\s*"(\d+)"/);
            if (idMatch) {
                capturedVehicleId = idMatch[1];
                log(`[SINISTRO] Autocomplete Ajax: vehicleId capturado=${capturedVehicleId}`);
            }
        } catch { /* silencioso */ }
    };
    page.on('response', autocompleteHandler);

    // Click para focar o campo antes de digitar (alguns RichFaces exigem)
    await veiculoLocator.click();
    await page.waitForTimeout(300);
    await veiculoLocator.clear();

    // pressSequentially dispara keydown/keyup reais — fill() usa JS e não
    // dispara eventos de teclado, por isso o dropdown nunca abria.
    await veiculoLocator.pressSequentially(plate, { delay: 100 });

    // 3s para a requisição Ajax do autocomplete retornar e o dropdown renderizar
    await page.waitForTimeout(3000);
    page.off('response', autocompleteHandler);

    log(`[SINISTRO] Autocomplete Ajax vehicleId=${capturedVehicleId ?? 'não capturado'}`);

    // Seletores CSS do dropdown — cobre RichFaces 3.x, 4.x e jQuery UI
    const dropdownSel = [
        '.rich-suggestion-item',
        '.rf-au-itm',
        '.ui-autocomplete-item',
        '.ui-menu-item',
        '[class*="suggestion"]',
        'li[class*="item"]',
        'td[class*="item"]',
    ].join(', ');

    const suggestion = bodyFrame.locator(dropdownSel).first();
    let autocompleteOk = false;

    try {
        await suggestion.waitFor({ state: 'visible', timeout: 3000 });
        await suggestion.click();
        autocompleteOk = true;
        log('[SINISTRO] Autocomplete: sugestão do dropdown clicada');
    } catch {
        log('[SINISTRO] Autocomplete: dropdown não apareceu');

        // Dump do HTML da área do form para diagnóstico (primeiros 4 000 chars)
        const formHtml = await bodyFrame.evaluate(() => {
            const form = document.querySelector('form') || document.body;
            return form.innerHTML.slice(0, 4000);
        });
        log('[SINISTRO] HTML do form (4000 chars):\n' + formHtml);

        // Fallback Tab — dispara onblur/onchange no campo
        await veiculoLocator.press('Tab');
        await page.waitForTimeout(1000);
        log('[SINISTRO] Autocomplete: Tab pressionado como fallback');
    }

    // Se o Ajax capturou o ID, setar diretamente no campo hidden
    if (capturedVehicleId && capturedVehicleId !== '0') {
        await bodyFrame.evaluate((id) => {
            const el = document.getElementById('ExcessoVelocidadeDataList:paramPesquisa:placaVeiculoHidden');
            if (el) el.value = id;
        }, capturedVehicleId);
        log(`[SINISTRO] placaVeiculoHidden setado via Ajax: ${capturedVehicleId}`);
    }

    const hiddenValue = await bodyFrame.evaluate(() => {
        const el = document.getElementById('ExcessoVelocidadeDataList:paramPesquisa:placaVeiculoHidden');
        return el ? el.value : 'not found';
    });
    log(`[SINISTRO] placaVeiculoHidden final=${hiddenValue} (autocompleteOk=${autocompleteOk})`);
    if (hiddenValue === '0' || hiddenValue === 'not found') {
        log('[SINISTRO] AVISO: placaVeiculoHidden ainda "0" — a pesquisa pode retornar todas as posições em vez de só excessos');
    }

    await bodyFrame.locator(
        '[name="ExcessoVelocidadeDataList:paramPesquisa:dataInicio"]'
    ).fill(`${isoToBr(blockStartIso)} 00:00`);

    await bodyFrame.locator(
        '[name="ExcessoVelocidadeDataList:paramPesquisa:dataFim"]'
    ).fill(`${isoToBr(blockEndIso)} 23:59`);

    // Pesquisar: buttonFindHidden é o INPUT JSF real; fallback para link "Pesquisar"
    await bodyFrame.evaluate(() => {
        const btn = document.getElementById('ExcessoVelocidadeDataList:buttonFindHidden');
        if (btn) {
            btn.click();
        } else {
            for (const a of document.querySelectorAll('a')) {
                if (a.textContent.trim() === 'Pesquisar') { a.click(); break; }
            }
        }
    });

    // ~8s para o grid JSF renderizar após pesquisar (confirmado no KM Mensal)
    await page.waitForTimeout(8000);

    const destPath = path.join(
        outputDir,
        `excesso_velocidade_${plate}_${blockStartIso}_${blockEndIso}_bloco${blockIndex}.xls`
    );

    // window.open(url, "printEXCEL", ...) reutiliza o popup do bloco anterior
    // pelo nome — o browser não dispara um novo evento de popup/download no
    // page pai. Para blocos > 1, fechar o popup existente via JS antes de
    // chamar printEXCEL para que window.open crie um popup fresco, o que
    // restaura o comportamento do bloco 1 (download event no page pai).
    if (blockIndex > 1) {
        await page.evaluate(() => {
            try {
                const popup = window.open('', 'printEXCEL');
                if (popup) popup.close();
            } catch (e) {}
        });
    }

    const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 60000 }),
        bodyFrame.evaluate(() => {
            printEXCEL('ExcessoVelocidadeDataList', 'list.report.excel');
        }),
    ]);

    // O servidor serve o XLS direto — sem ZIP, mas manter tratamento defensivo
    const suggested = download.suggestedFilename() || '';
    if (suggested.toLowerCase().endsWith('.zip')) {
        const tempZip = destPath + '.zip';
        await download.saveAs(tempZip);
        const zip = new AdmZip(tempZip);
        const entry = zip.getEntries().find(e => /\.xlsx?$/i.test(e.entryName));
        if (!entry) {
            throw new Error(`Nenhum XLS encontrado dentro do ZIP baixado (${suggested})`);
        }
        fs.writeFileSync(destPath, zip.readFile(entry));
        fs.unlinkSync(tempZip);
    } else {
        await download.saveAs(destPath);
    }

    log(`[SINISTRO] Excesso de Velocidade bloco ${blockIndex} salvo: ${destPath}`);

    return destPath;

}

async function downloadTempoIgnicao(page, plate, startIso, endIso, outputDir) {

    log(`[SINISTRO] Abrindo Tempo de Ignição (${startIso} a ${endIso})...`);

    await waitForFrame(page, '/system/layout/menu.seam');
    const menuFrame = page.frame({ name: 'mymenu' });

    await expandParentMenuIfNeeded(
        menuFrame,
        'tr[id="/system/reports/acumuladosReportIgnicao.seam"]'
    );

    await menuFrame.evaluate(() => {
        doSubmit(
            document.querySelector('tr[id="/system/reports/acumuladosReportIgnicao.seam"]'),
            '/system/reports/acumuladosReportIgnicao.seam'
        );
    });

    const bodyFrame = await waitForFrame(page, '/system/reports/acumuladosReportIgnicao.seam');

    // Mesmo diagnóstico do Excesso de Velocidade: JS da página leva ~5s
    await page.waitForTimeout(5000);

    // Campo de placa usa autocomplete RichFaces — mesmo padrão do Excesso.
    // pressSequentially dispara keydown/keyup reais para abrir o dropdown.
    const placaLocator = bodyFrame.locator(
        '[name="AcumuladosIgnicaoDataList:paramPesquisa:placaSearch"]'
    );
    await placaLocator.clear();
    await placaLocator.pressSequentially(plate, { delay: 80 });
    await page.waitForTimeout(2000);

    const suggestion = bodyFrame.locator(
        '.rich-suggestion-item, .ui-autocomplete-item, [class*="suggestion"]'
    ).first();
    try {
        await suggestion.waitFor({ state: 'visible', timeout: 5000 });
        await suggestion.click();
        log('[SINISTRO] Ignição autocomplete: sugestão clicada');
    } catch {
        await placaLocator.press('Tab');
        await page.waitForTimeout(1000);
        log('[SINISTRO] Ignição autocomplete: sem sugestão, Tab pressionado como fallback');
    }

    // Log do hidden para diagnóstico — o nome exato será confirmado no primeiro run
    const hiddenValue = await bodyFrame.evaluate(() => {
        const candidates = [
            document.getElementById('AcumuladosIgnicaoDataList:paramPesquisa:placaHidden'),
            document.getElementById('AcumuladosIgnicaoDataList:paramPesquisa:veiculoHidden'),
            document.getElementById('AcumuladosIgnicaoDataList:paramPesquisa:placaVeiculoHidden'),
        ];
        const el = candidates.find(Boolean);
        return el ? `${el.id}=${el.value}` : 'hidden não encontrado';
    });
    log(`[SINISTRO] Ignição placaHidden: ${hiddenValue}`);

    await bodyFrame.locator(
        '[name="AcumuladosIgnicaoDataList:paramPesquisa:dataInicio"]'
    ).fill(`${isoToBr(startIso)} 00:00`);

    await bodyFrame.locator(
        '[name="AcumuladosIgnicaoDataList:paramPesquisa:dataFim"]'
    ).fill(`${isoToBr(endIso)} 23:59`);

    // Pesquisar via btnUpdateCallByJS (conforme spec do usuário); fallback igual ao Excesso
    await bodyFrame.evaluate(() => {
        const btn = document.getElementById('AcumuladosIgnicaoDataList:btnUpdateCallByJS')
            || document.getElementById('AcumuladosIgnicaoDataList:buttonFindHidden');
        if (btn) {
            btn.click();
        } else {
            for (const a of document.querySelectorAll('a')) {
                if (a.textContent.trim() === 'Pesquisar') { a.click(); break; }
            }
        }
    });

    await page.waitForTimeout(8000);

    const destPath = path.join(
        outputDir,
        `tempo_ignicao_${plate}_${startIso}_${endIso}.xls`
    );

    // Ignição é sempre o último download — popup "printEXCEL" pode estar
    // aberto do Excesso de Velocidade; fecha antes para criar popup fresco.
    await page.evaluate(() => {
        try {
            const popup = window.open('', 'printEXCEL');
            if (popup) popup.close();
        } catch (e) {}
    });

    const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 60000 }),
        bodyFrame.evaluate(() => {
            printEXCEL('AcumuladosIgnicaoDataList', 'list.report.excel');
        }),
    ]);

    const suggested = download.suggestedFilename() || '';
    if (suggested.toLowerCase().endsWith('.zip')) {
        const tempZip = destPath + '.zip';
        await download.saveAs(tempZip);
        const zip = new AdmZip(tempZip);
        const entry = zip.getEntries().find(e => /\.xlsx?$/i.test(e.entryName));
        if (!entry) throw new Error(`Nenhum XLS encontrado dentro do ZIP (${suggested})`);
        fs.writeFileSync(destPath, zip.readFile(entry));
        fs.unlinkSync(tempZip);
    } else {
        await download.saveAs(destPath);
    }

    log(`[SINISTRO] Tempo de Ignição salvo: ${destPath}`);

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

    let kmMensalFile    = null;
    let ignicaoFile     = null;

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

        ignicaoFile = await downloadTempoIgnicao(page, plate, startDate, endDate, outputDir);

        await browser.close();

        await uploadSinistroResult({
            sinistroId: id,
            kmMensalFile,
            speedFiles,
            ignicaoFile,
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
            ignicaoFile,
            status: 'ERROR',
            error: error.message,
        }).catch(() => {});

        throw error;

    }

}

module.exports = { run };
