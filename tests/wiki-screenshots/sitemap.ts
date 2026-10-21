import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";
import { discoverFrontendRoutes } from "./route-discovery";
import { loadRoleMatrix, ROLE_MATRIX_PATH, baselineFor } from "./role-matrix";
import { outputFile } from "./shot-path";
import { SHOTS } from "./manifest";
import type { ProbeResult, ShotSpec } from "./types";

/** A role that could not see the page, with the text the page actually showed. */
export type RoleNote = { role: string; reason?: string };

/** One card on the sitemap: a route plus every image that exists for it. */
export type SitemapEntry = {
  route: string;
  module: string;
  slug: string;
  baselineRole?: string;
  /** Path relative to the HTML file, or undefined when nothing was captured. */
  baselineImage?: string;
  variants: Array<{ role: string; image: string }>;
  denied: RoleNote[];
  unavailable: RoleNote[];
};

/**
 * Join the manifest, the probe matrix, and what is actually on disk.
 *
 * Disk is the authority for images: the manifest says what we intended to
 * shoot, not what succeeded.
 */
export function buildEntries(
  shots: ShotSpec[],
  matrix: ProbeResult[],
  assetsDir: string,
  htmlDir: string,
  fileExists: (p: string) => boolean,
): SitemapEntry[] {
  return shots.map((spec) => {
    const forRoute = matrix.filter((r) => r.route === spec.path);
    const base = baselineFor(matrix, spec.path);
    const rel = (abs: string): string => relative(htmlDir, abs).split("\\").join("/");

    let baselineImage: string | undefined;
    const variants: Array<{ role: string; image: string }> = [];
    if (base) {
      const baseFile = outputFile(assetsDir, spec, base.role, base.role);
      if (fileExists(baseFile)) baselineImage = rel(baseFile);
      for (const r of forRoute) {
        if (r.role === base.role || r.outcome !== "ok") continue;
        const f = outputFile(assetsDir, spec, r.role, base.role);
        if (fileExists(f)) variants.push({ role: r.role, image: rel(f) });
      }
    }

    return {
      route: spec.path,
      module: spec.module,
      slug: spec.interaction === "add-dialog" ? `${spec.slug} (dialog)` : spec.slug,
      baselineRole: base?.role,
      baselineImage,
      variants,
      // Carry the reason, not just the role: "Permission Denied" and "no
      // seedId" are answers to completely different questions, and the badge
      // alone cannot tell them apart.
      denied: forRoute
        .filter((r) => r.outcome === "denied")
        .map((r) => ({ role: r.role, reason: r.reason })),
      unavailable: forRoute
        .filter((r) => r.outcome === "not-found" || r.outcome === "error")
        .map((r) => ({ role: r.role, reason: r.reason })),
    };
  });
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Top-level URL segment, used as the section heading. */
function sectionOf(route: string): string {
  return route.split("/").filter(Boolean)[0] ?? "root";
}

/**
 * "Permission Denied — HOD, FC, GM" per distinct reason.
 *
 * Grouping keeps the card compact: on an RBAC-blocked page eight of the nine
 * roles usually report the exact same sentence. Every reason is page-sourced
 * text, so it goes through `esc()`.
 */
function renderReasons(notes: RoleNote[]): string {
  const byReason = new Map<string, string[]>();
  for (const n of notes) {
    if (!n.reason) continue;
    byReason.set(n.reason, [...(byReason.get(n.reason) ?? []), n.role]);
  }
  if (byReason.size === 0) return "";
  const items = [...byReason.entries()]
    .map(([reason, roles]) => `<li>${esc(reason)} — ${esc(roles.join(", "))}</li>`)
    .join("");
  return `<ul class="reasons">${items}</ul>`;
}

function renderCard(e: SitemapEntry): string {
  const thumb = e.baselineImage
    ? `<img src="${esc(e.baselineImage)}" alt="${esc(e.route)}" loading="lazy">`
    : `<div class="no-shot">no screenshot</div>`;
  const badge = (cls: string, n: RoleNote, mark: string): string =>
    `<span class="b ${cls}"${n.reason ? ` title="${esc(n.reason)}"` : ""}>${esc(n.role)} ${mark}</span>`;
  const badges = [
    e.baselineRole ? `<span class="b base">${esc(e.baselineRole)}</span>` : "",
    ...e.variants.map((v) => `<a class="b var" href="${esc(v.image)}">${esc(v.role)} ⊕</a>`),
    ...e.denied.map((n) => badge("denied", n, "⊘")),
    ...e.unavailable.map((n) => badge("na", n, "—")),
  ].join("");
  const roles = [
    e.baselineRole ?? "",
    ...e.variants.map((v) => v.role),
    ...e.denied.map((n) => n.role),
  ].join(" ");
  return `<article class="card" data-route="${esc(e.route)}" data-roles="${esc(roles)}">
  <div class="shot">${thumb}</div>
  <div class="meta"><code>${esc(e.route)}</code><span class="slug">${esc(e.module)} · ${esc(e.slug)}</span></div>
  <div class="badges">${badges}</div>
  ${renderReasons([...e.denied, ...e.unavailable])}
</article>`;
}

/** Render the whole sitemap as one self-contained HTML document. Pure. */
export function renderSitemap(entries: SitemapEntry[]): string {
  const sections = new Map<string, SitemapEntry[]>();
  for (const e of [...entries].sort((a, b) => a.route.localeCompare(b.route))) {
    const key = sectionOf(e.route);
    sections.set(key, [...(sections.get(key) ?? []), e]);
  }
  const captured = entries.filter((e) => e.baselineImage).length;
  const unreachable = entries.filter((e) => !e.baselineRole).length;
  const variants = entries.reduce((n, e) => n + e.variants.length, 0);

  const body = [...sections.entries()]
    .map(
      ([name, list]) =>
        `<section><h2>${esc(name)} <span class="count">${list.length}</span></h2>
<div class="grid">${list.map(renderCard).join("")}</div></section>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Carmen Blue · Sitemap</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{--bg:#fff;--fg:#111;--muted:#666;--line:#e5e5e5;--card:#fafafa}
@media(prefers-color-scheme:dark){:root{--bg:#111;--fg:#eee;--muted:#999;--line:#333;--card:#1a1a1a}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 ui-sans-serif,system-ui,sans-serif}
header{position:sticky;top:0;background:var(--bg);border-bottom:1px solid var(--line);padding:12px 20px;z-index:2}
h1{font-size:16px;margin:0 0 8px}
.stats{color:var(--muted);font-size:12px}
input{width:280px;padding:6px 10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg)}
section{padding:16px 20px;border-bottom:1px solid var(--line)}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:0 0 12px}
.count{background:var(--card);border-radius:10px;padding:1px 7px;font-size:11px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:8px;overflow:hidden}
.shot{aspect-ratio:16/10;overflow:hidden;background:var(--bg);border-bottom:1px solid var(--line)}
.shot img{width:100%;height:100%;object-fit:cover;object-position:top left;display:block}
.no-shot{display:grid;place-items:center;height:100%;color:var(--muted);font-size:12px}
.shot img,a.b.var{cursor:zoom-in}
/* Lightbox: opens fit-to-screen, a second click on the image switches to
   100% so fine print is readable; the image is then scrollable. */
#lb{position:fixed;inset:0;background:rgba(0,0,0,.88);display:none;place-items:center;z-index:10;padding:28px}
#lb.on{display:grid}
#lb img{max-width:100%;max-height:100%;object-fit:contain;cursor:zoom-in;box-shadow:0 8px 40px rgba(0,0,0,.6)}
#lb.full{place-items:start;overflow:auto;padding:0}
#lb.full img{max-width:none;max-height:none;cursor:zoom-out;box-shadow:none}
#lb .cap{position:fixed;top:10px;left:14px;right:14px;color:#fff;font:12px ui-monospace,SFMono-Regular,monospace;text-shadow:0 1px 4px #000;pointer-events:none}
#lb .hint{position:fixed;bottom:10px;left:14px;color:#bbb;font-size:11px;text-shadow:0 1px 4px #000;pointer-events:none}
.meta{padding:8px 10px 4px}
.meta code{font-size:11px;word-break:break-all;display:block}
.slug{color:var(--muted);font-size:11px}
.badges{padding:4px 10px 10px;display:flex;flex-wrap:wrap;gap:4px}
.b{font-size:10px;padding:1px 6px;border-radius:9px;border:1px solid var(--line);text-decoration:none;color:var(--fg)}
.base{background:#2563eb;color:#fff;border-color:#2563eb}
.var{background:#16a34a;color:#fff;border-color:#16a34a}
.denied{color:#b91c1c;border-color:#b91c1c}
.na{color:var(--muted)}
.reasons{margin:0;padding:0 10px 10px 24px;color:var(--muted);font-size:10px;line-height:1.45}
.reasons li{margin:0;word-break:break-word}
.hidden{display:none}
</style></head><body>
<header>
<h1>Carmen Blue · Sitemap</h1>
<div class="stats">${entries.length} screens · ${captured} captured · ${variants} role variants · ${unreachable} unreachable</div>
<div style="margin-top:8px"><input id="q" type="search" placeholder="filter by route or role..."></div>
</header>
${body}
<div id="lb"><div class="cap"></div><img alt=""><div class="hint">click image to zoom 1:1 · click outside or Esc to close</div></div>
<script>
const lb = document.getElementById("lb");
const lbImg = lb.querySelector("img");
const lbCap = lb.querySelector(".cap");

function openLightbox(src, label) {
  lbImg.src = src;
  lbImg.alt = label;
  lbCap.textContent = label;
  lb.classList.add("on");
  lb.classList.remove("full");
}
function closeLightbox() {
  lb.classList.remove("on", "full");
  lbImg.removeAttribute("src");
}

document.addEventListener("click", (e) => {
  const thumb = e.target.closest(".shot img");
  if (thumb) { openLightbox(thumb.getAttribute("src"), thumb.getAttribute("alt")); return; }
  // Role-variant badges link to their own PNG; open them in the same viewer
  // rather than navigating away from the sitemap.
  const variant = e.target.closest("a.b.var");
  if (variant) {
    e.preventDefault();
    const route = variant.closest(".card").dataset.route;
    openLightbox(variant.getAttribute("href"), route + "  —  " + variant.textContent.trim());
  }
});

lb.addEventListener("click", (e) => {
  // Clicking the image toggles fit-to-screen vs 1:1; anywhere else closes.
  if (e.target === lbImg) { lb.classList.toggle("full"); lb.scrollTop = 0; return; }
  closeLightbox();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeLightbox(); });

document.getElementById("q").addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase();
  for (const card of document.querySelectorAll(".card")) {
    const hay = (card.dataset.route + " " + card.dataset.roles).toLowerCase();
    card.classList.toggle("hidden", q !== "" && !hay.includes(q));
  }
  for (const s of document.querySelectorAll("section")) {
    s.classList.toggle("hidden", s.querySelectorAll(".card:not(.hidden)").length === 0);
  }
});
</script>
</body></html>
`;
}

function main(): void {
  const assetsDir =
    process.env.WIKI_ASSETS_DIR ?? "../carmen-wiki/assets/screenshots/inventory";
  const outPath = process.env.WIKI_SITEMAP_PATH ?? "../carmen-wiki/sitemap.html";
  const htmlDir = dirname(outPath);
  const matrix = loadRoleMatrix(ROLE_MATRIX_PATH);

  // Routes present in the router but absent from the manifest still deserve a
  // card — otherwise a new page would be invisible in the sitemap. Optional on
  // purpose: pass 3 must not throw, and the frontend checkout may simply not be
  // there (ENOENT) when someone renders the sitemap from the matrix alone.
  const frontendDir = process.env.E2E_FRONTEND_DIR ?? "../carmen-inventory-frontend-react";
  const known = new Set(SHOTS.map((s) => s.path));
  let extra: ShotSpec[] = [];
  try {
    extra = discoverFrontendRoutes(frontendDir)
      .filter((r) => !known.has(r))
      .map((r) => ({ path: r, module: r.split("/").filter(Boolean)[0] ?? "root", slug: "unmapped" }));
  } catch (err) {
    console.warn(
      `Route discovery skipped (${(err as Error).message}). ` +
        `Sitemap will show manifest routes only — set E2E_FRONTEND_DIR to include unmapped ones.`,
    );
  }

  const entries = buildEntries([...SHOTS, ...extra], matrix, assetsDir, htmlDir, existsSync);
  mkdirSync(htmlDir, { recursive: true });
  writeFileSync(outPath, renderSitemap(entries));
  console.log(`Wrote ${outPath} (${entries.length} screens)`);
}

// @ts-expect-error import.meta.main is a Bun-specific CLI guard; tsc uses commonjs module mode
if (import.meta.main) main();
