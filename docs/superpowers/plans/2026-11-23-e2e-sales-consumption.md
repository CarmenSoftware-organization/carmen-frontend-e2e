# E2E — Sales Consumption + Import POS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cover Import POS (Simphony) and Sales Consumption on TEST BU with e2e specs that assert stock outcomes (Stock Outs per location, on-hand deltas, SC status) through the API.

**Architecture:** `data:reset` gains a `pos` step (Simphony switched on, ingredient stock dated the first day of the open period, two recipes). Specs build Simphony files in memory, upload them through the Import POS page, map / verify / post / void on the SC pages, and read outcomes with a new `tests/helpers/pos-api.ts`. Each spec owns a store key and a fixed set of sale days and cleans up (void posted SC → cancel imports) in `afterAll`.

**Tech Stack:** Playwright (workers 1), TypeScript, Bun, vitest (`unit/**`), dev backend via `:4000` → shared dev DB.

**Spec:** `docs/superpowers/specs/2026-11-23-e2e-sales-consumption-design.md` — read "Environment facts", "Cases" and "Builder check answers". Feature under test: `../carmen-frontend/docs/superpowers/specs/2026-10-26-sales-consumption-design.md` (its §4.2 is the oracle for every expected value).

## Global Constraints

- The deliverable is new tests: `tests/140-import-pos.spec.ts`, `tests/141-sales-consumption.spec.ts`, their helpers/page objects, the `pos` data-reset step and `unit/**` tests named here (user approved the design, 2026-11-23). Create only the files this plan names.
- **Simphony only** (user). Micros 3700 only via its `check` endpoint.
- Irreversible actions (post, void, cancel import) **only on TEST BU `GR2VYNKQ`**. Never close a period. Never set `E2E_ALLOW_IRREVERSIBLE`.
- Stock assertions are **deltas** of live on-hand read before and after (`inventory-info/:productId/:locationId?at_date=`), never absolute values.
- A spec never leaves a **posted** SC behind: `afterAll` voids every SC it posted, then cancels every import it made; cleanup failures throw.
- Failure policy (Phase 1, policy ข): intentional change → update + cite the FE/BE commit · suspected bug → `test.fail(true, "suspected bug: …")` **after setup**, with guards that the BE really answered (not 401, status < 500) placed before it, plus a row in `docs/superpowers/specs/2026-11-23-e2e-sales-consumption-bug-list.md` · product question → `"needs product decision: …"` pin in the same file's section 2.
- No visibility-based skips, no new `fixme`, no `waitForTimeout`, no `.catch(() => null)`. UI outcome waits use `expectBlocked` / `expectRefused` / `expectSaved` from `tests/helpers/settle.ts`. Data guards (`test.skip(cond, reason)`) only where the spec allows (calendar "No file" early in the month).
- Every case carries all 5 annotations; the CLAUDE.md pre/exp audit prints nothing; `bun audit:tc-ids` passes; `bun docs:user-stories` regenerated in the same commit (restore footer-only changes in other story files); `bun test:unit` green.
- TC-IDs: `TC-IPOS-GGNNNN` for 140 and `TC-SC-GGNNNN` for 141 (GG = group, NNNN = case). Add both rows to `docs/test-id-scheme.md`.
- Locators: `getByRole` first, `data-slot` when ambiguous; page objects expose locator factories, not stored locators.
- `workers: 1`, `retries: 0`. Run with `bun run test -- --project=chromium <spec>` (never plain `bun run test`). `data:reset --yes` needs `NODE_EXTRA_CA_CERTS` pointing at the CA chain in the session scratchpad — never commit it.
- Commits in Thai, PR text in English, merge commits only, no push/merge without the user. Branch `test/e2e-sales-consumption` off `main`; one PR.
- Stage files by explicit path. Never stage `.trail/hook.cjs` or the deleted tooling files. Run `git restore tests/results` before handing off.

## Review Focus

1. **Re-run without reset:** both specs pass twice in a row with no `data:reset` between (cancelled imports free the store+date for reuse). Owned by Tasks 4–6: each verification step runs its spec twice.
2. **POS not ready:** a run on a BU without the licence or without Simphony enabled must fail in `beforeAll` with a message naming the missing setup (`assertPosReady()`), not with a toast timeout. Owned by Task 2.
3. **Sale day outside the open period:** day allocation must never produce a date outside the open period, nor today for the "No file" case. Owned by Task 2 unit tests (`pos-days.test.ts`).
4. **Parallel post:** two simultaneous `POST …/post` with the same `doc_version` yield exactly one set of Stock Outs. Owned by Task 5 (TC-SC-050002).
5. **Cleanup after a failed case:** a case that fails mid-way (posted, not voided) must still be cleaned up by `afterAll`. Owned by Task 2 (`cleanupPosRun` reads state from the API, not from in-memory flags) and checked in Task 6's second run.

---

### Task 1: `pos` data-reset step

**Files:**
- Create: `scripts/data-reset/docs/pos.ts`
- Modify: `scripts/data-reset/docs/seed-all.ts` (add step `pos` after `stock`), `scripts/data-reset/verify-dataset.ts` (new expected rows), `scripts/data-reset/README.md` (new step 7b)
- Test: `unit/data-reset/pos.test.ts`

**Interfaces:**
- Consumes: `SeedContext` (`ctx.products`, `ctx.locations`, `ctx.adjustmentTypeId`), `createDoc` / `transition` / `why` from `./transition`, `RowLedger`.
- Produces (fixed names the specs read through the API):
  - app-config `interface_pos_simphony` = `{ enabled: true }` via `PUT /api/config/:bu/app-config/interface_pos_simphony` (same pattern as `gl_setting` in `accounting.ts:110`; read the current row first and keep unknown fields).
  - recipes `E2E-POS-A` (ingredients: product P1 × 2, P2 × 1) and `E2E-POS-B` (P3 × 1, P4 × 3), P1–P4 = the **last four** of `ctx.products` (check no other `docs/*` step uses them; if one does, move to the nearest unused four and note it in the README). Units = the product's inventory unit.
  - committed stock-ins (adjustment type = `ctx.adjustmentTypeId`, `si_date` = **first day of the open inventory period**, note `STD pos.stock.l1` / `STD pos.stock.l2`): P1–P4 qty 500 cost 10 at `locations.first`, qty 500 cost 10 at `locations.second`. Link P1–P4 to both locations first, like `seedStock`.
  - `export function planPos(ctx: SeedContext, periodStart: string): PosPlan` (pure) and `export async function seedPos(sessions, cfg, ctx, ledger): Promise<StepResult>`.
- Recipe create body: read `../carmen-turborepo-backend/apps/backend-gateway/src/common/dto/recipe/recipe.create.dto.ts` + `recipe-ingredient.dto.ts` for required fields/state (category, cuisine, status). If a recipe the mapping later refuses is the only option, `seedPos` fails with that reason (Task 4 discovers it).

- [ ] **Step 1: Write `unit/data-reset/pos.test.ts`**: `planPos` returns two recipes named `E2E-POS-A` / `E2E-POS-B` with the ingredient qtys above; stock-in lines for the last four products at both locations, qty 500, `si_date === periodStart`; throws when `ctx.products.length < 4`.
- [ ] **Step 2:** `bun test:unit unit/data-reset/pos.test.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement `pos.ts`, wire it into `seed-all.ts` after `stock` (guarded like the others), add `verify-dataset` rows `pos.simphony-enabled`, `pos.recipes`, `pos.stock.l1`, `pos.stock.l2`, `adjustment.sale` (`GET /api/config/:bu/adjustment-types` contains code `SALE`), README step 7b.
- [ ] **Step 4:** `bun test:unit` → PASS (whole unit suite).
- [ ] **Step 5:** `NODE_EXTRA_CA_CERTS=<chain> bun run data:reset --yes` → summary shows `pos` with 0 failed and `verify` short list empty. Then `GET /api/GR2VYNKQ/pos-sales/status` (FC) → `enabled_brands` contains `simphony`; `GET …/pos-sales/sales-consumptions` → 200.
- [ ] **Step 6:** Commit `test(data-reset): เพิ่มขั้น pos — เปิด Simphony, recipe 2 ตัว และสต๊อกวัตถุดิบต้นงวด`.

### Task 2: Simphony fixture, POS API helper, day allocation

**Files:**
- Create: `tests/helpers/simphony-fixture.ts`, `tests/helpers/pos-api.ts`, `tests/helpers/pos-days.ts`
- Modify: `tests/helpers/bu-api.ts` (export a multipart sender)
- Test: `unit/simphony-fixture.test.ts`, `unit/pos-days.test.ts`

**Interfaces:**
- `buildSimphonyFile(input: { storeKey: string; storeName: string; businessDate: string /* YYYY-MM-DD */; version?: string; lines: SimphonyLine[] }): string` where `SimphonyLine = { outletCode: string; outletName: string; itemCode: string; itemName: string; deptCode: string; deptName: string; qty: number; total: number }`. Pipe-delimited, CRLF. Field positions are **1-based, counting the line-type column** (parser `field(fields, n)` = `split('|')[n-1]`): GLID — 1 `GLID`, 2 store key, 3 store name, 4 and 5 business date `YYYYMMDD`, 8 version (default `1.20`), 10/11 source text. MID — 1 `MID`, 2 outlet code, 4 item code, 5 item desc, 7 qty, 15 outlet name, 20 dept desc, 21 dept code, 33 total; pad to **40** fields. Codes ≤ 20 chars.
- `buSendForm(role: Role, path: string, form: FormData): Promise<ApiResult>` in `bu-api.ts` (same token / backend resolution as `buSend`, no JSON content-type).
- `pos-api.ts` (default role `"StoreManager"`; if it lacks `stock_out.create` / `stock_out.delete` on TEST BU, use `"Admin"` and note why in the helper):
  - `importSimphony(file: string, fileName: string): Promise<ApiResult>` → `POST /pos-sales/imports/simphony` field `file`
  - `cancelImport(id)`, `listImports()`, `listOutlets(storeId?)`, `listItems(storeId?, status?)`, `mapOutlet(id, locationId | null)`, `mapItem(id, { recipe_id?: string | null; is_ignored?: boolean })`
  - `scList({ date_from, date_to, status? })`, `scForDay(day): Promise<ScRow | null>` (non-voided), `scDetail(id)`, `scUpdateLines(id, body)`, `scVerify(id)`, `scPost(id, docVersion)`, `scVoid(id, reason, docVersion)`, `scCalendar(month /* YYYY-MM */)`
  - `onHand(productId, locationId, atDate): Promise<number>` → `GET /inventory-info/:productId/:locationId?at_date=` → `on_hand_qty`
  - `voidStockOut(id)` → `DELETE /stock-outs/:id/void`
  - `assertPosReady(): Promise<void>` — throws `"POS not ready on TEST BU: <reason>"` when status ≠ 200 or `enabled_brands` lacks `simphony` or recipe `E2E-POS-A` is missing.
  - `cleanupPosRun(storeKey: string): Promise<void>` — for every import of that store: if its day's SC is `posted` → void it (reason `e2e cleanup`), then cancel the import; throws on any non-2xx. Reads everything from the API.
- `pos-days.ts`: `saleDay(spec: 140 | 141, n: number, period: { start: string; end: string }): string` — 140 counts forward from `period.start`, 141 backward from `period.end`; throws when the day falls outside the period or the two specs' ranges would overlap (140 uses n ≤ 7, 141 uses n ≤ 10). `pastDays(period, today, count): string[] | null` — `count` distinct days strictly before yesterday, inside the period, not used by `saleDay`; `null` when the month is too young.

- [ ] **Step 1: Write unit tests.** `simphony-fixture.test.ts`: GLID line splits so `[1]` = store key, `[3]` = `[4]` = `20261105` for `2026-11-05`; every MID line has ≥ 40 fields, `[1]` outlet, `[3]` item, `[6]` qty, `[32]` total; a code > 20 chars throws. `pos-days.test.ts`: `saleDay(140, 1, Nov)` = `2026-11-01`, `saleDay(141, 1, Nov)` = `2026-11-30`, `saleDay(140, 8, …)` throws, ranges never overlap for a 28-day month; `pastDays` returns `null` on the 2nd of the month and never returns today or yesterday.
- [ ] **Step 2:** `bun test:unit` → the two new files FAIL.
- [ ] **Step 3:** Implement the three helpers and `buSendForm`.
- [ ] **Step 4:** `bun test:unit` → PASS. Then a one-off scratch script (not committed) imports one fixture file for a day `saleDay(140, 7, …)`, prints the import status (`success`) and the day's SC id, then `cleanupPosRun` → the import is cancelled and `scForDay` returns null.
- [ ] **Step 5:** Commit `test(helpers): ตัวสร้างไฟล์ Simphony, pos-api และการจัดวันขายของ spec POS`.

### Task 3: Page objects

**Files:**
- Create: `tests/pages/import-pos.page.ts`, `tests/pages/sales-consumption.page.ts`

**Interfaces (locator factories; read the FE components named for the real labels/roles):**
- `ImportPosPage` (`../carmen-frontend/routes/operation-plan/import-pos/`): `goto()`, `uploadButton(brand: "simphony" | "micros3700")`, `uploadSimphony(file: string, name: string)` (set the hidden file input from `pos-simphony-upload-button.tsx`), `historyRow(fileName)`, `rowStatus(fileName)`, `openLines(fileName)`, `rawLinesTable()`, `scLink(fileName)`, `cancelImport(fileName)`.
- `SalesConsumptionPage` (`routes/operation-plan/sales-consumption/`): list — `goto()`, `calendarDay(day)`, `dayStatus(day)`, `mappingTab()`, `outletRow(code)`, `setOutletLocation(code, locationName)`, `itemRow(code)`, `setItemRecipe(code, recipeName)`, `ignoreItem(code)`; detail — `gotoDetail(id)`, `verifyButton()`, `postButton()`, `voidButton()`, `salesLine(outletCode, itemCode)`, `setLineLocation(outletCode, itemCode, locationName)`, `setLineRecipe(outletCode, itemCode, recipeName, { setItemDefault })`, `ingredientGroup(locationName)`, `ingredientRowState(locationName, productName)` (OK / short), `lateLinesWarning()`, `stockOutLinks()`.
- Radix menus/selects: use the existing select helpers other page objects use (see `ap-invoice.page.ts`); coordinate clicks do not fire Radix `onClick`.

- [ ] **Step 1:** Implement both page objects.
- [ ] **Step 2:** `bunx tsc --noEmit -p .` → no errors.
- [ ] **Step 3:** Commit `test(pages): page object ของ Import POS และ Sales Consumption`.

### Task 4: `140-import-pos.spec.ts` (IPOS)

**Files:**
- Create: `tests/140-import-pos.spec.ts`
- Create: `docs/superpowers/specs/2026-11-23-e2e-sales-consumption-bug-list.md` (sections: 1 suspected bugs, 2 needs product decision, 3 not covered)
- Modify: `docs/test-id-scheme.md` (rows for 140 `IPOS` 01–03 and 141 `SC` 01–07), regenerated `docs/user-stories/140-import-pos.md`

Store key `E2E-140`; days `saleDay(140, 1..7)`. `beforeAll`: `assertPosReady()`, `cleanupPosRun("E2E-140")` (leftovers from a crashed run). `afterAll`: `cleanupPosRun("E2E-140")`.

Cases (title → assertion):
- **01 upload** — `TC-IPOS-010001` upload a valid file (day 1, 2 outlets × 2 items) through the page → history row status `success`, raw lines table shows every outlet/item/qty/amount from the fixture, no mapping/confirm button on the page, SC link opens the SC of day 1 (`scForDay` id matches URL). `TC-IPOS-010002` only enabled brands show an upload button (Simphony visible; Micros 3700 hidden — compare `GET /pos-sales/status`).
- **02 refusals** — `TC-IPOS-020001` same store + day again → API 201 with status `rejected_duplicate` and a history row for it (UI). `TC-IPOS-020002` empty file → 400 `POS_SALE_UNSUPPORTED_FILE` (API). `TC-IPOS-020003` GLID first date ≠ last date → `multi_day_glid_reject`. `TC-IPOS-020004` Micros `check` with lines of a Simphony file → refused (not 2xx).
- **03 cancel** — `TC-IPOS-030001` cancel the only import of a pending day (UI) → import `cancelled`, `scForDay(day)` null. `TC-IPOS-030002` day with a **posted** SC (map + verify + post via API, day 3) → cancel refused with `POS_SALE_IMPORT_HAS_CONFIRMED_LINES` (or the catalog code the BE returns; cite it), import stays live; `afterAll` voids + cancels.

- [ ] **Step 1:** Write the spec with all 5 annotations per case; add scheme rows.
- [ ] **Step 2:** `bun run test -- --project=chromium tests/140-import-pos.spec.ts` → classify each failure per the failure policy (fix the test for test bugs; pin suspected app bugs + bug-list row).
- [ ] **Step 3:** Run it a second time with no reset → same result (Review Focus 1).
- [ ] **Step 4:** `bun audit:tc-ids`, the pre/exp audit, `bun docs:user-stories` (restore footer-only changes elsewhere).
- [ ] **Step 5:** Commit `test(140): Import POS — อัปโหลด Simphony, ไฟล์ซ้ำ/ผิดรูปแบบ และยกเลิกการนำเข้า`.

### Task 5: `141-sales-consumption.spec.ts` — mapping, verify, post, guards (SC 01–05)

**Files:**
- Create: `tests/141-sales-consumption.spec.ts`
- Modify: the bug list from Task 4

Store key `E2E-141`; days `saleDay(141, n)`. Fixture outlets: `O1` (master → `locations.first`), `O2` (master → `locations.second`), `O9` (left unmapped where a case needs it). Items: `I1` → `E2E-POS-A`, `I2` → `E2E-POS-B`, `I8` (left unmapped), `I9` (ignored). Each case imports its own day, then maps the masters it does not test via `pos-api`. Expected ingredient qty = recipe qty × net qty (oracle: feature spec §4.2 "Post"). `beforeAll`/`afterAll` as in Task 4 with `E2E-141`.

Cases:
- **01 blocking** — `TC-SC-010001` an `I8` line (unmapped) → Post disabled (UI) and `scPost` refused `SALES_CONSUMPTION_HAS_UNRESOLVED_LINES`. `TC-SC-010002` an `O9` line (outlet without location) → Post disabled. `TC-SC-010003` map `I8` in the Mapping tab (UI) and `O9` → location → Verify enables, then Post enables. `TC-SC-010004` ignore `I9` in the Mapping tab on day n, import day n+1 with `I9` → its line is ignored without action; ignored and net-qty ≤ 0 lines (a refund line making net 0) contribute no ingredients.
- **02 overrides** — `TC-SC-020001` line `O1/I1` location set to `locations.second` on the detail page → after post its ingredients are in the `locations.second` Stock Out, not the first. `TC-SC-020002` change `O1` master location afterwards → the override line keeps `locations.second` (`scDetail`). `TC-SC-020003` per-line recipe change affects only that line; with "set as item default" ticked the master of the item changes and other non-overridden lines follow. `TC-SC-020004` posted SC: `scUpdateLines` refused `SALES_CONSUMPTION_LINE_POSTED` / `SALES_CONSUMPTION_NOT_PENDING`.
- **03 verify** — `TC-SC-030001` not verified → Post disabled and `scPost` refused `SALES_CONSUMPTION_NOT_VERIFIED`. `TC-SC-030002` verify → each ingredient row OK at its location; edit a line → `scPost` refused `SALES_CONSUMPTION_VERIFY_STALE` until re-verified.
- **04 post (stock)** — `TC-SC-040001` day with lines at both locations: read on-hand of P1–P4 at both locations (as of the sale day) → verify → Post (UI) → exactly 2 Stock Outs, adjustment type `SALE`, one per location, date = sale day, per-product qty = formula; on-hand deltas equal those qtys; SC `posted`. `TC-SC-040002` short at one location: sale qty of `I2` at `O2` = `ceil((onHand(P4, second) + 1) / 3)` → verify shows short at `locations.second` only; `scPost` refused `SALES_CONSUMPTION_VERIFY_FAILED` / `STOCK_OUT_INSUFFICIENT_STOCK` listing P4 at that location; **no** Stock Out exists for that SC and on-hand at both locations is unchanged.
- **05 double post** — `TC-SC-050001` second `scPost` after a successful post → refused, Stock Out count unchanged. `TC-SC-050002` two `scPost` in parallel (`Promise.all`, same `doc_version`) → exactly one 2xx and one set of Stock Outs.

- [ ] **Step 1:** Write groups 01–05.
- [ ] **Step 2:** `bun run test -- --project=chromium tests/141-sales-consumption.spec.ts` → classify failures per policy; bug-list rows for pins.
- [ ] **Step 3:** Run again with no reset → same result.
- [ ] **Step 4:** audits + `bun docs:user-stories`.
- [ ] **Step 5:** Commit `test(141): Sales Consumption — ผูกรายการ, verify, post ตัดสต๊อกตาม location และกันกดซ้ำ`.

### Task 6: 141 — void, late lines, calendar (SC 06–07) + close

**Files:**
- Modify: `tests/141-sales-consumption.spec.ts`, the bug list, `docs/test-cases/COVERAGE.md`, `docs/test-cases/SPEC-HEALTH.md`, regenerated `docs/user-stories/141-sales-consumption.md`

Cases:
- **06 void** — `TC-SC-060001` void a posted SC (UI, open period) → every Stock Out of it voided, on-hand back to the pre-post values (deltas 0), old SC `voided`, a new SC `pending` for the same day with the same line count. `TC-SC-060002` `voidStockOut` on a Stock Out from a posted SC → refused `STOCK_OUT_VOID_VIA_SALES_CONSUMPTION`, Stock Out still active. `TC-SC-060003` void when the period is closed — `test.skip(true, "not testable: e2e never closes inventory periods (design 2026-11-23)")` with full annotations; list it in bug-list section 3. `TC-SC-060004` a second file (store `E2E-141B`) for a posted day → the SC shows the late-lines warning; the late lines have no SC id (`scDetail`); after void the new pending SC holds both the old and late lines (`afterAll` also cleans `E2E-141B`).
- **07 calendar** — `TC-SC-070001` for the current month: the posted day shows Posted, a pending day Pending post, a day imported with only net-0 lines No sales, and two `pastDays` without imports No file; today never shows No file. Data guard: `test.skip(pastDays(...) === null, "month too young: needs 2 past days before yesterday")`.

- [ ] **Step 1:** Write groups 06–07.
- [ ] **Step 2:** Run 140 and 141 together: `bun run test -- --project=chromium tests/140-import-pos.spec.ts tests/141-sales-consumption.spec.ts` — twice, no reset between. Both runs: every case passes or is pinned with a bug-list row. After the second run, `scList({ status: "posted" })` for both store keys' days is empty (Review Focus 5).
- [ ] **Step 3:** Fill the bug list (each pin: spec, TC-ID, what happens vs expected, repro), section 3 lists: two-brand day, Micros overwrite of a posted day, void in a closed period.
- [ ] **Step 4:** `bun audit:coverage`, `bun audit:spec-health`, `bun audit:tc-ids`, pre/exp audit, `bun docs:user-stories`, `bun test:unit`; `git restore tests/results`.
- [ ] **Step 5:** Commit `test(141): void, ยอดขายมาหลัง post, ปฏิทิน + bug list และรายงาน coverage`.
