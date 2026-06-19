require('dotenv').config();

const { chromium } = require('playwright');

(async () => {

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

        await page.goto(
            'https://usebens.1gps.com.br/apps/login.seam',
            { waitUntil: 'domcontentloaded' }
        );

        await page.locator('#myForm\\:username')
            .fill(process.env.MULTIPORTAL_USER);

        await page.locator('#myForm\\:password')
            .fill(process.env.MULTIPORTAL_PASSWORD);

        await page.locator('#myForm\\:loginBtn')
            .click();

        await page.waitForTimeout(5000);

        console.log('Login realizado.');

        // MENU

        const menuFrame = page.frames().find(frame =>
            frame.url().includes('/system/layout/menu.seam')
        );

        if (!menuFrame) {
            throw new Error(
                'Frame menu.seam não encontrado.'
            );
        }

        console.log('Abrindo Cadastros Gerais...');

        await menuFrame.locator(
            'table[onclick="openMenu(36)"]'
        ).click();

        await page.waitForTimeout(3000);

        console.log('Abrindo Dispositivo Vinculo...');

        await menuFrame.locator(
            'tr[id="/system/businesspartner/dispositivovinculoList.seam"]'
        ).click();

        await page.waitForTimeout(5000);

        // FRAME

        const vinculoFrame = page.frames().find(frame =>
            frame.url().includes(
                '/system/businesspartner/dispositivovinculoList.seam'
            )
        );

        if (!vinculoFrame) {
            throw new Error(
                'Frame dispositivovinculoList.seam não encontrado.'
            );
        }

        console.log('Frame encontrado.');

        // PESQUISAR

        console.log('Pesquisando...');

        await vinculoFrame.locator(
            '#DispositivovinculoDataList\\:table_list_command > table > tbody > tr > td:nth-child(2) > table > tbody > tr > td:nth-child(5) > table > tbody > tr > td:nth-child(2)'
        ).click();

        await page.waitForTimeout(5000);

        console.log('Pesquisa executada.');

        // DOWNLOAD

        console.log('Solicitando Excel...');

        const downloadPromise =
            page.waitForEvent('download');

        await vinculoFrame.locator(
            '#DispositivovinculoDataList\\:table_list_command > table > tbody > tr > td:nth-child(2) > table > tbody > tr > td:nth-child(7) > table > tbody > tr > td > a'
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

        await page.waitForTimeout(5000);

    } catch (error) {

        console.error('');
        console.error('====================================');
        console.error('ERRO');
        console.error('====================================');
        console.error(error);

        await page.waitForTimeout(30000);
    }

    await browser.close();

})();