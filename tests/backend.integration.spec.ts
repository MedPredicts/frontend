import { expect, test } from '@playwright/test';
import { expectNoOverflow, fillExample } from './helpers';

test('Spring Boot metadata → form → HTTP prediction → labelled result → PDF', async ({ page, request }, testInfo) => {
  const metadata = await request.get('/api/v1/model/info');
  expect(metadata.status(), 'Start Spring Boot on 8080 with -Dspring-boot.run.profiles=demo').toBe(200);
  expect(metadata.headers()['cache-control']).toContain('no-store');
  expect((await metadata.json()).modelVersion).toBe('demo-example');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
  let predictions = 0;
  page.on('request', (req) => { if (req.method() === 'POST' && req.url().endsWith('/api/v1/predictions')) predictions++; });
  await page.goto('/');
  await expect(page).toHaveURL(new URL('/', testInfo.project.use.baseURL).href);
  await expect(page).toHaveTitle('MedPredict — учебная оценка');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await expect(page.getByText('API · серверное демо', { exact: true })).toBeVisible();
  await fillExample(page);
  const response = page.waitForResponse((res) => res.request().method() === 'POST' && res.url().endsWith('/api/v1/predictions'));
  await page.getByRole('button', { name: 'Получить учебную оценку' }).click();
  expect((await response).status()).toBe(200);
  await expect(page.getByText('134,2', { exact: true })).toBeVisible();
  await expect(page.getByText('Фиксированный демонстрационный пример', { exact: true })).toBeVisible();
  await expect(page.locator('.server-disclaimer')).toContainText('DEMO:');
  await expectNoOverflow(page);
  await page.locator('.result-panel').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('server-demo.png') });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Скачать PDF', exact: true }).click();
  const pdf = await download;
  await pdf.saveAs(testInfo.outputPath('server-demo.pdf'));
  expect(await pdf.failure()).toBeNull();
  expect(predictions).toBe(1);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
  await page.getByLabel('Возраст').fill('53');
  await expect(page.getByText('134,2', { exact: true })).toHaveCount(0);
});

test('Spring Boot validation is localized and linked to the field, then retry succeeds', async ({ page }) => {
  await page.goto('/');
  await fillExample(page);
  await page.locator('.language-picker summary').click();
  await page.getByRole('button', { name: 'English', exact: true }).click();
  // Deliberately malformed synthetic input exercises actual server validation, without mocking responses.
  await page.route('**/api/v1/predictions', (route) => route.continue({
    postData: JSON.stringify({ ...route.request().postDataJSON(), age: 'invalid' }),
  }));
  const response = page.waitForResponse((res) => res.url().endsWith('/api/v1/predictions'));
  await page.getByRole('button', { name: 'Get an educational estimate', exact: true }).click();
  const rejected = await response;
  expect(rejected.status()).toBe(400);
  const error = await rejected.json();
  expect(error.error).toBe('VALIDATION_ERROR');
  expect(rejected.request().headers()['accept-language']).toBe('en');
  await expect(page.locator('#field-age-error')).toHaveText(error.fields.find((field: { field: string }) => field.field === 'age').message);
  await expect(page.getByLabel('Возраст')).toBeFocused();
  await expect(page.getByLabel('Возраст')).toHaveValue('52');
  await page.unroute('**/api/v1/predictions');
  await page.getByRole('button', { name: 'Retry request', exact: true }).click();
  await expect(page.getByText('134.2', { exact: true })).toBeVisible();
});
