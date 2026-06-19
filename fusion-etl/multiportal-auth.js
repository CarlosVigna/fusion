const { chromium } = require('playwright');

async function launchBrowser() {

    return chromium.launch({
        headless: process.env.ETL_HEADLESS !== 'false',
        slowMo: 500,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

}

async function loginMultiportal(page) {

    const url =
        process.env.MULTIPORTAL_URL
        || 'https://usebens.1gps.com.br/apps/login.seam';

    await page.goto(
        url,
        { waitUntil: 'domcontentloaded' }
    );

    await page.locator('#myForm\\:username')
        .fill(process.env.MULTIPORTAL_USER);

    await page.locator('#myForm\\:password')
        .fill(process.env.MULTIPORTAL_PASSWORD);

    await page.locator('#myForm\\:loginBtn')
        .click();

    await waitForFrame(
        page,
        '/system/layout/menu.seam'
    );

}

async function waitForFrame(
    page,
    urlSubstring,
    timeout = 15000
) {

    const start = Date.now();

    while (Date.now() - start < timeout) {

        const frame = page.frames().find(f =>
            f.url().includes(urlSubstring)
        );

        if (frame) {
            return frame;
        }

        await page.waitForTimeout(200);

    }

    throw new Error(
        `Frame contendo "${urlSubstring}" não encontrado após ${timeout}ms.`
    );

}

module.exports = {
    launchBrowser,
    loginMultiportal,
    waitForFrame
};
