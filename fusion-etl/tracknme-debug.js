require('dotenv').config();

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
        console.log('TRACKNME DEBUG');
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
        ).click();

        await page.locator(
            'input[name="email"]'
        ).fill(
            process.env.TRACKNME_USER
        );

        console.log('Email preenchido.');

        await page.locator(
            'input[name="password"]'
        ).click();

        await page.locator(
            'input[name="password"]'
        ).fill(
            process.env.TRACKNME_PASSWORD
        );

        console.log('Senha preenchida.');

        await page.waitForTimeout(2000);

        await page.screenshot({
            path: 'tracknme-login.png',
            fullPage: true
        });

        console.log('Screenshot salvo.');

        await page.locator(
            'button[type="submit"]'
        ).click();

        console.log('Botão Login clicado.');

        await page.waitForTimeout(10000);

        console.log('');
        console.log('====================================');
        console.log('URL ATUAL');
        console.log('====================================');
        console.log(page.url());

        await page.screenshot({
            path: 'tracknme-pos-login.png',
            fullPage: true
        });

        console.log('');
        console.log('Screenshot pós-login salvo.');

        await page.waitForTimeout(60000);

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