require('dotenv').config();

const fs = require('fs');
const { chromium } = require('playwright');

(async () => {

    const browser = await chromium.launch({
        headless: false,
        slowMo: 500
    });

    const context = await browser.newContext();

    const page = await context.newPage();

    try {

        console.log('====================================');
        console.log('TRACKNME RELATORIOS DEBUG');
        console.log('====================================');

        await page.goto(
            'https://www.tracknme.com.br/monitoring/login',
            {
                waitUntil: 'networkidle'
            }
        );

        console.log('Tela carregada.');

        await page.locator(
            'input[name="email"]'
        ).fill(
            process.env.TRACKNME_USER
        );

        await page.locator(
            'input[name="password"]'
        ).fill(
            process.env.TRACKNME_PASSWORD
        );

        console.log('Credenciais preenchidas.');

        await page.waitForTimeout(2000);

        await page.locator(
            'button[type="submit"]'
        ).click();

        console.log('Login realizado.');

        await page.waitForURL(
            '**/indicators',
            {
                timeout: 30000
            }
        );

        console.log('Tela indicadores carregada.');

        await page.goto(
            'https://www.tracknme.com.br/monitoring/reports',
            {
                waitUntil: 'networkidle'
            }
        );

        console.log('Tela relatórios carregada.');

        await page.waitForTimeout(5000);

        const html =
            await page.content();

        fs.writeFileSync(
            'tracknme-reports.html',
            html,
            'utf8'
        );

        console.log('');
        console.log('====================================');
        console.log('HTML SALVO');
        console.log('====================================');
        console.log('tracknme-reports.html');

        await page.screenshot({
            path: 'tracknme-reports.png',
            fullPage: true
        });

        console.log('');
        console.log('Screenshot salvo.');

        await page.waitForTimeout(
            60000
        );

    } catch (error) {

        console.error('');
        console.error('====================================');
        console.error('ERRO');
        console.error('====================================');
        console.error(error);

        await page.waitForTimeout(
            30000
        );
    }

    await browser.close();

})();