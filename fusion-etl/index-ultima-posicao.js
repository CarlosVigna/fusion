require('dotenv').config();

const fs = require('fs');
const path = require('path');
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

const TEMP_DIR =
    process.env.ETL_TEMP_DIR
    || path.join(DOWNLOADS_DIR, 'temp');

async function run() {

    log('Scraper última posição iniciado');

    const browser = await launchBrowser();

    const context = await browser.newContext({
        acceptDownloads: true
    });

    const page = await context.newPage();

    try {

        console.log('====================================');
        console.log('FUSION ETL - ULTIMA POSICAO');
        console.log('====================================');

        // LOGIN

        await loginMultiportal(page);

        console.log('Login realizado.');

        // MENU

        const menuFrame = await waitForFrame(
            page,
            '/system/layout/menu.seam'
        );

        console.log('Abrindo Rastreamentos...');

        await menuFrame.locator(
            'table[onclick="openMenu(1)"]'
        ).click();

        await menuFrame.locator(
            'tr[id="/system/track/lastPositionCarSave.seam"]'
        ).waitFor({ state: 'visible' });

        console.log('Abrindo Ultima Posicao...');

        await menuFrame.locator(
            'tr[id="/system/track/lastPositionCarSave.seam"]'
        ).click();

        // FRAME

        const ultimaPosicaoFrame = await waitForFrame(
            page,
            '/system/track/lastPositionCarSave.seam'
        );

        console.log('Frame encontrado.');

        // PESQUISA

        console.log('Pesquisando...');

        await ultimaPosicaoFrame
            .locator('#LastPositionCompDataList\\:buttonFindHidden')
            .click({ force: true });

        await ultimaPosicaoFrame.getByText(
            'Excel',
            { exact: true }
        ).waitFor({ state: 'visible' });

        console.log('Pesquisa executada.');

        // CONFIRMACAO EXCEL

        page.once('dialog', async dialog => {

            console.log('');
            console.log('DIALOG ENCONTRADO');
            console.log(dialog.message());

            await dialog.accept();

            console.log('DIALOG ACEITO');
        });

        console.log('Solicitando Excel...');

        const downloadPromise =
            page.waitForEvent('download');

        await ultimaPosicaoFrame.getByText(
            'Excel',
            { exact: true }
        ).click();

        const download =
            await downloadPromise;

        console.log('');
        console.log('====================================');
        console.log('DOWNLOAD CAPTURADO');
        console.log('====================================');

        console.log(
            download.suggestedFilename()
        );

        await fse.ensureDir(DOWNLOADS_DIR);

        const zipFile =
            path.join(DOWNLOADS_DIR, 'ultima_posicao.zip');

        await download.saveAs(zipFile);

        console.log('');
        console.log('ZIP salvo:');
        console.log(zipFile);

        // LIMPA TEMP

        const tempPath = TEMP_DIR;

        await fse.emptyDir(tempPath);

        // EXTRAI

        console.log('');
        console.log('====================================');
        console.log('EXTRAINDO ZIP');
        console.log('====================================');

        const zip =
            new AdmZip(zipFile);

        zip.extractAllTo(
            tempPath,
            true
        );

        console.log('ZIP extraído.');

        const files =
            fs.readdirSync(tempPath);

        console.log('');
        console.log('ARQUIVOS ENCONTRADOS:');

        files.forEach(file => {
            console.log('-', file);
        });

        const xlsFile =
            files.find(file =>
                file.toLowerCase().endsWith('.xls')
            );

        if (!xlsFile) {
            throw new Error(
                'Nenhum XLS encontrado dentro do ZIP.'
            );
        }

        const sourceFile =
            path.join(
                tempPath,
                xlsFile
            );

        const targetFile =
            path.join(OUTPUT_DIR, 'MULTIPORTAL_ULTIMA_POSICAO.xls');

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

        log('Download concluído: MULTIPORTAL_ULTIMA_POSICAO.xls');

        await uploadToBackend(targetFile, 'MULTIPORTAL_ULTIMA_POSICAO');

    } catch (error) {

        console.error('');
        console.error('====================================');
        console.error('ERRO');
        console.error('====================================');
        console.error(error);

        log(`Erro no scraper última posição: ${error.message}`);

        await browser.close();

        throw error;
    }

    await browser.close();

}

module.exports = { run };

if (require.main === module) {
    run();
}