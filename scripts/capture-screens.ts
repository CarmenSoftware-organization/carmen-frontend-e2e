#!/usr/bin/env bun
/**
 * Capture full-page PNG screenshots of every screen each test user can reach.
 *
 *   bun run create:sitemap:screen
 *   bun run create:sitemap:screen -- --user admin,hod
 *   bun run create:sitemap:screen -- --concurrency 3 --max-pages 50
 *   bun run create:sitemap:screen -- --bu GR2VYNKQ  (default: BU_CODE from tests/test-users.ts; --bu none keeps each user's own default BU)
 *
 * Output: runs/screens/<datetime>/
 *           index.html            overview, one card per user
 *           manifest.json         every capture, keyed by user
 *           <user>/sitemap.html   that user's screens
 *           <user>/images/*.png
 *         plus a runs/screens/latest symlink.
 *
 * Unlike tests/wiki-screenshots (which shoots a curated manifest of routes),
 * this crawls: it follows the links each role actually sees, so the per-user
 * sitemaps double as evidence of what that role can reach.
 *
 * Auth is a fresh UI login per user every run — no dependency on the Playwright
 * `setup` project or .auth/*.json, so this runs standalone.
 *
 * After login each user is switched to the `--bu` business unit before the
 * crawl. Without it the crawl runs in whatever BU the account defaults to, and
 * a BU without the module subscription shows "Permission Denied" on every
 * module — leaving only /system-admin and /profile, identical for every role.
 * The switch persists server-side (it is the account's default BU).
 */
import { chromium, type Browser, type Page } from "@playwright/test";
import { mkdirSync, rmSync, writeFileSync, symlinkSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import { resolve, join } from "node:path";

import { LoginPage } from "../tests/pages/login.page";
import { ensureActiveBu } from "../tests/helpers/bu";
import { TEST_USERS, BU_CODE, getPasswordFor } from "../tests/test-users";
import {
  enqueueUnseen,
  normalizeScreenUrl,
  safeName,
  userFolder,
  type CrawlTarget,
} from "./lib/screen-crawl";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const FRONTEND_DIR = process.env.E2E_FRONTEND_DIR ?? "../carmen-frontend";
const START_FRONTEND = process.env.E2E_NO_WEBSERVER !== "1";

const RUNS_ROOT = resolve(process.cwd(), "runs", "screens");
const RUN_ID = (() => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_` +
    `${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`
  );
})();
const RUN_DIR = join(RUNS_ROOT, RUN_ID);

// ── CLI ────────────────────────────────────────────────────────────

interface Options {
  users: typeof TEST_USERS[number][];
  concurrency: number;
  maxPages: number;
  /** BU code to switch every user to after login, or null to keep their default. */
  bu: string | null;
}

/** Read `--flag value` / `--flag=value` out of argv. Exported for tests. */
export function readFlag(argv: string[], name: string): string | undefined {
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}

/** Resolve `--bu`: BU_CODE (the suite's BU) when absent, null for "none" (keep the account's default BU). */
export function selectBu(spec: string | undefined): string | null {
  if (spec === undefined) return BU_CODE;
  const code = spec.trim();
  if (!code) throw new Error("--bu needs a business-unit code (or \"none\")");
  return code.toLowerCase() === "none" ? null : code;
}

/**
 * Resolve a `--user` spec into test users. Each entry matches a role
 * ("HOD") or an email local part ("hod") case-insensitively. An unknown
 * name is an error rather than a silent no-op — a typo'd role would
 * otherwise look like a role with no accessible screens.
 */
export function selectUsers(spec: string | undefined): typeof TEST_USERS[number][] {
  if (!spec) return [...TEST_USERS];

  return spec.split(",").map((raw) => {
    const name = raw.trim().toLowerCase();
    const found = TEST_USERS.find(
      (u) => u.role.toLowerCase() === name || userFolder(u.email) === name,
    );
    if (!found) {
      const known = TEST_USERS.map((u) => u.role).join(", ");
      throw new Error(`unknown user "${raw.trim()}" — known roles: ${known}`);
    }
    return found;
  });
}

function parseOptions(argv: string[]): Options {
  const num = (name: string, fallback: number): number => {
    const raw = readFlag(argv, name);
    if (raw === undefined) return fallback;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) throw new Error(`--${name} must be a positive integer`);
    return n;
  };

  return {
    users: selectUsers(readFlag(argv, "user")),
    concurrency: num("concurrency", 1),
    maxPages: num("max-pages", 300),
    bu: selectBu(readFlag(argv, "bu")),
  };
}

// ── Frontend lifecycle ─────────────────────────────────────────────

async function waitForFrontend(): Promise<void> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/login`);
      if (response.ok) return;
    } catch {
      // The frontend is still starting.
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`cannot reach ${BASE_URL}/login within 120s`);
}

function stopFrontend(frontend: ChildProcess | undefined): void {
  if (frontend && !frontend.killed) frontend.kill("SIGTERM");
}

/**
 * Wait until no request has been in flight for `quietMs`, capped at `maxMs`.
 *
 * `waitForLoadState("networkidle")` is unusable here: the SPA polls, so it may
 * never reach idle. This is best-effort — a timeout means "shoot it anyway",
 * never an error.
 */
async function waitForNetworkQuiet(page: Page, quietMs = 800, maxMs = 10_000): Promise<void> {
  let inFlight = 0;
  let quietSince: number | null = Date.now();

  const onRequest = () => {
    inFlight++;
    quietSince = null;
  };
  const onSettled = () => {
    inFlight = Math.max(0, inFlight - 1);
    if (inFlight === 0) quietSince = Date.now();
  };

  page.on("request", onRequest);
  page.on("requestfinished", onSettled);
  page.on("requestfailed", onSettled);

  try {
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
      if (inFlight === 0 && quietSince !== null && Date.now() - quietSince >= quietMs) return;
      await new Promise((r) => setTimeout(r, 100));
    }
  } finally {
    // Listeners are per-page and this page is reused for every capture, so
    // leaving them attached would stack one set per screen.
    page.off("request", onRequest);
    page.off("requestfinished", onSettled);
    page.off("requestfailed", onSettled);
  }
}

// ── Capture ────────────────────────────────────────────────────────

type CaptureStatus = "ok" | "failed" | "session-lost" | "redirected";

interface ManifestEntry {
  label: string;
  route: string;
  /** Path relative to that user's folder, or null when nothing was captured. */
  file: string | null;
  status: CaptureStatus;
  reason?: string;
}

interface UserResult {
  user: string;
  role: string;
  email: string;
  status: "ok" | "login-failed" | "bu-failed" | "session-lost";
  reason?: string;
  /** BU the crawl ran in; null when --bu none left the account's default in place. */
  bu: string | null;
  captures: ManifestEntry[];
}

const IMAGE_SUBDIR = "images";

async function captureScreen(
  page: Page,
  target: CrawlTarget,
  userDir: string,
  captured: Set<string>,
  log: (line: string) => void,
): Promise<ManifestEntry> {
  const label = target.route.replace(BASE_URL, "") || "/";
  const fileName = `${safeName(label)}.png`;

  try {
    await page.goto(target.url, { timeout: 30_000 });
    await waitForNetworkQuiet(page);

    // The SPA keeps its bearer token in browser storage, so a hard navigation
    // to an expired session lands on /login. Without this guard the crawler
    // would happily shoot the login page once per remaining route.
    if (/\/login(\?|#|$)/.test(page.url()) && !/\/login/.test(target.url)) {
      log(`  ! ${label}  (redirected to /login — session lost)`);
      return { label, route: target.route, file: null, status: "session-lost",
        reason: "redirected to /login" };
    }

    // A route the role may not open bounces back to a page we already shot.
    // Recording the redirect — rather than saving a second copy of the
    // destination under this route's name — is what makes the sitemap readable
    // as "what this role can actually reach".
    const landed = normalizeScreenUrl(page.url(), BASE_URL);
    if (landed && landed !== target.route && captured.has(landed)) {
      const to = landed.replace(BASE_URL, "") || "/";
      log(`  → ${label}  (redirects to ${to})`);
      return { label, route: target.route, file: null, status: "redirected",
        reason: `redirects to ${to}` };
    }

    await page.screenshot({ path: join(userDir, IMAGE_SUBDIR, fileName), fullPage: true });
    captured.add(landed ?? target.route);
    log(`  ✓ ${label}`);
    return { label, route: target.route, file: `${IMAGE_SUBDIR}/${fileName}`, status: "ok" };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    log(`  ✗ ${label}  (${reason.split("\n")[0]})`);
    return { label, route: target.route, file: null, status: "failed", reason };
  }
}

/**
 * Every href the current page can reach, including the ones behind the module
 * launcher.
 *
 * This SPA does not put its navigation in the DOM up front: the sidebar only
 * lists the pages of the module you are already inside, and the 11 module roots
 * live in a "Modules" popover that renders its links only while open. Crawling
 * plain `a[href]` therefore finds exactly three links from /dashboard and stops.
 * Opening the launcher is what makes the crawl reach the rest of the app.
 *
 * Called after the screenshot, so the popover never covers the captured image.
 */
async function collectLinks(page: Page): Promise<string[]> {
  const readHrefs = () =>
    page
      .locator("a[href]")
      .evaluateAll((links) => links.map((l) => (l as HTMLAnchorElement).href))
      .catch(() => [] as string[]);

  const hrefs = await readHrefs();

  const launcher = page.getByRole("button", { name: /^modules$/i });
  if ((await launcher.count()) === 0) return hrefs;

  try {
    await launcher.first().click({ timeout: 5_000 });
    // Wait for the popover's links to mount rather than sleeping a fixed time.
    const deadline = Date.now() + 3_000;
    let opened: string[] = hrefs;
    while (Date.now() < deadline) {
      opened = await readHrefs();
      if (opened.length > hrefs.length) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    await page.keyboard.press("Escape").catch(() => {});
    return opened;
  } catch {
    // A page without a working launcher still yields its own links.
    return hrefs;
  }
}

/**
 * Open the first row's record on a list page and capture it.
 *
 * List rows carry no `<a href>` at all — a record opens from a link-styled
 * `<button>` whose text is the record's code ("CAD", "P055", "draft-1425"), so
 * no amount of link-following reaches a detail screen. The button is targeted
 * precisely rather than clicking the row: a row also holds a checkbox and, in
 * some modules, row actions, and this crawler must stay read-only.
 *
 * Two shapes exist, and both are captured:
 * - Master/transaction modules navigate to `/<module>/<record>/<uuid>`. The new
 *   URL is queued, so it is shot by the normal crawl loop, named from its
 *   ":id" route, and crawled onwards into whatever the detail page links to.
 * - Config modules open a dialog and leave the URL untouched. Nothing would
 *   ever queue it, so it is shot here and filed under "<route>#detail".
 *
 * Runs after collectLinks(), because a click that navigates would otherwise
 * take the page away before its links had been read.
 */
async function captureFirstRowDetail(
  page: Page,
  target: CrawlTarget,
  userDir: string,
  queue: CrawlTarget[],
  seen: Set<string>,
  log: (line: string) => void,
): Promise<ManifestEntry | null> {
  const opener = page
    .locator("table tbody tr")
    .first()
    .locator("button.text-primary")
    .first();

  if ((await opener.count().catch(() => 0)) === 0) return null;

  const routeLabel = target.route.replace(BASE_URL, "") || "/";
  const urlBefore = page.url();
  const record = (await opener.innerText().catch(() => "")).trim().slice(0, 40);

  try {
    await opener.click({ timeout: 5_000 });
  } catch {
    return null; // Not an opener after all — a disabled or detached button.
  }

  // The click either navigates or mounts a dialog; wait for whichever happens.
  const deadline = Date.now() + 5_000;
  let dialogOpen = false;
  while (Date.now() < deadline) {
    if (page.url() !== urlBefore) break;
    if ((await page.getByRole("dialog").count().catch(() => 0)) > 0) {
      dialogOpen = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  if (page.url() !== urlBefore) {
    await waitForNetworkQuiet(page);
    const added = enqueueUnseen(queue, seen, [page.url()], BASE_URL);
    if (added.length > 0) {
      log(`  + ${routeLabel}  (queued detail of "${record}")`);
    }
    return null; // The crawl loop captures it like any other route.
  }

  if (!dialogOpen) return null;

  await waitForNetworkQuiet(page);
  const fileName = `${safeName(routeLabel)}--detail.png`;
  try {
    await page.screenshot({ path: join(userDir, IMAGE_SUBDIR, fileName), fullPage: true });
    log(`  ✓ ${routeLabel} (detail of "${record}")`);
    return {
      label: `${routeLabel} (detail)`,
      route: `${target.route}#detail`,
      file: `${IMAGE_SUBDIR}/${fileName}`,
      status: "ok",
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    log(`  ✗ ${routeLabel} (detail)  (${reason.split("\n")[0]})`);
    return { label: `${routeLabel} (detail)`, route: `${target.route}#detail`, file: null,
      status: "failed", reason };
  } finally {
    // Leave the page closed so the next iteration starts from a clean state
    // even if it lands on the same route via a different href.
    await page.keyboard.press("Escape").catch(() => {});
  }
}

/** Log in, crawl every reachable screen, and write that user's sitemap. */
async function captureUser(
  browser: Browser,
  user: typeof TEST_USERS[number],
  options: Options,
): Promise<UserResult> {
  const folder = userFolder(user.email);
  const userDir = join(RUN_DIR, folder);
  const prefix = `[${folder}]`;
  const log = (line: string) => console.log(`${prefix}${line.startsWith(" ") ? "" : " "}${line}`);

  mkdirSync(join(userDir, IMAGE_SUBDIR), { recursive: true });
  const startedAt = Date.now();

  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 1280, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  const result: UserResult = {
    user: folder, role: user.role, email: user.email, status: "ok", bu: options.bu, captures: [],
  };

  try {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // The login screen is the one capture taken before auth — it is also the
    // only place BLOCKED_PATH's /login rule is bypassed on purpose.
    const captured = new Set<string>();
    result.captures.push(
      await captureScreen(
        page,
        { url: `${BASE_URL}/login`, route: `${BASE_URL}/login` },
        userDir,
        captured,
        log,
      ),
    );

    await loginPage.loginWithRetry(user.email, getPasswordFor(user.email));
    if (!/\/dashboard/.test(page.url())) {
      result.status = "login-failed";
      result.reason = `still at ${page.url()} after login`;
      log(`login failed — ${result.reason}`);
      return result;
    }

    if (options.bu) {
      try {
        await ensureActiveBu(page, options.bu);
        log(`active BU: ${options.bu}`);
      } catch (err) {
        // Crawling the wrong BU would produce a sitemap that looks valid but
        // shows the wrong screens — stop this user instead.
        result.status = "bu-failed";
        result.reason = err instanceof Error ? err.message.split("\n")[0] : String(err);
        log(`BU switch failed — ${result.reason}`);
        return result;
      }
    }

    const queue: CrawlTarget[] = [{ url: `${BASE_URL}/dashboard`, route: `${BASE_URL}/dashboard` }];
    const seen = new Set(queue.map((t) => t.route));
    let visited = 0;

    while (queue.length > 0) {
      if (visited >= options.maxPages) {
        log(`reached --max-pages ${options.maxPages}; ${queue.length} route(s) left unvisited`);
        break;
      }

      const target = queue.shift()!;
      const capture = await captureScreen(page, target, userDir, captured, log);
      result.captures.push(capture);
      visited++;

      if (capture.status === "session-lost") {
        result.status = "session-lost";
        result.reason = `session lost at ${capture.label}`;
        break;
      }
      if (capture.status === "failed" || capture.status === "redirected") continue;

      enqueueUnseen(queue, seen, await collectLinks(page), BASE_URL);

      const detail = await captureFirstRowDetail(page, target, userDir, queue, seen, log);
      if (detail) result.captures.push(detail);
    }
  } finally {
    await context.close().catch(() => {});
    // Written here, not after every user finishes, so a crash on role 7 still
    // leaves roles 1-6 viewable on disk.
    writeFileSync(join(userDir, "sitemap.html"), renderUserSitemap(result));
  }

  const ok = result.captures.filter((c) => c.status === "ok").length;
  log(`done — ${ok} screen(s) in ${formatDuration(Date.now() - startedAt)}`);
  return result;
}

/** "4m 12s" — a run can take an hour, so bare milliseconds are unreadable. */
export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

/** Run `task` over `items` with at most `limit` in flight. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// ── HTML ───────────────────────────────────────────────────────────

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const PAGE_CSS = `
    :root { color-scheme: dark; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #111; color: #eee; margin: 0; padding: 24px; }
    a { color: #7ab8ff; }
    h1 { font-weight: 500; margin: 0 0 8px; }
    .meta { color: #888; margin-bottom: 24px; font-size: 13px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
    figure { margin: 0; background: #1c1c1c; border: 1px solid #2a2a2a; border-radius: 8px; overflow: hidden; }
    figure img { width: 100%; display: block; }
    figure.bad .placeholder { padding: 80px 16px; text-align: center; color: #888; font-size: 13px; letter-spacing: 0.1em; }
    figcaption { padding: 12px; font-size: 13px; color: #ccc; }
    code { color: #7ab8ff; font-size: 12px; word-break: break-all; }
    .card { display: block; background: #1c1c1c; border: 1px solid #2a2a2a; border-radius: 8px; padding: 16px; text-decoration: none; color: #eee; }
    .card:hover { border-color: #7ab8ff; }
    .card .role { font-size: 16px; margin-bottom: 4px; }
    .card .count { color: #888; font-size: 13px; }
    .bad-status { color: #ff8f6b; }
`;

function htmlPage(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>${PAGE_CSS}  </style>
</head>
<body>
${body}
</body>
</html>
`;
}

function renderUserSitemap(result: UserResult): string {
  const figures = result.captures
    .map((c) => {
      const caption = `<figcaption><strong>${escapeHtml(c.label)}</strong><br><code>${escapeHtml(c.route)}</code>`;
      if (c.status === "ok" && c.file) {
        return `    <figure>
      <a href="${escapeHtml(c.file)}"><img src="${escapeHtml(c.file)}" alt="${escapeHtml(c.label)}" loading="lazy"></a>
      ${caption}</figcaption>
    </figure>`;
      }
      return `    <figure class="bad">
      <div class="placeholder">${c.status.toUpperCase()}</div>
      ${caption}<br><span class="bad-status">${escapeHtml(c.reason ?? "")}</span></figcaption>
    </figure>`;
    })
    .join("\n");

  const ok = result.captures.filter((c) => c.status === "ok").length;
  const problem = result.status === "ok" ? "" :
    ` · <span class="bad-status">${escapeHtml(result.status)}: ${escapeHtml(result.reason ?? "")}</span>`;

  return htmlPage(
    `${result.role} — screens ${RUN_ID}`,
    `  <h1>${escapeHtml(result.role)} <span class="count">(${escapeHtml(result.email)})</span></h1>
  <div class="meta"><a href="../index.html">← all users</a> · ${RUN_ID} · ${escapeHtml(BASE_URL)} · BU ${escapeHtml(result.bu ?? "(account default)")} · ${ok} screen(s)${problem}</div>
  <div class="grid">
${figures}
  </div>`,
  );
}

function renderIndex(results: UserResult[], bu: string | null): string {
  const cards = results
    .map((r) => {
      const ok = r.captures.filter((c) => c.status === "ok").length;
      const bad = r.captures.length - ok;
      const note = r.status === "ok" ? "" :
        `<br><span class="bad-status">${escapeHtml(r.status)}</span>`;
      return `    <a class="card" href="${escapeHtml(r.user)}/sitemap.html">
      <div class="role">${escapeHtml(r.role)}</div>
      <div class="count">${escapeHtml(r.email)}<br>${ok} screen(s)${bad ? ` · ${bad} problem(s)` : ""}${note}</div>
    </a>`;
    })
    .join("\n");

  return htmlPage(
    `Screen capture — ${RUN_ID}`,
    `  <h1>Screen capture</h1>
  <div class="meta">${RUN_ID} · ${escapeHtml(BASE_URL)} · BU ${escapeHtml(bu ?? "(account default)")} · ${results.length} user(s)</div>
  <div class="grid">
${cards}
  </div>`,
  );
}

// ── Main ───────────────────────────────────────────────────────────

async function main(): Promise<void> {
  let options: Options;
  try {
    options = parseOptions(process.argv.slice(2));
  } catch (err) {
    console.error(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  console.log(`create:sitemap:screen — run ${RUN_ID}`);
  console.log(`  base URL:    ${BASE_URL}`);
  console.log(`  output:      ${RUN_DIR}`);
  console.log(`  users:       ${options.users.map((u) => u.role).join(", ")}`);
  console.log(`  concurrency: ${options.concurrency} · max pages/user: ${options.maxPages}`);
  console.log(`  BU:          ${options.bu ?? "(each account's default)"}`);

  mkdirSync(RUN_DIR, { recursive: true });
  const runStartedAt = Date.now();

  let frontend: ChildProcess | undefined;
  if (START_FRONTEND) {
    console.log(`  frontend:    starting ${FRONTEND_DIR}`);
    frontend = spawn("bun", ["dev"], { cwd: FRONTEND_DIR, stdio: "inherit" });
  }

  let browser: Browser;
  try {
    await waitForFrontend();
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    console.error(`\nERROR: ${err instanceof Error ? err.message : String(err)}`);
    console.error(`  Is the frontend running? Try: bun run install-browsers`);
    stopFrontend(frontend);
    process.exit(1);
  }

  let results: UserResult[] = [];
  try {
    results = await mapWithConcurrency(options.users, options.concurrency, (user) =>
      captureUser(browser, user, options),
    );
  } finally {
    await browser.close().catch(() => {});
    stopFrontend(frontend);

    writeFileSync(
      join(RUN_DIR, "manifest.json"),
      JSON.stringify({ runId: RUN_ID, baseUrl: BASE_URL, bu: options.bu, users: results }, null, 2),
    );
    writeFileSync(join(RUN_DIR, "index.html"), renderIndex(results, options.bu));

    try {
      rmSync(join(RUNS_ROOT, "latest"), { force: true });
      symlinkSync(RUN_ID, join(RUNS_ROOT, "latest"), "dir");
    } catch {
      // best-effort — symlinks may be unavailable on some filesystems
    }
  }

  const ok = results.reduce((n, r) => n + r.captures.filter((c) => c.status === "ok").length, 0);
  const problems = results.filter((r) => r.status !== "ok");
  console.log(
    `\n${ok} screen(s) across ${results.length} user(s) in ${formatDuration(Date.now() - runStartedAt)}`,
  );
  for (const p of problems) console.log(`  ! ${p.user}: ${p.status} — ${p.reason ?? ""}`);
  console.log(`View: ${join(RUN_DIR, "index.html")}`);

  if (ok === 0) {
    console.error("No screens captured.");
    process.exit(1);
  }
  process.exit(0);
}

// Only run when invoked directly — importing this file (e.g. from a unit test)
// must not launch a browser. `import.meta.main` would read better, but this
// repo's tsconfig targets module=commonjs, where tsc rejects import.meta.
if (process.argv[1]?.endsWith("capture-screens.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
