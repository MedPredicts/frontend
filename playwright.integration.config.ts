import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';

// Requires the actual Spring Boot server with its explicit demo profile on 8080.
export default defineConfig({
  testDir: './tests',
  testMatch: /backend.integration.spec.ts/,
  outputDir: join(tmpdir(), 'medpredict-integration-results'),
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5173', browserName: 'chromium', trace: 'off' },
  projects: [
    { name: 'backend-desktop', use: { viewport: { width: 1440, height: 1100 } } },
    { name: 'backend-mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: false,
    env: { VITE_API_MODE: 'real', VITE_API_BASE_URL: '',
      API_PROXY_TARGET: process.env.API_PROXY_TARGET || 'http://127.0.0.1:8080' },
  },
});
