/**
 * Generate docs/test-cases/COVERAGE.md — which frontend routes are tested.
 *
 * Run: bun audit:coverage            (rewrites the file)
 *      bun audit:coverage --check    (fails when the file is out of date)
 *
 * The matrix is generated rather than hand-kept because the hand-kept version
 * of this information — the catalog headers in docs/test-cases/ — drifted from
 * the app within months. Regenerating is the only way it stays true.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { parseRouterSource, type RouteEntry } from "./lib/route-map";
import {
  buildCoverage,
  extractRouteLiterals,
  findOrphanCatalogs,
  parseCatalogHeader,
  type CoverageRow,
  type SpecCoverage,
  type UnmatchedCatalog,
} from "./lib/coverage";

const REPO_ROOT = resolve(__dirname, "..");
const TESTS_DIR = join(REPO_ROOT, "tests");
const CATALOG_DIR = join(REPO_ROOT, "docs", "test-cases");
const OUT_FILE = join(CATALOG_DIR, "COVERAGE.md");
const FRONTEND_DIR = process.env.E2E_FRONTEND_DIR ?? "../carmen-frontend";

/** Section headings, keyed by the first URL segment. */
const AREA_TITLES: Record<string, string> = {
  accounting: "Accounting",
  config: "Config (master data)",
  dashboard: "Dashboard",
  "inventory-management": "Inventory Management",
  "operation-plan": "Operation Plan",
  procurement: "Procurement",
  "product-management": "Product Management",
  profile: "Profile",
  report: "Report",
  "store-operation": "Store Operation",
  "system-admin": "Platform / System Admin",
  "vendor-management": "Vendor Management",
};

function loadRoutes(): RouteEntry[] {
  const routerFile = resolve(REPO_ROOT, FRONTEND_DIR, "routes", "router.tsx");
  if (!existsSync(routerFile)) {
    console.error(
      `[coverage] router not found: ${routerFile}\n` +
        `  set E2E_FRONTEND_DIR to the frontend checkout (current: ${FRONTEND_DIR})`,
    );
    process.exit(2);
  }
  return parseRouterSource(readFileSync(routerFile, "utf8"), routerFile);
}

/**
 * URLs each spec drives.
 *
 * A spec usually navigates through a page object, so a page object's literals
 * count as the spec's own — without them eight modules with real specs
 * (vendor, price-list, store-requisition, …) would read as untested.
 *
 * Helpers and fixtures are deliberately excluded: `helpers/bu.ts` visits
 * `/dashboard` to read the profile response, and counting that made all thirty
 * specs look like they covered the dashboard.
 */
function loadSpecs(): SpecCoverage[] {
  const files = readdirSync(TESTS_DIR).filter((f) => f.endsWith(".spec.ts"));
  return files.map((file) => {
    const full = join(TESTS_DIR, file);
    const src = readFileSync(full, "utf8");
    const ownUrls = extractRouteLiterals(src);
    const urls = new Set(ownUrls);
    for (const dep of localImports(src, dirname(full))) {
      if (!existsSync(dep) || !dep.includes(`${sep}pages${sep}`)) continue;
      for (const u of extractRouteLiterals(readFileSync(dep, "utf8"))) urls.add(u);
    }
    return { file, urls: [...urls], ownUrls };
  });
}

/** Resolve one level of relative imports to files on disk. */
function localImports(source: string, fromDir: string): string[] {
  const out: string[] = [];
  const re = /from\s+["'](\.[^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const base = resolve(fromDir, m[1]);
    out.push(base.endsWith(".ts") ? base : `${base}.ts`);
  }
  return out;
}

/**
 * Catalogs, excluding `gaps/`.
 *
 * A gap report describes what a spec does NOT cover, so counting it as coverage
 * would report the opposite of what it says. Its module already reads as
 * covered through the spec itself.
 */
function loadCatalogs(): CatalogInfo[] {
  const files = readdirSync(CATALOG_DIR).filter(
    (f) => f.endsWith(".md") && f !== "README.md" && f !== "COVERAGE.md",
  );
  const out: CatalogInfo[] = [];
  for (const file of files) {
    const info = parseCatalogHeader(readFileSync(join(CATALOG_DIR, file), "utf8"), file);
    if (info) out.push(info);
  }
  return out;
}

const STATUS_LABEL: Record<CoverageRow["status"], string> = {
  spec: "✅ spec",
  catalog: "📄 catalog",
  none: "❌ none",
};

function render(rows: CoverageRow[], orphans: UnmatchedCatalog[]): string {
  const byArea = new Map<string, CoverageRow[]>();
  for (const row of rows) {
    const area = row.module.split("/").filter(Boolean)[0] ?? "(root)";
    const bucket = byArea.get(area) ?? [];
    bucket.push(row);
    byArea.set(area, bucket);
  }

  const counts = {
    spec: rows.filter((r) => r.status === "spec").length,
    catalog: rows.filter((r) => r.status === "catalog").length,
    none: rows.filter((r) => r.status === "none").length,
  };
  const routeTotal = rows.reduce((s, r) => s + r.urls.length, 0);

  const lines: string[] = [
    "# Coverage Matrix — routes ↔ specs ↔ catalogs",
    "",
    "**Generated file — do not edit.** Run `bun audit:coverage` to refresh.",
    "",
    `Parsed from the frontend router (\`routes/router.tsx\`): **${routeTotal} routes** across **${rows.length} modules**.`,
    "",
    "> **What `spec` means here:** a spec names the module's URL, in its own file or in a page object it imports."
      + " A spec that reaches a route only by *clicking* — never by `goto()` — is invisible to this matcher, so the"
      + " route reads as uncovered. `/procurement/purchase-request/from-template` is the known case: `302-pr-creator-journey`"
      + " drives it through `selectFirstTemplate()`, which clicks a card. Check the spec before concluding a gap is real.",
    "",
    "| Status | Meaning | Modules |",
    "| --- | --- | --- |",
    `| ✅ spec | an automated Playwright spec drives this module | ${counts.spec} |`,
    `| 📄 catalog | a hand-authored test-case catalog documents it, no spec yet | ${counts.catalog} |`,
    `| ❌ none | neither — this is the coverage gap | ${counts.none} |`,
    "",
  ];

  for (const area of [...byArea.keys()].sort()) {
    const areaRows = byArea.get(area) ?? [];
    lines.push(`## ${AREA_TITLES[area] ?? area}`, "");
    lines.push("| Module | Routes | Spec | Catalog | Status |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const row of areaRows.sort((a, b) => a.module.localeCompare(b.module))) {
      const routeCell = row.redirectOnly
        ? `${row.urls.length} _(redirect → \`${row.redirectTarget ?? "?"}\`)_`
        : String(row.urls.length);
      lines.push(
        `| \`${row.module}\` | ${routeCell} | ${cell(row.specs)} | ${cell(row.catalogs)} | ${STATUS_LABEL[row.status]} |`,
      );
    }
    lines.push("");
  }

  const stale = orphans.filter((o) => o.reason === "route-missing");
  const crossCutting = orphans.filter((o) => o.reason === "no-url");

  if (stale.length) {
    lines.push(
      "## Stale catalogs",
      "",
      "The declared route no longer matches any route in the app — renamed, moved, or removed. Each needs a decision: re-point it, or retire it.",
      "",
      "| Catalog | Prefix | Declared URL | Declared route dir |",
      "| --- | --- | --- | --- |",
    );
    for (const o of stale.sort((a, b) => a.catalog.file.localeCompare(b.catalog.file))) {
      const c = o.catalog;
      const urlCell = c.urls.length ? c.urls.map((u) => `\`${u}\``).join(", ") : "—";
      lines.push(`| \`${c.file}\` | \`${c.prefix}\` | ${urlCell} | \`${c.routeDir || "—"}\` |`);
    }
    lines.push("");
  }

  if (crossCutting.length) {
    lines.push(
      "## Cross-cutting catalogs",
      "",
      "These document behaviour spread across many routes rather than one module, so they have no row above. Nothing to fix.",
      "",
      "| Catalog | Prefix |",
      "| --- | --- |",
    );
    for (const o of crossCutting.sort((a, b) => a.catalog.file.localeCompare(b.catalog.file))) {
      lines.push(`| \`${o.catalog.file}\` | \`${o.catalog.prefix}\` |`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/** At most four names — a longer list is noise in a table this wide. */
function cell(items: string[]): string {
  if (!items.length) return "—";
  const shown = items.slice(0, 4).map((i) => `\`${i}\``).join("<br>");
  return items.length > 4 ? `${shown}<br>_+${items.length - 4} more_` : shown;
}

if (import.meta.main) {
  const check = process.argv.includes("--check");
  const rows = buildCoverage({
    routes: loadRoutes(),
    specs: loadSpecs(),
    catalogs: loadCatalogs(),
  });
  const orphans = findOrphanCatalogs(loadCatalogs(), rows);
  const markdown = render(rows, orphans);

  if (check) {
    const current = existsSync(OUT_FILE) ? readFileSync(OUT_FILE, "utf8") : "";
    if (current !== markdown) {
      console.error(`[coverage] ${basename(OUT_FILE)} is out of date — run: bun audit:coverage`);
      process.exit(1);
    }
    console.log(`[coverage] up to date (${rows.length} modules)`);
    process.exit(0);
  }

  writeFileSync(OUT_FILE, markdown);
  const gaps = rows.filter((r) => r.status === "none").length;
  console.log(
    `[coverage] wrote ${basename(OUT_FILE)}: ${rows.length} modules, ` +
      `${gaps} without coverage, ${orphans.filter((o) => o.reason === "route-missing").length} stale catalogs`,
  );
}
