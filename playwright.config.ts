import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry"
  },
  webServer: {
    command: "npx next dev --hostname localhost --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    env: {
      USE_FIXTURE_DATA: "1",
      APP_ENV: "development",
      SUPABASE_DEV_URL: "https://example.supabase.co",
      SUPABASE_DEV_PUBLISHABLE_KEY: "publishable",
      SUPABASE_DEV_SECRET_KEY: "secret-key",
      BLOB_READ_WRITE_TOKEN: "blob",
      ADMIN_PASSWORD: "secret",
      AUTH_COOKIE_SECRET: "cookie-secret"
    }
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: "chrome" }
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"], channel: "chrome" }
    }
  ]
});
