import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";
// Node side of the dev-backend TLS chain fix (Bun gets it from bunfig.toml preload).
import "./scripts/tls-extra-ca";

// `bun run test` does not hand .env.local to the `playwright` child process (verified: the
// variable is empty inside this config), so read the one key we need from the file ourselves.
// A value already in the environment (CI, scripts/run-env.ts) wins.
function readRateLimitBypassToken(): string {
  const fromEnv = process.env.E2E_RATE_LIMIT_BYPASS_TOKEN || process.env.RATE_LIMIT_BYPASS_TOKEN;
  if (fromEnv) return fromEnv;
  try {
    const text = readFileSync(resolve(__dirname, ".env.local"), "utf8");
    const m = /^(?:E2E_)?RATE_LIMIT_BYPASS_TOKEN=(.*)$/m.exec(text);
    const value = m?.[1]?.trim().replace(/^(['"])(.*)\1$/, "$2");
    if (value) return value;
  } catch {
    // no .env.local — fall through
  }
  return "";
}
const RATE_LIMIT_BYPASS_TOKEN_CONFIGURED = readRateLimitBypassToken();
// Workers inherit process.env, so tests/helpers read the one resolved value (tests/helpers/rate-limit.ts).
if (RATE_LIMIT_BYPASS_TOKEN_CONFIGURED) process.env.E2E_RATE_LIMIT_BYPASS_TOKEN = RATE_LIMIT_BYPASS_TOKEN_CONFIGURED;
if (!RATE_LIMIT_BYPASS_TOKEN_CONFIGURED) {
  // Never print the token itself, only the fact that it is missing.
  console.warn(
    "[e2e] no E2E_RATE_LIMIT_BYPASS_TOKEN / RATE_LIMIT_BYPASS_TOKEN found: falling back to \"true\", which the gateway ignores unless its token is \"true\" - expect 429s in the login suite",
  );
}
const RATE_LIMIT_BYPASS_TOKEN = RATE_LIMIT_BYPASS_TOKEN_CONFIGURED || "true";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const FRONTEND_DIR =
  process.env.E2E_FRONTEND_DIR ?? "../carmen-frontend";
const START_FRONTEND = process.env.E2E_NO_WEBSERVER !== "1";

// Period-close suite — opt-in, because it needs the CARMEN-AVG / CARMEN-FIFO tenant,
// its own accounts (tests/movement-users.ts) and a read-only DB URL, none of
// which exist on UAT/prod targets, and because its specs post real stock.
//   E2E_PERIOD_CLOSE=1  period-close phases (`9xx-period-close-*.spec.ts`) — run one phase at a time
// The doc-flow specs (312 404 502 603 702 721) moved to the TEST BUs and run in `chromium`.
const PERIOD_CLOSE = process.env.E2E_PERIOD_CLOSE === "1";
const PERIOD_CLOSE_SPECS = /9\d\d-period-close-[^/]+\.spec\.ts$/;
const movementUse = {
  ...devices["Desktop Chrome"],
  viewport: { width: 1440, height: 900 },
  // The date pickers are driven by `data-day` (toLocaleDateString) and documents are
  // dated per period, so locale and timezone are pinned.
  locale: "en-US",
  timezoneId: "Asia/Bangkok",
  actionTimeout: 20_000,
  navigationTimeout: 60_000,
};

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report" }],
    [
      "./tests/reporters/tc-json-reporter.ts",
      { outputDir: "tests/results" },
    ],
  ],
  use: {
    baseURL: BASE_URL,
    // The backend rate-limits repeated logins per email (429 "Too many login
    // attempts"), which the suite hits easily: the `setup` project alone signs in
    // 9 roles, and a day of iterating re-runs it many times. The backend accepts
    // this header as an opt-out for automated clients — it is sent on every
    // request the browser context makes, including the real-UI logins.
    //
    // The gateway only skips the throttler when the header equals its configured
    // RATE_LIMIT_BYPASS_TOKEN (backend-gateway rate-limit-bypass.ts, fail-closed: a
    // mismatching value is counted like any other request). The literal "true" only
    // matches a gateway whose token is "true", so it 429'd the login suite
    // (TC-LOGIN-010003..010005, 100006, 010037 ... — a different set every run).
    // Put the gateway's token in .env.local as E2E_RATE_LIMIT_BYPASS_TOKEN
    // (RATE_LIMIT_BYPASS_TOKEN is read as a fallback).
    extraHTTPHeaders: { "x-rate-limit-bypass": RATE_LIMIT_BYPASS_TOKEN },
    trace: "on-first-retry",
    screenshot: "on",
    video: "on",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts$/,
      retries: 2,
      fullyParallel: false,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "login",
      testMatch: /001-login\.spec\.ts/,
      fullyParallel: false,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      testIgnore: [
        /001-login\.spec\.ts$|auth\.setup\.ts$|movement\.setup\.ts$|wiki-screenshots\//,
        PERIOD_CLOSE_SPECS,
      ],
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"] },
    },
    ...(PERIOD_CLOSE
      ? [
          {
            name: "movement-setup",
            testMatch: /movement\.setup\.ts$/,
            retries: 2,
            fullyParallel: false,
            use: movementUse,
          },
        ]
      : []),
    ...(PERIOD_CLOSE
      ? [
          {
            name: "period-close",
            testMatch: PERIOD_CLOSE_SPECS,
            dependencies: ["movement-setup"],
            fullyParallel: false,
            retries: 0,
            timeout: 10 * 60_000,
            expect: { timeout: 15_000 },
            use: movementUse,
          },
        ]
      : []),
    {
      name: "wiki-screenshots",
      testMatch: /wiki-screenshots\/capture\.spec\.ts$/,
      dependencies: ["setup"],
      fullyParallel: false,
      // This batch job creates its own browser contexts and navigates many
      // routes with no TC ID, so videos would never be copied to videos/ and
      // would only bloat test-results/. Opt out of the global video: "on".
      use: { ...devices["Desktop Chrome"], video: "off" },
    },
    {
      name: "wiki-probe",
      testMatch: /wiki-screenshots\/probe\.spec\.ts$/,
      dependencies: ["setup"],
      fullyParallel: false,
      // No retries even on CI: this is a single ~25-minute pass whose only
      // assertion ("some role reached some page") is not retry-fixable, so the
      // inherited `CI ? 2 : 0` would just burn 50 more minutes to fail again.
      retries: 0,
      // Batch job over ~1,100 page visits with no TC ID: screenshots and video
      // would be pure noise, and the whole point of this pass is to be cheap.
      use: { ...devices["Desktop Chrome"], video: "off", screenshot: "off" },
    },
  ],
  webServer: START_FRONTEND
    ? {
        command: "bun dev",
        cwd: FRONTEND_DIR,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
});
