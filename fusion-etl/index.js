require('dotenv').config();

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const AdmZip = require('adm-zip');
const fse = require('fs-extra');
const { launchBrowser, loginMultiportal, waitForFrame } = require('./multiportal-auth');
const { moveToBackupWithRotation, log } = require('./src/file-utils');
const { uploadToBackend } = require('./src/uploadToBackend');
const { reportHeartbeat } = require('./src/etlStatusReporter');

const DOWNLOADS_DIR =
    process.env.ETL_DOWNLOADS_DIR
    || 'C:/FusionData/etl/downloads';

const OUTPUT_DIR =
    process.env.ETL_OUTPUT_DIR
    || 'C:/FusionData/imports/pending';

const TEMP_DIR =
    process.env.ETL_TEMP_DIR
    || path.join(DOWNLOADS_DIR, 'temp');

// Mesmo padrao de index-i4pro.js — screenshot de diagnostico junto do
// etl.log (mesma pasta base, subpasta screenshots/) pra inspecionar
// visualmente em qual tela o fluxo travou.
const SCREENSHOT_DIR = path.join(process.env.ETL_LOG_DIR || 'C:/FusionData/log', 'screenshots');

async function saveErrorScreenshot(page, label) {
    try {
        fse.ensureDirSync(SCREENSHOT_DIR);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filePath = path.join(SCREENSHOT_DIR, `${timestamp}_${label}.png`);
        await page.screenshot({ path: filePath, fullPage: true });
        return filePath;
    } catch (_) {
        return null;
    }
}

async function downloadFile(url, destination) {

    const response = await axios({
        method: 'GET',
        url,
        responseType: 'stream'
    });

    const writer = fs.createWriteStream(destination);

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

async function run() {

    log('Scraper dispositivos iniciado');

    const browser = await launchBrowser();

    const context = await browser.newContext();

    const page = await context.newPage();

    try {

        console.log('====================================');
        console.log('FUSION ETL - MULTIPORTAL');
        console.log('====================================');

        // LOGIN

        await reportHeartbeat({ type: 'MULTIPORTAL_DEVICE', status: 'RUNNING', step: 'Fazendo login no portal' });

        await loginMultiportal(page);

        console.log('Login realizado.');

        await reportHeartbeat({ type: 'MULTIPORTAL_DEVICE', status: 'RUNNING', step: 'Abrindo cadastro de dispositivos' });

        // MENU

        const menuFrame = await waitForFrame(
            page,
            '/system/layout/menu.seam'
        );

        try {

            // Numero do menu (36) fixo, historicamente estavel — mas o
            // Multiportal pode renumerar sem aviso.
            await menuFrame.locator(
                'table[onclick="openMenu(36)"]'
            ).click({ timeout: 15000 });

        } catch (menuError) {

            const screenshotPath = await saveErrorScreenshot(page, 'menu-dispositivos-timeout');

            log(`[DEVICES] Timeout no menu openMenu(36) — Multiportal pode ter mudado o numero. `
                + `Screenshot: ${screenshotPath || 'falhou ao salvar'}. Erro: ${menuError.message}`);

            console.error('Seletor fixo do menu (openMenu(36)) falhou, tentando deteccao flexivel por texto...');
            console.error(menuError.message);

            // Fallback: busca o menu pelo texto do item em vez do numero
            // fixo do submenu, que pode ter mudado.
            await menuFrame.locator(
                'text=Dispositivos, text=Cadastro'
            ).first().click({ timeout: 15000 });

        }

        await menuFrame.locator(
            'tr[id="/system/gateway/devicesList.seam"]'
        ).waitFor({ state: 'visible' });

        await menuFrame.locator(
            'tr[id="/system/gateway/devicesList.seam"]'
        ).click();

        // DISPOSITIVOS

        const devicesFrame = await waitForFrame(
            page,
            '/system/gateway/devicesList.seam'
        );

        const findButton = devicesFrame.locator(
            'table[onclick="find()"]'
        );

        await findButton.waitFor({ state: 'visible' });

        await findButton.click();

        console.log('Pesquisa executada.');

        const excelButton = devicesFrame.getByText('Excel');

        await excelButton.waitFor({ state: 'visible' });

        // IMPRESSÃO — pega o topFrame antes de clicar em Excel pra poder
        // checar se ja existe um item pendente na fila (ver abaixo).
        const topFrame = await waitForFrame(
            page,
            '/system/layout/top.seam'
        );

        // Antes de pedir um novo Excel, verifica se ja tem um item
        // pendente na fila de impressao — se o ETL foi reexecutado
        // enquanto o Multiportal ainda estava gerando o relatorio
        // anterior, clicar em Excel de novo so' faz o portal gerar 2+
        // arquivos em paralelo (e demorar mais a fila pra todo mundo).
        // Checagem best-effort: o icone e' compartilhado com os outros
        // relatorios (posicao, vinculo), entao um falso positivo aqui
        // so' atrasa uma geracao nova — nunca perde dados.
        const alreadyPending = await topFrame
            .locator('img[onclick="openImpressao()"]')
            .isVisible()
            .catch(() => false);

        if (alreadyPending) {

            console.log('Já existe um item na fila de impressão — pulando nova solicitação de Excel.');
            log('[DEVICES] Fila de impressao ja tinha item pendente, Excel nao foi solicitado de novo (possivel retry concorrente).');

        } else {

            await excelButton.click();

            console.log('Excel solicitado.');

        }

        await reportHeartbeat({ type: 'MULTIPORTAL_DEVICE', status: 'RUNNING', step: 'Aguardando download' });

        // Timeout de 5min (era 3min) — planilhas maiores vinham dando
        // timeout aqui antes do Multiportal terminar de gerar o Excel.
        await topFrame.locator(
            'img[onclick="openImpressao()"]'
        ).waitFor({
            state: 'visible',
            timeout: 300000
        });

        console.log('Impressão disponível.');

        await topFrame.locator(
            'img[onclick="openImpressao()"]'
        ).click();

        const impressaoFrame = await waitForFrame(
            page,
            '/system/security/impressaoList.seam'
        );

        console.log('Frame impressão encontrado.');

        // Aguarda o link openDownload aparecer no DOM — em headless o frame
        // pode ser sinalizado como carregado antes do conteúdo dinâmico
        // estar presente, causando match vazio no regex logo abaixo.
        await impressaoFrame.waitForSelector(
            '[onclick*="openDownload"]',
            { timeout: 60000 }
        );

        await page.screenshot({ path: '/tmp/etl/debug-dispositivos.png' });

        const html = await impressaoFrame.content();

        fs.writeFileSync(
            '/tmp/etl/impressao-completa.html',
            html,
            'utf8'
        );

        // CAPTURA reportId e executionId
        // O primeiro argumento ('3', '1', etc.) varia — aceita qualquer valor
        // em vez de exigir '3' hardcoded, que causava falha silenciosa se
        // o servidor retornasse um tipo diferente.
        const match = html.match(
            /openDownload\('[^']*',\s*'(\d+)',\s*'(\d+)'/
        );

        if (!match) {
            throw new Error(
                'Não foi possível localizar openDownload.'
            );
        }

        const reportId = match[1];
        const executionId = match[2];

        console.log('');
        console.log('====================================');
        console.log('RELATORIO IDENTIFICADO');
        console.log('====================================');

        console.log('Report ID:', reportId);
        console.log('Execution ID:', executionId);

        const url =
            `https://reportsj.1gps.com.br/reports/16/${reportId}/${executionId}/cadastro_dispositivos_excel.zip`;

        console.log('');
        console.log('URL:');
        console.log(url);

        await fse.ensureDir(DOWNLOADS_DIR);

        const destination =
            path.join(DOWNLOADS_DIR, 'cadastro_dispositivos_excel.zip');

        console.log('');
        console.log('Baixando ZIP...');

        await downloadFile(
            url,
            destination
        );

        console.log('');
        console.log('====================================');
        console.log('DOWNLOAD CONCLUIDO');
        console.log('====================================');

        console.log(destination);

        console.log('');
        console.log('====================================');
        console.log('EXTRAINDO ZIP');
        console.log('====================================');

        const tempPath = TEMP_DIR;

        await fse.emptyDir(tempPath);

        const zip = new AdmZip(destination);

        zip.extractAllTo(
            tempPath,
            true
        );

        console.log('ZIP extraído.');

        const files = fs.readdirSync(tempPath);

        console.log('');
        console.log('ARQUIVOS ENCONTRADOS:');

        files.forEach(file => {
            console.log('-', file);
        });

        const xlsFile = files.find(file =>
            file.toLowerCase().endsWith('.xls')
        );

        if (!xlsFile) {
            throw new Error(
                'Nenhum arquivo XLS encontrado.'
            );
        }

        const sourceFile =
            path.join(tempPath, xlsFile);

        const targetFile =
            path.join(OUTPUT_DIR, 'MULTIPORTAL_DISPOSITIVOS.xls');

        await fse.ensureDir(OUTPUT_DIR);

        await fse.copy(
            sourceFile,
            targetFile,
            {
                overwrite: true
            }
        );

        await moveToBackupWithRotation(
            sourceFile,
            path.join(DOWNLOADS_DIR, 'history'),
            10
        );

        console.log('');
        console.log('====================================');
        console.log('ARQUIVO PROCESSADO');
        console.log('====================================');

        console.log(targetFile);

        log('Download concluído: MULTIPORTAL_DISPOSITIVOS.xls');

        await reportHeartbeat({ type: 'MULTIPORTAL_DEVICE', status: 'RUNNING', step: 'Enviando para o Fusion' });

        await uploadToBackend(targetFile, 'MULTIPORTAL_DEVICE');

        await reportHeartbeat({ type: 'MULTIPORTAL_DEVICE', status: 'SUCCESS', step: 'Concluído' });

        console.log('');
        console.log('====================================');
        console.log('LIMPANDO FILA DE IMPRESSAO');
        console.log('====================================');

        page.once('dialog', async dialog => {

            console.log('');
            console.log('DIALOG ENCONTRADO');
            console.log(dialog.message());

            await dialog.accept();

            console.log('DIALOG ACEITO');
        });

        await impressaoFrame.locator(
            '#ImpressaoDataList\\:j_id63'
        ).click();

        console.log('Botão excluir clicado.');

    } catch (error) {

        console.error('');
        console.error('====================================');
        console.error('ERRO');
        console.error('====================================');
        console.error(error);

        log(`Erro no scraper dispositivos: ${error.message}`);

        await browser.close();

        throw error;
    }

    await browser.close();

}

module.exports = { run };

if (require.main === module) {
    run();
}
