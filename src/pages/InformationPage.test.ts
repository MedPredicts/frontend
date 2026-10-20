import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { copies } from '../i18n';
import { demoModelInfo } from '../config/indicator';
import type { ModelInfo } from '../types';
import { InformationPage } from './InformationPage';

const model: ModelInfo = { ...demoModelInfo, modelVersion: 'MedPredict-SBP-mlp-v2',
  predictionType: 'estimated_current_measurement', demo: false };

describe('model information', () => {
  it.each(['ru', 'kk', 'en'] as const)('shows researched v2 facts only for the exact non-demo model in %s', (language) => {
    const copy = copies[language];
    const html = renderToStaticMarkup(createElement(InformationPage, { route: '/model', copy, model }));
    for (const [label, value] of copy.pages.sbpV2Rows) {
      expect(html).toContain(label);
      expect(html).toContain(value);
    }
    expect(html).not.toContain(copy.pages.modelIntro);
    for (const unverified of [undefined, { ...model, demo: true }, { ...model, demo: undefined },
      { ...model, modelVersion: 'another-model-v2' }, { ...model, predictionType: undefined }]) {
      const pending = renderToStaticMarkup(createElement(InformationPage, { route: '/model', copy, model: unverified }));
      expect(pending).toContain(copy.pages.modelIntro);
      expect(pending).not.toContain('NHANES');
      expect(pending).not.toContain('Ridge');
    }
  });
});
