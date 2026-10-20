import { expect, test } from '@playwright/test';
import { demoModelInfo } from '../src/config/indicator';
import { copies } from '../src/i18n';
import { expectNoOverflow, fillExample, mockModel } from './helpers';

test.beforeEach(async ({ page }) => mockModel(page));

test('known v2 model details are localized and never attributed to demo or an unknown version', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
  let metadata = { ...demoModelInfo, modelVersion: 'MedPredict-SBP-mlp-v2',
    predictionType: 'estimated_current_measurement', demo: false };
  await page.route('**/api/v1/model/info', (route) => route.fulfill({ json: metadata }));
  await page.goto('/#/model');
  await expect(page).toHaveURL(`${testInfo.project.use.baseURL}/#/model`);
  await expect(page).toHaveTitle(copies.ru.pageTitle);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  for (const language of ['ru', 'kk', 'en'] as const) {
    if (language !== 'ru') {
      await page.locator('.language-picker summary').click();
      await page.getByRole('button', { name: language === 'kk' ? 'Қазақша' : 'English', exact: true }).click();
    }
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(copies[language].pages.model);
    await expect(page.locator('.model-details dd')).toHaveText(copies[language].pages.sbpV2Rows.map((row) => row[1]!));
    await expectNoOverflow(page);
    await page.screenshot({ path: `/private/tmp/medpredict-model-details-${testInfo.project.name}-${language}.png`, fullPage: true });
  }
  metadata = { ...metadata, demo: true };
  await page.reload();
  await expect(page.locator('.mode-label')).toHaveText(copies.ru.serverDemo);
  await expect(page.locator('.page-intro')).toContainText(copies.ru.pages.modelIntro);
  await expect(page.locator('.model-details')).not.toContainText('NHANES');
  metadata = { ...metadata, demo: false, modelVersion: 'another-model-v2' };
  await page.reload();
  await expect(page.locator('.page-intro')).toContainText(copies.ru.pages.modelIntro);
  await expect(page.locator('.model-details')).not.toContainText('NHANES');
  await expect(page.locator('.model-details')).not.toContainText('Ridge');
  expect(errors).toEqual([]);
});

test('typed real adapter sends the exact payload, guards rapid submission and preserves precision', async ({ page }) => {
  let count = 0;
  await page.route('**/api/v1/predictions', async (route) => {
    count++;
    expect(route.request().postDataJSON()).toEqual({ age: 52, sex: 'male', bmi: 27.4, totalCholesterol: 5.6, glucose: 5.9 });
    await new Promise((resolve) => setTimeout(resolve, 200));
    await route.fulfill({ json: { predictedValue: 134.23456, unit: 'мм рт. ст.', modelVersion: '1.0.0', disclaimer: 'Ограничение сервера.' } });
  });
  await page.goto('/#/predict');
  await expect(page.getByText('Подключение к API', { exact: true })).toBeVisible();
  await fillExample(page);
  await page.locator('form').evaluate((form: HTMLFormElement) => { form.requestSubmit(); form.requestSubmit(); form.requestSubmit(); });
  await expect(page.getByText('134,23456', { exact: true })).toBeVisible();
  expect(count).toBe(1);
  await expect(page.getByText('Версия модели: 1.0.0')).toBeVisible();
  await expect(page.getByText('Ограничение сервера.')).toBeVisible();
  await expect(page.getByText('Фиксированный демонстрационный пример')).toHaveCount(0);
  await expectNoOverflow(page);
});

test('server field validation preserves input and allows corrected retry', async ({ page }) => {
  let count = 0;
  await page.route('**/api/v1/predictions', (route) => {
    count++;
    return route.fulfill(count === 1 ? { status: 400, json: { error: 'VALIDATION_ERROR', fields: [{ field: 'age', message: 'Возраст должен быть от 18 до 90 лет' }] } }
      : { json: { predictedValue: 135.5, unit: 'мм рт. ст.' } });
  });
  await page.goto('/#/predict');
  await fillExample(page);
  await page.getByRole('button', { name: 'Получить учебную оценку' }).click();
  await expect(page.getByText('Возраст должен быть от 18 до 90 лет', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Возраст')).toBeFocused();
  await expect(page.getByLabel('Глюкоза')).toHaveValue('5,9');
  await page.getByLabel('Возраст').fill('53');
  await page.getByRole('button', { name: 'Получить учебную оценку' }).click();
  await expect(page.getByText('135,5', { exact: true })).toBeVisible();
});

for (const kind of ['network', 'server', 'unknown', 'malformed', 'unit', 'timeout'] as const) {
  test(`${kind} failure shows a general error and never falls back to demo`, async ({ page }) => {
    await page.route('**/api/v1/predictions', async (route) => {
      if (kind === 'network') return route.abort('failed');
      if (kind === 'server') return route.fulfill({ status: 503, body: 'Unavailable' });
      if (kind === 'unknown') return route.fulfill({ status: 400, json: { error: 'VALIDATION_ERROR', fields: [{ field: 'missing_field', message: 'Server error' }] } });
      if (kind === 'timeout') return;
      if (kind === 'unit') return route.fulfill({ json: { predictedValue: 134.2, unit: 'wrong unit' } });
      return route.fulfill({ json: { predictedValue: '134.2', unit: 'мм рт. ст.' } });
    });
    await page.goto('/#/predict');
    await fillExample(page);
    await page.getByRole('button', { name: 'Получить учебную оценку' }).click();
    await expect(page.getByRole('heading', { name: 'Оценка не получена' })).toBeVisible();
    const messages = {
      network: 'Не удалось связаться с сервером.', server: 'Сервис временно недоступен.',
      unknown: 'Сервер сообщил об ошибке неизвестного поля.', malformed: 'Сервер вернул неожиданный ответ.',
      unit: 'Сервер вернул неожиданный ответ.', timeout: 'Сервер не ответил вовремя.',
    };
    await expect(page.locator('.result-content')).toContainText(messages[kind]);
    await expect(page.getByLabel('Индекс массы тела')).toHaveValue('27,4');
    await expect(page.getByRole('button', { name: 'Повторить запрос' })).toBeEnabled();
    await expect(page.getByText('134,2', { exact: true })).toHaveCount(0);
    await expectNoOverflow(page);
  });
}

test('metadata failure blocks form and can be retried', async ({ page }) => {
  let available = false;
  await page.route('**/api/v1/model/info', (route) => {
    return route.fulfill(available ? { json: demoModelInfo } : { json: { incomplete: true } });
  });
  await page.goto('/#/predict');
  await expect(page.getByRole('heading', { name: 'Не удалось загрузить описание модели' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Получить учебную оценку' })).toHaveCount(0);
  available = true;
  await page.getByRole('button', { name: 'Попробовать снова' }).click();
  await expect(page.getByLabel('Возраст')).toBeVisible();
});

test('MODEL_UNAVAILABLE explains the missing server model and blocks prediction', async ({ page }) => {
  let posts = 0;
  await page.route('**/api/v1/model/info', (route) => route.fulfill({ status: 503,
    json: { error: 'MODEL_UNAVAILABLE', message: 'Unavailable model' } }));
  await page.route('**/api/v1/predictions', () => { posts++; });
  await page.goto('/#/predict');
  await expect(page.getByRole('alert')).toContainText('Модель на сервере недоступна.');
  await expect(page.getByRole('button', { name: 'Получить учебную оценку' })).toHaveCount(0);
  await page.locator('.language-picker summary').click();
  await page.getByRole('button', { name: 'Қазақша', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Сервердегі модель қолжетімсіз.');
  expect(posts).toBe(0);
});

test('server demo is labelled while preserving HTTP privacy and server units', async ({ page }) => {
  await page.route('**/api/v1/model/info', (route) => route.fulfill({ json: demoModelInfo }));
  await page.route('**/api/v1/predictions', (route) => route.fulfill({ json: {
    predictedValue: 134.2, unit: 'мм рт. ст.', modelVersion: 'demo-example', disclaimer: 'DEMO: fixed server example.',
  } }));
  await page.goto('/#/predict');
  await expect(page.getByText('API · серверное демо', { exact: true })).toBeVisible();
  await expect(page.locator('.contract-note')).toContainText('обученная модель не используется');
  await fillExample(page);
  await page.getByRole('button', { name: 'Получить учебную оценку' }).click();
  await expect(page.getByText('Фиксированный демонстрационный пример', { exact: true })).toBeVisible();
  await expect(page.getByText('Версия демопримера: demo-example')).toBeVisible();
  await expect(page.locator('.privacy')).toHaveText('Данные отправляются серверу для оценки.');
  await expect(page.locator('.server-disclaimer')).toContainText('DEMO: fixed server example.');
  await expectNoOverflow(page);
});

test('selected UI language reaches the backend without clearing the form', async ({ page }) => {
  await page.goto('/#/predict');
  await fillExample(page);
  await page.locator('.language-picker summary').click();
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.route('**/api/v1/predictions', (route) => {
    expect(route.request().headers()['accept-language']).toBe('en');
    return route.fulfill({ status: 400, json: { error: 'VALIDATION_ERROR',
      fields: [{ field: 'age', message: 'A number is required' }] } });
  });
  await page.getByRole('button', { name: 'Get an educational estimate', exact: true }).click();
  await expect(page.getByText('A number is required', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Возраст')).toHaveValue('52');
  await expect(page.getByLabel('Возраст')).toBeFocused();
});

test('only server-supplied ranges and changed field configuration are used', async ({ page }) => {
  const fields = [{ key: 'measurement', label: 'Новый показатель', type: 'number', unit: 'ед.', required: true, min: 2, max: 10 }];
  await page.route('**/api/v1/model/info', (route) => route.fulfill({ json: {
    indicatorName: 'Другой прогноз', unit: 'ед.', decimalPlaces: 2, fields,
  } }));
  await page.route('**/api/v1/predictions', (route) => {
    expect(route.request().postDataJSON()).toEqual({ measurement: 2.5 });
    return route.fulfill({ json: { predictedValue: 3, unit: 'ед.' } });
  });
  await page.goto('/#/predict');
  await page.getByLabel('Новый показатель').fill('1');
  await page.getByRole('button', { name: 'Получить учебную оценку' }).click();
  await expect(page.getByText('Значение должно быть не меньше 2.', { exact: true })).toBeVisible();
  await page.getByLabel('Новый показатель').fill('2,5');
  await page.getByRole('button', { name: 'Получить учебную оценку' }).click();
  await expect(page.getByRole('heading', { name: 'Другой прогноз', exact: true })).toBeVisible();
  await expect(page.getByText('3,00', { exact: true })).toBeVisible();
});

test('real PDF exports the existing response without another prediction or demo fallback', async ({ page }, testInfo) => {
  let requests = 0;
  await page.addInitScript(() => { window.print = () => { throw new Error('Printing must not be called'); }; });
  await page.route('**/api/v1/predictions', (route) => {
    requests++;
    return route.fulfill({ json: { predictedValue: 141.98765, unit: 'мм рт. ст.' } });
  });
  await page.goto('/#/predict');
  await fillExample(page);
  await page.getByRole('button', { name: 'Получить учебную оценку' }).click();
  await expect(page.getByText('141,98765', { exact: true })).toBeVisible();
  for (let index = 0; index < 2; index++) {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Скачать PDF', exact: true }).click();
    const download = await pending;
    await download.saveAs(testInfo.outputPath(`report-real-${index}.pdf`));
    expect(await download.failure()).toBeNull();
  }
  expect(requests).toBe(1);
  await expect(page.locator('.model-version')).toHaveCount(0);
  await page.getByLabel('Возраст').fill('53');
  await expect(page.getByRole('button', { name: 'Скачать PDF', exact: true })).toHaveCount(0);
});

test('trained current estimate keeps localized safety, server units, accessible focus and PDF without retaining inputs', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
  const trained = { ...demoModelInfo, demo: false, predictionType: 'estimated_current_measurement',
    modelVersion: 'MedPredict-SBP-v1', indicatorName: 'Оценка текущего систолического давления',
    fields: demoModelInfo.fields.map((field) => field.key === 'glucose'
      ? { ...field, label: 'Глюкоза плазмы натощак', hint: 'Натощак, ммоль/л' } : field),
  };
  await page.route('**/api/v1/model/info', (route) => route.fulfill({ json: trained }));
  let posts = 0;
  await page.route('**/api/v1/predictions', (route) => {
    posts++;
    expect(route.request().postDataJSON()).toEqual({ age: 52, sex: 'male', bmi: 27.4, totalCholesterol: 5.6, glucose: 5.9 });
    return route.fulfill({ json: { predictedValue: 126.7, unit: trained.unit,
      demo: false, predictionType: trained.predictionType, modelVersion: trained.modelVersion } });
  });
  await page.goto('/#/predict');
  await expect(page).toHaveURL('http://127.0.0.1:4174/#/predict');
  await expect(page).toHaveTitle(copies.ru.pageTitle);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await expect(page.locator('.mode-label')).toHaveText(copies.ru.estimateMode);
  await expect(page.getByLabel('Глюкоза плазмы натощак')).toBeVisible();
  await fillExample(page);
  await page.getByRole('button', { name: copies.ru.submit, exact: true }).click();
  await expect(page.getByRole('heading', { name: trained.indicatorName, exact: true })).toBeFocused();
  for (const language of ['ru', 'kk', 'en'] as const) {
    const copy = copies[language];
    if (language !== 'ru') {
      await page.locator('.language-picker summary').click();
      await page.getByRole('button', { name: language === 'kk' ? 'Қазақша' : 'English', exact: true }).click();
    }
    await expect(page.locator('.result-tag')).toHaveText(copy.estimateResult);
    await expect(page.locator('.demo-explanation')).toHaveText(copy.estimateExplanation);
    await expect(page.locator('.result-disclaimer')).toHaveText(copy.estimateDisclaimer);
    await expect(page.locator('.prediction-unit')).toHaveText(trained.unit);
    await expect(page.locator('.model-version')).toHaveText(`${copy.modelVersion}: ${trained.modelVersion}`);
    await expect(page.locator('.privacy')).toHaveText(copy.realPrivacy);
    await expectNoOverflow(page);
  }
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: copies.en.downloadPdf, exact: true }).click();
  const pdf = await pending;
  await pdf.saveAs(testInfo.outputPath('trained-estimate.pdf'));
  expect(await pdf.failure()).toBeNull();
  expect(posts).toBe(1);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
  await page.locator('.result-panel').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `/private/tmp/medpredict-trained-${testInfo.project.name}.png` });
  await page.getByLabel('Возраст').fill('53');
  await expect(page.getByRole('button', { name: copies.en.downloadPdf, exact: true })).toHaveCount(0);
});

test('explicit demo marker labels a server example independently of its version', async ({ page }) => {
  await page.route('**/api/v1/model/info', (route) => route.fulfill({ json: {
    ...demoModelInfo, modelVersion: 'server-demo-v2', demo: true,
  } }));
  await page.route('**/api/v1/predictions', (route) => route.fulfill({ json: {
    predictedValue: 134.2, unit: demoModelInfo.unit, modelVersion: 'server-demo-v2', demo: true,
    predictionType: 'estimated_current_measurement',
  } }));
  await page.goto('/#/predict');
  await expect(page.locator('.mode-label')).toHaveText(copies.ru.serverDemo);
  await fillExample(page);
  await page.getByRole('button', { name: copies.ru.submit, exact: true }).click();
  await expect(page.locator('.result-tag')).toHaveText(copies.ru.demoResult);
  await expect(page.locator('.model-version')).toHaveText(`${copies.ru.demoVersion}: server-demo-v2`);
  await expect(page.getByText(copies.ru.estimateExplanation, { exact: true })).toHaveCount(0);
});
