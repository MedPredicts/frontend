import { expect, test } from '@playwright/test';
import { copies } from '../src/i18n';
import { parseModelInfo, parsePrediction } from '../src/api/contract';
import { formatPrediction } from '../src/validation';
import { expectNoOverflow } from './helpers';

test('trained Spring Boot inference → current estimate → localized limitations → PDF', async ({ page, request }, testInfo) => {
  const health = await request.get('/api/v1/health/ready');
  expect(health.status(), 'Start Spring Boot on 8081 with the onnx profile and trained artifacts').toBe(200);
  const metadata = await request.get('/api/v1/model/info');
  expect(metadata.status()).toBe(200);
  const model = parseModelInfo(await metadata.json());
  expect(model.demo).toBe(false);
  expect(model.predictionType).toBe('estimated_current_measurement');
  expect(model.fields.map((field) => field.key)).toEqual(['age', 'sex', 'bmi', 'totalCholesterol', 'glucose']);
  expect(model.fields.find((field) => field.key === 'glucose')?.label).toMatch(/натощак/i);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
  let posts = 0;
  page.on('request', (req) => { if (req.method() === 'POST' && req.url().endsWith('/api/v1/predictions')) posts++; });
  await page.goto('/#/predict');
  await expect(page).toHaveURL('http://127.0.0.1:5175/#/predict');
  await expect(page).toHaveTitle(copies.ru.pageTitle);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await expect(page.locator('.mode-label')).toHaveText(copies.ru.estimateMode);
  for (const [key, value] of Object.entries({ age: '52', bmi: '27,4', totalCholesterol: '5.6', glucose: '5,9' })) {
    await page.locator(`#field-${key}`).fill(value);
  }
  await page.locator('#field-sex').selectOption('male');
  const pending = page.waitForResponse((res) => res.request().method() === 'POST' && res.url().endsWith('/api/v1/predictions'));
  await page.getByRole('button', { name: copies.ru.submit, exact: true }).click();
  const response = await pending;
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toContain('no-store');
  const result = parsePrediction(await response.json(), model.unit);
  expect(result.demo).toBe(false);
  expect(result.predictionType).toBe('estimated_current_measurement');
  expect(result.modelVersion).toBe(model.modelVersion);
  await expect(page.locator('.prediction-value > span').first()).toHaveText(formatPrediction(result.predictedValue, model.decimalPlaces, 'ru'));
  await expect(page.locator('.prediction-unit')).toHaveText(result.unit);
  await expect(page.locator('.result-tag')).toHaveText(copies.ru.estimateResult);
  await expect(page.locator('.demo-explanation')).toHaveText(copies.ru.estimateExplanation);
  if (result.disclaimer) await expect(page.locator('.server-disclaimer')).toHaveText(result.disclaimer);
  await expect(page.getByRole('heading', { name: model.indicatorName, exact: true })).toBeFocused();
  await page.locator('.language-picker summary').click();
  await page.getByRole('button', { name: 'Қазақша', exact: true }).click();
  await expect(page.locator('.result-tag')).toHaveText(copies.kk.estimateResult);
  await expect(page.locator('.result-disclaimer')).toContainText(copies.kk.estimateDisclaimer);
  const pendingDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: copies.kk.downloadPdf, exact: true }).click();
  const download = await pendingDownload;
  await download.saveAs(testInfo.outputPath('trained-model-kk.pdf'));
  expect(await download.failure()).toBeNull();
  expect(posts).toBe(1);
  await expectNoOverflow(page);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
  await page.locator('.result-panel').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `/private/tmp/medpredict-real-model-${testInfo.project.name}.png` });
  await page.locator('#field-age').fill('53');
  await expect(page.getByRole('button', { name: copies.kk.downloadPdf, exact: true })).toHaveCount(0);
});

test('trained backend rejects invalid synthetic input without a fabricated result and the form can retry', async ({ page }) => {
  await page.goto('/#/predict');
  for (const [key, value] of Object.entries({ age: '52', bmi: '27.4', totalCholesterol: '5.6', glucose: '5.9' })) {
    await page.locator(`#field-${key}`).fill(value);
  }
  await page.locator('#field-sex').selectOption('male');
  // Bypass client validation with a malformed synthetic payload to exercise the real server boundary.
  await page.route('**/api/v1/predictions', (route) => route.continue({
    postData: JSON.stringify({ ...route.request().postDataJSON(), age: -1 }),
  }));
  const pending = page.waitForResponse((res) => res.url().endsWith('/api/v1/predictions'));
  await page.getByRole('button', { name: copies.ru.submit, exact: true }).click();
  const response = await pending;
  expect(response.status()).toBe(400);
  const error = await response.json();
  expect(error.error).toBe('VALIDATION_ERROR');
  expect(error.predictedValue).toBeUndefined();
  await expect(page.locator('#field-age')).toBeFocused();
  await expect(page.locator('#field-age')).toHaveValue('52');
  await expect(page.locator('#field-age-error')).toHaveText(error.fields.find((field: { field: string }) => field.field === 'age').message);
  await expect(page.locator('.prediction-value')).toHaveCount(0);
  await page.unroute('**/api/v1/predictions');
  await page.getByRole('button', { name: copies.ru.retrySubmit, exact: true }).click();
  await expect(page.locator('.prediction-value')).toBeVisible();
});
