/**
 * Playwright E2E configuration for the Sfinx interview system.
 * Loads .env.test for E2E-specific flags and uses fake media devices.
 */
import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '.env.test') });

const wavPath = path.resolve(__dirname, 'data/mock-voice/en_threejs_memory_leak.wav');

export default defineConfig({
  testDir: 'e2e',
  timeout: 300_000,
  expect: { timeout: 30_000 },
  reporter: 'list',
  workers: 1,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'retry-with-trace',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'interview-e2e',
      use: {
        headless: false,
        viewport: null,
        launchOptions: {
          args: [
            '--start-maximized',
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
            `--use-file-for-fake-audio-capture=${wavPath}`,
          ],
        },
      },
    },
  ],
});
