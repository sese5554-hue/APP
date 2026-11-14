import { defineConfig } from "@playwright/test";
import "dotenv/config";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3001",
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      ...(process.platform === "win32"
        ? {
            executablePath:
              "C:/Program Files/Google/Chrome/Application/chrome.exe",
          }
        : {}),
      headless: true,
    },
  },
  reporter: [["list"], ["html", { open: "never" }]],
  webServer: {
    command: "node scripts/serve.mjs",
    env: {
      NODE_ENV: "test",
      PROVIDER_MODE: "development",
      APP_ORIGIN: "http://127.0.0.1:3001",
    },
    stdout: "pipe",
    url: "http://127.0.0.1:3001/api/health",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
