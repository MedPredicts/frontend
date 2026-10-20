import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';
import integration from './playwright.integration.config';

// Requires Spring Boot with the onnx profile and the trained artifact directory.
export default defineConfig({
  ...integration,
  testMatch: /backend-model.integration.spec.ts/,
  outputDir: join(tmpdir(), 'medpredict-model-integration-results'),
  use: { ...integration.use, baseURL: 'http://127.0.0.1:5175' },
  webServer: {
    command: 'npm run dev -- --port 5175 --strictPort',
    url: 'http://127.0.0.1:5175',
    reuseExistingServer: false,
    env: { VITE_API_MODE: 'real', VITE_API_BASE_URL: '',
      API_PROXY_TARGET: process.env.API_PROXY_TARGET || 'http://127.0.0.1:8081' },
  },
});
