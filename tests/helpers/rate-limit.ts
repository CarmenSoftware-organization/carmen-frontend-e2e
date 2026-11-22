/**
 * The value for the gateway's `x-rate-limit-bypass` header, from one place.
 * playwright.config.ts resolves it (env or .env.local) into E2E_RATE_LIMIT_BYPASS_TOKEN so workers
 * inherit it; scripts run under bun get .env.local loaded natively. "true" is the last-resort
 * fallback, which the gateway ignores unless its own token is "true".
 */
export function rateLimitBypassToken(): string {
  return process.env.E2E_RATE_LIMIT_BYPASS_TOKEN || process.env.RATE_LIMIT_BYPASS_TOKEN || "true";
}
