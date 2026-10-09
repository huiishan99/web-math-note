const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:8916';
    assert.equal((await page.request.get(`${base}/api/health`)).status(), 200);
    const status = await (await page.request.get(`${base}/api/calculate/status`)).json();
    assert.equal(status.configured, false, 'CI must not enable paid AI calls');
    await page.goto(base);
    await page.getByRole('button', { name: 'New page', exact: true }).waitFor();
    assert.ok(await page.locator('canvas').count());
    const pages = () => page.locator('nav button[aria-current="page"]');
    await page.getByRole('button', { name: 'New page', exact: true }).click();
    await page.getByRole('button', { name: 'New page', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('nav button[aria-current="page"]')?.textContent === '3');
    assert.equal((await pages().innerText()).trim(), '3');
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', { name: 'Delete page', exact: true }).click();
    assert.equal((await pages().innerText()).trim(), '3', 'Cancel preserves the page');
    page.once('dialog', dialog => dialog.accept('Security regression'));
    await page.getByRole('button', { name: 'Rename page', exact: true }).click();
    await page.getByRole('button', { name: 'Security regression', exact: true }).waitFor();
    await page.waitForTimeout(700);
    await page.reload();
    await page.getByRole('button', { name: 'Security regression', exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'New page', exact: true }).click();
    assert.equal((await pages().innerText()).trim(), '4');
    assert.deepEqual(errors, []);
    console.log('Browser smoke passed: API, router, canvas, repeated pages, cancel, rename, persistence, mobile viewport');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
