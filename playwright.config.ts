import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4322";
const live = Boolean(process.env.PLAYWRIGHT_BASE_URL);

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    launchOptions: {
      executablePath: process.env.CHROME_PATH || "/usr/local/bin/google-chrome",
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    },
  },
  webServer: live
    ? undefined
    : {
        command: "npm run preview -- --host 127.0.0.1 --port 4322",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
  ],
});
