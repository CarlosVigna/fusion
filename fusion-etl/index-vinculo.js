require('dotenv').config();

const path = require('path');
const fse = require('fs-extra');
const { launchBrowser, loginMultiportal, waitForFrame } = require('./multiportal-auth');
const { moveToBackupWithRotation, log } = require('./src/file-utils');

const DOWNLOADS_DIR =
    process.env.ETL_DOWNLOADS_DIR
    || 'C:/FusionData/etl/downloads';

const OUTPUT_DIR =
    process.env.ETL_OUTPUT_DIR
    || 'C:/FusionData/imports/pending';

async function run() {

    log('Scraper vínculo iniciado');

    const browser = await launchBrowser();

    const context = await browser.newContext({
        acceptDownloads: true
    });

    const page = await context.newPage();

    try {

        console.log('====================================');
        console.log('FUSION ETL - DISPOSITIVO VINCULO');
        console.log('====================================');

        // LOGIN

        await loginMultiportal(page);

        console.log('Login realizado.');

        // MENU

        const menuFrame = await waitForFrame(
            page,
            '/system/layout/menu.seam'
        );

        console.log('Abrindo Cadastros Gerais...');

        await menuFrame.locator(
            'table[onclick="openMenu(36)"]'
        ).click();

        await menuFrame.locator(
            'tr[id="/system/businesspartner/dispositivovinculoList.seam"]'
        ).waitFor({ state: 'visible' });

        console.log('Abrindo Dispositivo Vinculo...');

        await menuFrame.locator(
            'tr[id="/system/businesspartner/dispositivovinculoList.seam"]'
        ).click();

        // FRAME

        const vinculoFrame = await waitForFrame(
            page,
            '/system/businesspartner/dispositivovinculoList.seam'
        );

        console.log('Frame encontrado.');

        // PESQUISAR

        console.log('Pesquisando...');

        const searchButton = vinculoFrame.locator(
            '#DispositivovinculoDataList\\:table_list_command > table > tbody > tr > td:nth-child(2) > table > tbody > tr > td:nth-child(5) > table > tbody > tr > td:nth-child(2)'
        );

        await searchButton.waitFor({ state: 'visible' });

        await searchButton.click();

        const downloadLink = vinculoFrame.locator(
            '#DispositivovinculoDataList\\:table_list_command > table > tbody > tr > td:nth-child(2) > table > tbody > tr > td:nth-child(7) > table > tbody > tr > td > a'
        );

        await downloadLink.waitFor({ state: 'visible' });

        console.log('Pesquisa executada.');

        // DOWNLOAD

        console.log('Solicitando Excel...');

        const downloadPromise =
            page.waitForEvent('download');

        await downloadLink.click();

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

        const downloadedFile =
            path.join(DOWNLOADS_DIR, 'dispositivo_vinculo.xls');

        await download.saveAs(
            downloadedFile
        );

        const targetFile =
            path.join(OUTPUT_DIR, 'MULTIPORTAL_DISPOSITIVO_VINCULO.xls');

        await fse.ensureDir(OUTPUT_DIR);

        await fse.copy(
            downloadedFile,
            targetFile,
            { overwrite: true }
        );

        await moveToBackupWithRotation(
            downloadedFile,
            path.join(DOWNLOADS_DIR, 'history'),
            5
        );

        console.log('');
        console.log('====================================');
        console.log('ARQUIVO SALVO');
        console.log('====================================');

        console.log(targetFile);

        log('Download concluído: MULTIPORTAL_DISPOSITIVO_VINCULO.xls');

    } catch (error) {

        console.error('');
        console.error('====================================');
        console.error('ERRO');
        console.error('====================================');
        console.error(error);

        log(`Erro no scraper vínculo: ${error.message}`);

        await browser.close();

        throw error;
    }

    await browser.close();

}

module.exports = { run };

if (require.main === module) {
    run();
}
