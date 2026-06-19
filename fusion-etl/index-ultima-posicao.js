require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const AdmZip = require('adm-zip');
const fse = require('fs-extra');

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
        console.log('FUSION ETL - ULTIMA POSICAO');
        console.log('====================================');

        // LOGIN

        await page.goto(
            'https://usebens.1gps.com.br/apps/login.seam',
            {
                waitUntil: 'domcontentloaded'
            }
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

        console.log('Abrindo Rastreamentos...');

        await menuFrame.locator(
            'table[onclick="openMenu(1)"]'
        ).click();

        await page.waitForTimeout(3000);

        console.log('Abrindo Ultima Posicao...');

        await menuFrame.locator(
            'tr[id="/system/track/lastPositionCarSave.seam"]'
        ).click();

        await page.waitForTimeout(5000);

        // FRAME

        const ultimaPosicaoFrame = page.frames().find(frame =>
            frame.url().includes(
                '/system/track/lastPositionCarSave.seam'
            )
        );

        if (!ultimaPosicaoFrame) {
            throw new Error(
                'Frame lastPositionCarSave.seam não encontrado.'
            );
        }

        console.log('Frame encontrado.');

        // PESQUISA

        console.log('Pesquisando...');

        await ultimaPosicaoFrame.evaluate(() => {
            document
                .getElementById(
                    'LastPositionCompDataList:buttonFindHidden'
                )
                .click();
        });

        await page.waitForTimeout(5000);

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

        const zipFile =
            'C:/FusionData/etl/downloads/ultima_posicao.zip';

        await download.saveAs(zipFile);

        console.log('');
        console.log('ZIP salvo:');
        console.log(zipFile);

        // LIMPA TEMP

        const tempPath =
            'C:/FusionData/etl/temp';

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
            'C:/FusionData/imports/pending/MULTIPORTAL_ULTIMA_POSICAO.xls';

        await fse.ensureDir(
            'C:/FusionData/imports/pending'
        );

        await fse.copy(
            sourceFile,
            targetFile,
            {
                overwrite: true
            }
        );

        console.log('');
        console.log('====================================');
        console.log('ARQUIVO PROCESSADO');
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