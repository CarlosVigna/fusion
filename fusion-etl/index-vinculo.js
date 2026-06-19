require('dotenv').config();

const { chromium } = require('playwright');
const { loginMultiportal, waitForFrame } = require('./multiportal-auth');

async function run() {

    const browser = await chromium.launch({
        headless: false,
        slowMo: 500
    });

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

        const targetFile =
            'C:/FusionData/imports/pending/MULTIPORTAL_DISPOSITIVO_VINCULO.xls';

        await download.saveAs(
            targetFile
        );

        console.log('');
        console.log('====================================');
        console.log('ARQUIVO SALVO');
        console.log('====================================');

        console.log(targetFile);

    } catch (error) {

        console.error('');
        console.error('====================================');
        console.error('ERRO');
        console.error('====================================');
        console.error(error);

        await browser.close();

        throw error;
    }

    await browser.close();

}

module.exports = { run };

if (require.main === module) {
    run();
}
