import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const wavPath = path.resolve(__dirname, 'data/mock-voice/en_threejs_memory_leak.wav');

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'retry-with-trace',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'voice-chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
            `--use-file-for-fake-audio-capture=${wavPath}`,
          ],
        },
      },
    },
  ],
});


