# E2E Inventory Adjustment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the IA doc flow (730) into the main suite on TEST BU as `731`, and add `732`, which asserts the stock and cost outcomes of Stock In / Stock Out commit and void.

**Architecture:** The user path runs in the browser. Outcomes are read through the API with `tests/helpers/bu-api.ts` as Admin. Guards the UI cannot reach (parallel commit, out-of-period dates, completed-document writes, void of consumed stock) call the API only. A new `ia` data-reset step gives 732 two products that no other spec touches.

**Tech Stack:** Playwright + TypeScript (bun), main `chromium` project, backend gateway on :4000 (shared dev DB).

**Spec:** `docs/superpowers/specs/2026-11-23-e2e-inventory-adjustment-design.md`

## Global Constraints

- The deliverable is new tests (user approved the design, 2026-11-23):
  - `tests/731-inventory-adjustment.spec.ts`
  - `tests/732-inventory-adjustment-stock.spec.ts`
  - the helper, page object, `ia` data-reset step and `unit/**` tests named here
  - deleting `tests/730-inventory-adjustment-doc-flow.spec.ts`

  Create only the files this plan names.
- Everything runs on **TEST BU `GR2VYNKQ` as Admin**.
  - Never touch CARMEN-AVG / FIFO.
  - Never close a period. Never set `E2E_ALLOW_IRREVERSIBLE`.
  - Do not modify `tests/helpers/movement/*`: the 9xx period-close specs use it.
- New spec names must **not** end in `-doc-flow.spec.ts`. `playwright.config.ts` drops those from `chromium`.
- Stock assertions are **deltas** of live values read just before and after. Never assert absolute values.
- Cleanup: `afterAll` voids every document the spec committed (Stock Outs first, then Stock Ins) and deletes its drafts. Cleanup reads state from the API, and cleanup failures throw.
- Failure policy is unchanged.
  - Suspected bug → `test.fail(true, "suspected bug: …")` **after setup**. Put guards before it that the BE really answered (not 401, status < 500). Add a row to `docs/superpowers/specs/2026-11-23-e2e-inventory-adjustment-bug-list.md`.
  - Product question → a `"needs product decision: …"` pin, listed in the same file's section 2.
- User rulings (2026-11-23):
  - Negative qty, negative cost, or a qty-0 line accepted on commit → **suspected bug**.
  - A voided document disappearing (detail 404, missing from the Voided filter) → **suspected bug**.
- No visibility-based skips, no new `fixme`, no `waitForTimeout`, no `.catch(() => null)`.
  - UI outcome waits use `expectBlocked` / `expectRefused` / `expectSaved` from `tests/helpers/settle.ts`.
  - A data guard **fails loudly** with a reason. It is never a skip.
- Annotations and audits:
  - Every case carries all 5 annotations, and the CLAUDE.md pre/exp audit prints nothing.
  - `bun audit:tc-ids` passes and `bun test:unit` is green.
  - Regenerate `bun docs:user-stories` in the same commit. Restore footer-only changes in other story files.
- TC-IDs: prefix `IADJ`.
  - 731 keeps `TC-IADJ-70xxxx` (Stock In) and `TC-IADJ-71xxxx` (Stock Out) exactly as 730 had them.
  - 732 uses `80` (Stock In stock), `81` (Stock Out stock) and `82` (void outcome).
- Locators: `getByRole` first, `data-slot` when ambiguous. Page objects expose locator factories.
- Running:
  - `workers: 1`, `retries: 0`. Run with `bun run test -- --project=chromium <spec>`.
  - `data:reset --yes` needs `NODE_EXTRA_CA_CERTS` pointing at the CA chain in the session scratchpad. Never commit that path.
- Git:
  - Commits in Thai, PR text in English, merge commits only. No push or merge without the user.
  - Branch `test/e2e-inventory-adjustment` (exists, spec committed at 5ebcac8). One PR.
  - Stage by explicit path. Never stage `.trail/hook.cjs` or the deleted tooling files. Run `git restore tests/results` before handing off. Run `trail check` before the PR.

## Review Focus

1. **Re-run without reset:** 731 and 732 pass twice in a row with no `data:reset` between. Expected costs come from live reads, so leftover layers from run 1 must not break run 2. Owned by Tasks 3–5, whose run steps run twice.
2. **Parallel commit without `doc_version`:** two simultaneous commits that both omit `doc_version` must still post once. This is the case most likely to find a real double-post. Owned by Task 4 (TC-IADJ-800004) and Task 5 (TC-IADJ-810005).
3. **Cleanup after a mid-case failure:** a case that committed and then failed must still have its stock reversed by `afterAll`. Owned by Task 2 (`cleanupIaRun` lists the run's documents by description tag from the API) and checked after Task 5's second run.
4. **Whole-document shortage:** two lines of the same product, each covered alone but over on-hand together, must be refused. Owned by Task 5 (TC-IADJ-810003).
5. **Stock In void after partial issue:** void must be refused even when current on-hand covers it but an issue in between drew the balance down. Owned by Task 4 (TC-IADJ-800006).

---

### Task 1: `ia` data-reset step

**Files:**
- Create: `scripts/data-reset/docs/ia.ts`
- Modify:
  - `scripts/data-reset/docs/seed-all.ts`: add step `ia` after `pos`.
  - `scripts/data-reset/verify-dataset.ts`: add rows `ia.products` and `ia.no-stock`.
  - `scripts/data-reset/README.md`: add step 7c.
- Test: `unit/data-reset/ia.test.ts`

**Interfaces:**
- Consumes: `SeedContext` (`ctx.products[0]` as the template for category and unit; `ctx.locations.first`), `RowLedger`, and the product-location link pattern of `docs/stock.ts:60`.
- Produces:
  - Products with codes `E2E-IA-A` and `E2E-IA-B`, created when missing (idempotent by code) through `POST /api/config/:bu/products`.
    - Read the create DTO in `../carmen-turborepo-backend/apps/backend-gateway/src/` for the required fields. Copy category / sub-category / item group / inventory unit from `ctx.products[0]`.
    - Link both products to `ctx.locations.first` only. Create **no** stock-in.
  - `export function planIa(ctx: SeedContext): IaPlan` (pure). `IaPlan = { products: Array<{ code: string; name: string; templateId: string }>; locationId: string }`.
  - `export async function seedIa(sessions, cfg, ctx, ledger): Promise<StepResult>`.

- [ ] **Step 1:** Write `unit/data-reset/ia.test.ts`. Assert:
  - `planIa` returns codes `["E2E-IA-A", "E2E-IA-B"]`, `templateId === ctx.products[0].id` and `locationId === ctx.locations.first`.
  - It throws when `ctx.products` is empty.
- [ ] **Step 2:** `bun test:unit unit/data-reset/ia.test.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement `ia.ts`. Wire it into `seed-all.ts` after `pos`. Add the verify rows:
  - `ia.products`: both codes exist.
  - `ia.no-stock`: on-hand of each at `locations.first` is 0, via `GET /api/:bu/inventory-info/:productId/:locationId`.

  Add README step 7c.
- [ ] **Step 4:** `bun test:unit` → PASS.
- [ ] **Step 5:** `NODE_EXTRA_CA_CERTS=<chain> bun run data:reset --yes` → `ia` shows 0 failed and the verify short list is empty.
- [ ] **Step 6:** Commit `test(data-reset): เพิ่มขั้น ia — สินค้า E2E-IA-A/B ไม่มีสต๊อกตั้งต้นสำหรับเทสต้นทุน`.

### Task 2: IA API helper, cost oracle, page object

**Files:**
- Create:
  - `tests/helpers/ia-api.ts`
  - `tests/helpers/ia-cost.ts`
  - `tests/pages/inventory-adjustment.page.ts`
- Test: `unit/helpers/ia-cost.test.ts`

**Interfaces:**
- Consumes: `buSend` / `buGet` (`tests/helpers/bu-api.ts`) as `"Admin"`. Gateway routes `api/:bu/stock-ins|stock-outs`: `POST /`, `GET /:id`, `PATCH /:id/save`, `PATCH /:id/commit`, `DELETE /:id`, `DELETE /:id/void`, `GET /:id/stock-movements`, `GET /?filter=`. Also `GET /inventory-info/:productId/:locationId?at_date=` (as in `pos-api.ts:78`).
- Produces (`ia-api.ts`):
  - `type IaType = "stock-in" | "stock-out"`
  - `createIa(type, body: { date: string; locationId: string; adjustmentTypeId: string; description: string; lines: Array<{ productId: string; qty: number; cost?: number }> }): Promise<ApiResult>`
    - Field names follow the BE DTO (`si_date` / `so_date`, `stock_in_detail` / `stock_out_detail`, `cost_per_unit`).
  - `commitIa(type, id, docVersion?: number)`, `voidIa(type, id, reason)`, `deleteIa(type, id)`, `updateIa(type, id, body)`, `getIa(type, id)`, `movementsOf(type, id)`.
  - `listIa(type, opts: { status?: string; search?: string })`.
  - `stockAt(productId, locationId, atDate): Promise<{ qty: number; value: number }>`. Read qty and total value (or avg cost × qty) from `inventory-info`. If the endpoint exposes no value, compute it from the product's cost layers and record which source you used in a code comment.
  - `calcMethod(): Promise<"average" | "fifo">`. Read it from the BU's inventory config. Find the endpoint the FE's settings page uses.
  - `IA_TAG = "E2E-IA"`. Every document a spec creates has a description that starts with `${IA_TAG} <spec>`.
  - `cleanupIaRun(spec: "731" | "732"): Promise<void>`. List both types by description tag. Void the completed ones (stock-outs first), then delete the drafts. Throw on any failure.
  - `assertIaReady(): Promise<{ productA; productB; locationId; adjustmentTypeIn; adjustmentTypeOut; today }>`. It fails with a named reason when the `ia` products are missing, when Admin lacks permission (first GET 403), or when no open period contains today.
- Produces (`ia-cost.ts`, pure):
  - `expectedIssueCost(layers: Array<{ qty: number; cost: number }>, issueQty: number, method: "average" | "fifo"): number`
    - average: `issueQty × (Σqty·cost / Σqty)`.
    - fifo: consume layers in the given order.
    - Throws when `issueQty > Σqty`.
    - Round to 2 decimals only at the end. The oracle must not hide the BE's rounding.
- Produces (page object): `InventoryAdjustmentPage` with factories `description()`, `location()`, `reason()`, `addItem()`, `lineQty(i)`, `lineCost(i)`, `grandTotal()`, `saveButton()`, `commitButton()`, `voidButton()`, `deleteButton()`, plus `gotoNew(type)` and `gotoDoc(type, id)`. Port the selectors 730 uses from `tests/helpers/movement/ui.ts` by copying them. Do not import from `movement/`.

- [ ] **Step 1:** Write `unit/helpers/ia-cost.test.ts`.
  - average: `[{qty:10,cost:10},{qty:10,cost:20}]`, issue 5 → `75`.
  - fifo: same layers, issue 15 → `200` (10×10 + 5×20).
  - fifo: issue 10 → `100`.
  - Issue 21 throws.
  - average with costs `[{qty:3,cost:10},{qty:3,cost:10.01}]`, issue 1 → `10.01` (rounded only at the end; 10.005 rounds up).
- [ ] **Step 2:** `bun test:unit unit/helpers/ia-cost.test.ts` → FAIL.
- [ ] **Step 3:** Implement the three files.
- [ ] **Step 4:** `bun test:unit` → PASS. `bunx tsc --noEmit` is clean.
- [ ] **Step 5:** Commit `test(ia): helper API ของ Stock In/Out, oracle ต้นทุน และ page object`.

### Task 3: `731-inventory-adjustment.spec.ts` (port of 730) + delete 730

**Files:**
- Create: `tests/731-inventory-adjustment.spec.ts`
- Delete: `tests/730-inventory-adjustment-doc-flow.spec.ts`, plus its generated `docs/user-stories/730-*.md` if one exists
- Modify:
  - `docs/test-id-scheme.md`: the 730 row becomes 731, and add a 732 row with sections 80/81/82.
  - `docs/test-cases/gaps/730-inventory-adjustment-gap.md`: point the header at 731/732. Mark the rows 731/732 now cover.
  - `scripts/generate-user-stories.ts`, only where it names 730.

**Interfaces:**
- Consumes: Task 2 (`assertIaReady`, `createIa` / `getIa` / `listIa`, `cleanupIaRun("731")`, `InventoryAdjustmentPage`).

Port all 16 tests of 730 with the **same TC-IDs, titles and intent**: TC-IADJ-700001… Stock In and 710001… Stock Out. Each case keeps the same flow: open form → draft → view → edit (description + qty/cost + remove B, re-add B) → delete → new + Commit. Changes from 730:
- Use the main `test` fixture, Admin on TEST BU, `locationId` and products from `assertIaReady()`. Use `E2E-IA-A` / `E2E-IA-B` in place of A / B.
- Replace the `todayInActivePeriod` skip with `assertIaReady()`, which fails loudly.
- Keep the two pins with unchanged reasons: TC-IADJ-710003 (FE-5, estimated cost 0.00) and TC-IADJ-710004 (FE-4, Total NaN).
- Keep the FE-6 check in TC-IADJ-700001 (no Permission Denied).
- Drop the cost-estimator 422 `signals.minor` unless it still fires on TEST BU. If it does, keep it with the same reason.
- The Stock In commit must commit enough qty for the Stock Out commit. `afterAll` → `cleanupIaRun("731")`.

- [ ] **Step 1:** Write 731 and delete 730.
- [ ] **Step 2:** `bun run test -- --project=chromium tests/731-inventory-adjustment.spec.ts`.
  - Expected: 14 pass and 2 pinned (`test.fail` passes as expected).
  - Any other failure is classified per the policy, with a bug-list row. Create the bug list file with sections 1 (suspected bugs), 2 (product decisions) and 3 (not testable).
- [ ] **Step 3:** Run again with no reset → same result. After it, `listIa(*, {search: "E2E-IA 731"})` shows no completed documents.
- [ ] **Step 4:** `E2E_MOVEMENT=1 bunx playwright test --project=movement --list` no longer lists any IA spec.
- [ ] **Step 5:** Audits + `bun docs:user-stories`.
- [ ] **Step 6:** Commit `test(731): ย้ายวงจรเอกสาร Inventory Adjustment จาก 730 มาชุดหลักบน TEST BU`.

### Task 4: 732 — Stock In outcomes (IADJ 80)

**Files:**
- Create: `tests/732-inventory-adjustment-stock.spec.ts`
- Modify: the bug list

Setup: `beforeAll` calls `ctx = await assertIaReady()` and `method = await calcMethod()`. `afterAll` calls `cleanupIaRun("732")`. Each case reads `stockAt` before it acts.

Cases (oracle = design §"732 cases" and "Builder check answers"):
- `TC-IADJ-800001` **Commit (UI)**: Stock In `E2E-IA-A` qty 10 cost 12.50 at `ctx.locationId`, dated today, then Commit + confirm.
  - On-hand Δ = +10 and value Δ = +125.00.
  - `movementsOf` has 1 line with cost 12.50. Status `completed`.
  - Reopened in the UI, the form is read-only (no Save / Commit button).
- `TC-IADJ-800002` **Date outside every open period (API)**: date = the day before the earliest open period's start.
  - `createIa` or `commitIa` answers 4xx with `STOCK_IN_DATE_OUTSIDE_OPEN_PERIOD`, and nothing is committed.
  - Guard: no open period known → fail with a reason.
- `TC-IADJ-800003` **Commit twice, sequentially (API)**: the second commit is refused (`STOCK_IN_ONLY_DRAFT_COMMITTABLE`). `movementsOf` count = line count, and on-hand Δ = qty once.
- `TC-IADJ-800004` **Parallel commit**: two `Promise.all` pairs.
  - (a) both with the same `doc_version`.
  - (b) both without `doc_version`.
  - Each gives one posting: on-hand Δ = qty once and movement count = line count.
  - If (b) double-posts → `test.fail` "suspected bug: parallel commit without doc_version posts twice (status check outside the transaction, stock-in.service.ts:706-710)".
- `TC-IADJ-800005` **Void untouched**: commit, then `voidIa`. On-hand and value Δ return to 0 against the pre-commit read.
- `TC-IADJ-800006` **Void after partial issue**: Stock In 10 today, then Stock Out 4 today, both committed. Then `voidIa` the Stock In:
  - It is refused (`STOCK_IN_VOID_INSUFFICIENT_STOCK`) and on-hand is unchanged.
- `TC-IADJ-800007` **Bad values (API)**: three drafts, each committed.
  - qty −1 → refused. Negative-qty pin: "suspected bug: negative Stock In qty accepted (acts as an unchecked stock out)".
  - cost −5 → refused. Pin: "suspected bug: negative cost accepted".
  - A qty-0 line → refused. Pin: "suspected bug: qty 0 line accepted on commit".

  Split it into three tests (800007/800008/800009) so each pin stands alone.
- `TC-IADJ-800010` **Later period held (AVG only)**: when `method === "average"` and a pre-generated period after the current one exists, a Stock In dated on its first day commits `completed`, and on-hand at that date and today is unchanged.
  - When `method === "fifo"`, assert instead that the commit posts the movement.
  - When no later period exists, fail with a reason.

- [ ] **Step 1:** Write group 80.
- [ ] **Step 2:** `bun run test -- --project=chromium tests/732-inventory-adjustment-stock.spec.ts` → classify each failure; add bug-list rows for pins.
- [ ] **Step 3:** Run again with no reset → same result.
- [ ] **Step 4:** Audits + `bun docs:user-stories`.
- [ ] **Step 5:** Commit `test(732): Stock In — commit ลงสต๊อกและต้นทุน, กันกดซ้ำ/พร้อมกัน, void, ค่าติดลบ`.

### Task 5: 732 — Stock Out outcomes (IADJ 81), void outcome (IADJ 82) + close

**Files:**
- Modify:
  - `tests/732-inventory-adjustment-stock.spec.ts`
  - the bug list
  - `docs/test-cases/COVERAGE.md`
  - `docs/test-cases/SPEC-HEALTH.md`
  - the regenerated `docs/user-stories/73{1,2}-*.md`

Every Stock Out case first commits its own Stock In of `E2E-IA-B` (two layers: qty 10 @ 10.00, then qty 10 @ 20.00). It then reads the live layers, so `expectedIssueCost(layers, qty, method)` gives the oracle.

Cases:
- `TC-IADJ-810001` **Commit (UI)**: Stock Out qty 15, then Commit + confirm.
  - On-hand Δ = −15.
  - Issue cost on the movement = `expectedIssueCost`. Value Δ = −that cost.
  - The form's estimated total before Commit equals the same number (±0.01).
- `TC-IADJ-810002` **Over on-hand**: qty = live on-hand + 1.
  - Commit refused `STOCK_OUT_INSUFFICIENT_STOCK`, and the response names `E2E-IA-B`.
  - On-hand is unchanged and the document is still `draft`.
  - In the UI, the error is shown and the page stays on the form.
- `TC-IADJ-810003` **Whole-document shortage (API)**: two lines of `E2E-IA-B`, each qty = ⌈on-hand/2⌉ + 1.
  - Refused `STOCK_OUT_INSUFFICIENT_STOCK` and on-hand is unchanged.
- `TC-IADJ-810004` **Other period (API)**: `so_date` in an open period other than the current one, or else before the earliest open one.
  - Refused with `STOCK_OUT_DATE_NOT_CURRENT_PERIOD` or `STOCK_OUT_NO_OPEN_PERIOD`.
  - No such date → fail with a reason.
- `TC-IADJ-810005` **Commit twice**: sequential, then parallel (a) same `doc_version` and (b) none.
  - On-hand Δ = −qty once each time. Pin (b) as in 800004 if it double-deducts.
- `TC-IADJ-810006` **Void committed Stock Out**: on-hand Δ and value Δ return to 0 against the pre-commit read. That means it was restored at the issued cost.
- `TC-IADJ-810007` **Completed is locked (API)**: `updateIa` → `STOCK_OUT_COMPLETED_NO_UPDATE`, `deleteIa` → `STOCK_OUT_COMPLETED_NO_DELETE`. Then a second `voidIa` after a void → 4xx.
- `TC-IADJ-820001` **Voided Stock In stays visible**: commit + void a Stock In. Then expect:
  - `getIa` → 200 with `doc_status === "voided"`.
  - `listIa("stock-in", {status: "voided"})` contains it.
  - In the UI, the list's Voided filter shows its number.
  - Pinned after the void succeeds: `test.fail(true, "suspected bug: void soft-deletes the document (stock-in.service.ts:1889-1900) — user ruled 2026-11-23 that a voided document must stay visible")`.
- `TC-IADJ-820002` **Voided Stock Out stays visible**: same as 820001 for a Stock Out, with the same pin.

- [ ] **Step 1:** Write groups 81 and 82.
- [ ] **Step 2:** Run 731 and 732 together twice with no reset between: `bun run test -- --project=chromium tests/731-inventory-adjustment.spec.ts tests/732-inventory-adjustment-stock.spec.ts`.
  - Every case passes or is pinned with a bug-list row.
  - After the second run, `listIa(*, {search: "E2E-IA"})` shows no completed document. Every committed one was voided by cleanup (Review Focus 3).
- [ ] **Step 3:** Fill in the bug list. Each pin gets spec, TC-ID, what happens vs expected, and repro. Section 3 lists:
  - void in a closed period
  - costing on the other method, since only TEST BU's own method is exercised
  - the list-page UI cases still in the gap report
- [ ] **Step 4:** Run `bun audit:coverage`, `bun audit:spec-health`, `bun audit:tc-ids`, the pre/exp audit, `bun docs:user-stories` and `bun test:unit`, then `git restore tests/results`.
- [ ] **Step 5:** Commit `test(732): Stock Out — ตัดสต๊อกตามวิธีคิดต้นทุน, ของขาด, กันกดซ้ำ, void + bug list และรายงาน coverage`.
