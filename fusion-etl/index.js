require('dotenv').config();

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { chromium } = require('playwright');
const AdmZip = require('adm-zip');
const fse = require('fs-extra');

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

(async () => {

    const browser = await chromium.launch({
        headless: false,
        slowMo: 500
    });

    const context = await browser.newContext();

    const page = await context.newPage();

    try {

        console.log('====================================');
        console.log('FUSION ETL - MULTIPORTAL');
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

        await menuFrame.locator(
            'table[onclick="openMenu(36)"]'
        ).click();

        await page.waitForTimeout(2000);

        await menuFrame.locator(
            'tr[id="/system/gateway/devicesList.seam"]'
        ).click();

        await page.waitForTimeout(5000);

        // DISPOSITIVOS

        const devicesFrame = page.frames().find(frame =>
            frame.url().includes('/system/gateway/devicesList.seam')
        );

        await devicesFrame.locator(
            'table[onclick="find()"]'
        ).click();

        console.log('Pesquisa executada.');

        await page.waitForTimeout(5000);

        await devicesFrame.getByText('Excel')
            .click();

        console.log('Excel solicitado.');

        // IMPRESSÃO

        const topFrame = page.frames().find(frame =>
            frame.url().includes('/system/layout/top.seam')
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

        await page.waitForTimeout(5000);

        const impressaoFrame = page.frames().find(frame =>
            frame.url().includes('/system/security/impressaoList.seam')
        );

        if (!impressaoFrame) {
            throw new Error(
                'Frame impressaoList.seam não encontrado.'
            );
        }

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

        const destination =
            'C:/FusionData/etl/downloads/cadastro_dispositivos_excel.zip';

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

        await fse.ensureDir(tempPath);

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
            'C:/FusionData/imports/pending/MULTIPORTAL_DISPOSITIVOS.xls';

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

        await page.waitForTimeout(5000);

    } catch (error) {

        console.error('');
        console.error('====================================');
        console.error('ERRO');
        console.error('====================================');
        console.error(error);

        await page.waitForTimeout(30000);
    }

})();