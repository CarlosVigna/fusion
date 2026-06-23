require('dotenv').config();

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const AdmZip = require('adm-zip');
const fse = require('fs-extra');
const { launchBrowser, loginMultiportal, waitForFrame } = require('./multiportal-auth');
const { moveToBackupWithRotation, log } = require('./src/file-utils');
const { uploadToBackend } = require('./src/uploadToBackend');

const DOWNLOADS_DIR =
    process.env.ETL_DOWNLOADS_DIR
    || 'C:/FusionData/etl/downloads';

const OUTPUT_DIR =
    process.env.ETL_OUTPUT_DIR
    || 'C:/FusionData/imports/pending';

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

        await loginMultiportal(page);

        console.log('Login realizado.');

        // MENU

        const menuFrame = await waitForFrame(
            page,
            '/system/layout/menu.seam'
        );

        await menuFrame.locator(
            'table[onclick="openMenu(36)"]'
        ).click();

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

        await excelButton.click();

        console.log('Excel solicitado.');

        // IMPRESSÃO

        const topFrame = await waitForFrame(
            page,
            '/system/layout/top.seam'
        );

        await topFrame.locator(
            '#occurrence_priority_text'
        ).waitFor({
            state: 'visible',
            timeout: 180000
        });

        console.log('Impressão disponível.');

        await topFrame.locator(
            '#occurrence_priority_text'
        ).click();

        const impressaoFrame = await waitForFrame(
            page,
            '/system/security/impressaoList.seam'
        );

        console.log('Frame impressão encontrado.');

        const html = await impressaoFrame.content();

        // DEBUG OPCIONAL
        fs.writeFileSync(
            'impressao-completa.html',
            html,
            'utf8'
        );

        // CAPTURA reportId e executionId

        const match = html.match(
            /openDownload\('3',\s*'(\d+)',\s*'(\d+)'/
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

        const tempPath =
            'C:/FusionData/etl/temp';

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
            5
        );

        console.log('');
        console.log('====================================');
        console.log('ARQUIVO PROCESSADO');
        console.log('====================================');

        console.log(targetFile);

        log('Download concluído: MULTIPORTAL_DISPOSITIVOS.xls');

        await uploadToBackend(targetFile, 'MULTIPORTAL_DEVICE');

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
