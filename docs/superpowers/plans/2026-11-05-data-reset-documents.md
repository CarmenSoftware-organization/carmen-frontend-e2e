# `data:reset` documents, stock and verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After plan 2's steps, `bun run data:reset --yes` also seeds the spec's step-2 documents and stock on TEST BU
through the real workflow (as the role that does each step), then reads back counts per document type and state
and exits non-zero naming any short row.

**Architecture:** New `scripts/data-reset/docs/` modules, one per document family, each a pure *plan* (which docs, in
which target state) plus a runner that creates the doc and walks it through its workflow transitions with the
right session. A shared `transition()` reads `doc_version` before each state change. A `SeedContext` resolved once
after master/mapping/workflow steps carries every id the payloads need. `verify-dataset.ts` counts per row with
list filters and prints doc numbers per row.

**Tech Stack:** Bun, TypeScript, vitest with `unit/data-reset/fake-backend.ts`, backend HTTP API.

**Spec:** `docs/superpowers/specs/2026-11-04-standard-test-dataset-design.md` (step 2 table, step 3, "Who calls what").
Builds on plan 2 (`docs/superpowers/plans/2026-11-05-data-reset-skeleton.md`, PR #78); branch from `feature/data-reset`.

## Global Constraints

- BU `GR2VYNKQ` only; every document is created and moved **as the role that does that step** (requestor, hod, purchase, fc, gm, storemanager); admin only for master/config. No direct DB writes; every state comes from a real transition.
- Every PR/PO/SR/GRN/CN state change sends the document's current `doc_version` (read by GET right before).
- Each seeded document's `description` (or `note` where there is no description) starts with `STD <row-key>` (e.g. `STD pr.hod`), so a failing test can be traced to its seed row.
- Counts are the spec's minimums for one run (Task 9). Dates: today in `Asia/Bangkok`, inside the period plan 2 opens.
- Unit tests: vitest under `unit/data-reset/`, `fakeBackend`, no network. Whole suite `bun run test:unit` stays green.
- Live runs only when the user says so (reset endpoint deployed, purchase role granted).

## Facts the tasks rely on (verified 2026-11-05, backend `apps/backend-gateway/src/application/*`)

- **PR** `POST /api/GR2VYNKQ/purchase-requests` `{stage_role:"create", details:{pr_date, description, requestor_id, workflow_id, department_id, purchase_request_detail:{add:[{product_id, location_id, delivery_point_id, delivery_date?, requested_qty, requested_unit_id, currency_id, exchange_rate:1, inventory_unit_id, foc_qty?, foc_unit_id?, description, comment}]}}}` → `draft`. **No price at create.** `PATCH …/:id/submit {doc_version, stage_role:"create", details:[{id, stage_status:"submit", stage_message:null}]}` → `in_progress`. `PATCH …/:id/approve` body discriminated by `stage_role`: `approve` lines `{id, purchase_request_id, stage_status:"approve", stage_message, approved_qty, approved_unit_id}`; `purchase` lines add `vendor_id, tax_profile_id, tax_rate, tax_amount, is_tax_adjustment, sub_total_price, net_amount, total_price, base_*, pricelist_detail_id:null, pricelist_no:null, foc_qty`. Last stage → `approved`. `PATCH …/:id/review {doc_version, stage_role, des_stage, details:[{id, stage_status:"review", stage_message}]}` (returned, stays `in_progress`). `PATCH …/:id/reject` → `voided`. `completed` = a PO was made from it (`POST /api/GR2VYNKQ/purchase-orders/confirm-pr {workflow_id, pr_ids}`). List shows `pr_status` + `workflow_current_stage`.
- **PR template** `POST /api/GR2VYNKQ/purchase-request-templates {name, workflow_id, is_active:true, note, purchase_request_template_detail:{add:[{product_id, location_id, delivery_point_id, requested_qty, requested_unit_id, currency_id, tax_profile_id, foc_qty:0}]}}`.
- **PO** blank `POST /api/GR2VYNKQ/purchase-orders {stage_role:"create", details:{po_type:"manual", vendor_id, currency_id, delivery_date, workflow_id, description, purchase_order_detail:{add:[{sequence, product_id, location_id, order_unit_id, order_qty, base_qty, price, sub_total_price, net_amount, total_price, tax_profile_id, tax_rate, foc_qty:0}]}}}`; `PATCH :id/submit`, `PATCH :id/approve {doc_version, stage_role:"approve", details:[{id, stage_status:"approve"}]}` per stage (FC, GM) → `approved`; `PATCH :id/reject` → `voided`; `POST :id/mark-sent` (from `approved`) → `sent_or_print`; GRN commit updates PO to `partial` / `completed`. Enum: draft, in_progress, approved, sent_or_print, partial, completed, closed, voided.
- **GRN** `POST /api/GR2VYNKQ/good-received-notes` (`doc_type:"purchase_order"` + `purchase_order_detail_id` per line, or `"manual"`), lines need `received_price`, `foc_qty`, optional `expired_at`; `PATCH :id/save {data:{}}` → `saved` (AVG posts stock here); `PATCH :id/commit {doc_version}` → `committed`. Server generates lot numbers.
- **CN** `POST /api/GR2VYNKQ/credit-notes {credit_note_type:"quantity_return", grn_id, vendor_id, currency_id, exchange_rate:1, cn_date, credit_note_detail:{add:[{product_id, location_id, return_qty, return_unit_id, return_base_qty, return_conversion_factor:1, price, cn_amount, tax_profile_id, tax_rate, is_tax_adjustment:false}]}}` → `draft` (lots come from the GRN); `PATCH :id/submit {doc_version}` → `completed`.
- **SR** `POST /api/GR2VYNKQ/store-requisitions {stage_role:"create", details:{sr_date, expected_date, requestor_id, workflow_id, department_id, from_location_id, to_location_id, description, store_requisition_detail:{add:[{product_id, requested_qty}]}}}`; `PATCH :id/submit {…, sr_date_pattern:"today"}`; `PATCH :id/approve` with `stage_role:"approve"` + `approved_qty`, then `stage_role:"issue"` + `issued_qty` → `completed`; `PATCH :id/reject` → `voided`. **No cancel endpoint.**
- **Stock in** `POST /api/GR2VYNKQ/stock-ins {adjustment_type_id, location_id, si_date, note, stock_in_detail:{add:[{product_id, qty, cost_per_unit, total_cost, expired_at?}]}}`, `PATCH :id/commit {doc_version}`; `adjustment_type_id` from `GET /api/config/GR2VYNKQ/adjustment-types` (seeded by tenant base seeds).
- **Par levels** `PATCH /api/config/GR2VYNKQ/products/:product_id {locations:{add:[{location_id, min_qty, max_qty, re_order_qty, par_qty}]}}`. 711 tiers: ratio = on_hand / par_qty; ≤ 0.25 Critical, ≤ 0.5 Warning, else Low (only when on_hand < par, non-direct location).
- **Price list** `POST /api/GR2VYNKQ/pricelists {name, status:"active", vendor_id, currency_id, effective_from_date, effective_to_date, pricelist_detail:{add:[{product_id, unit_id, price, price_without_tax, tax_amt:0, tax_profile_id, tax_rate:0, moq_qty:1, lead_time_days:1, is_preferred:true}]}}`.
- **Campaign (RFP)** `POST /api/GR2VYNKQ/pricelist-templates {name, status:"active", currency_id, validity_period, vendor_instructions, products:{add:[{product_id}]}}`, then `POST /api/GR2VYNKQ/request-for-pricings {name, pricelist_template_id, start_date, end_date, vendors:{add:[{vendor_id, contact_person, contact_phone, contact_email}]}}`. **No status column** — Active/Draft/Expired is derived by the frontend.
- **Counts** `GET <list>?perpage=1&filter=<field>:<v1>,<v2>` → `paginate.total`. Fields: PR `pr_status`, PO `po_status`, GRN/CN/SR `doc_status`, price list `status`. Lists: `/api/purchase-requests?bu_code=GR2VYNKQ`, `/api/store-requisitions?bu_code=GR2VYNKQ`, `/api/GR2VYNKQ/{purchase-orders,good-received-notes,credit-notes,pricelists,request-for-pricings}`.
- Master after `seed:master` (sample): products 11110001–11110050 (no location links, cost 0), 40 locations (first inventory by code `1AG01`), THB only, delivery point MAIN, tax profiles None / Vat 7%. First vendor by code `A023` has **no email** (plan 2's `checkMasterShape` would fail).

## Review Focus

- **A transition answers 409 / stale `doc_version`** (another step touched the doc) → re-read the version and retry once; a second failure records the row as failed with the HTTP status, never silently skips. Test in Task 2.
- **A chain fails half-way** (e.g. HOD approve 400 on PR 7 of 18) → the runner records that doc's row as short, carries on with the next doc, and Task 9's verify exits 1 naming the row; no exception escapes and aborts the whole seed. Test in Task 4 and Task 9.
- **`confirm-pr` turns PRs `completed`** → only the one PR reserved for "Completed" is ever sent to `confirm-pr`; every PO row is a manual PO, so the 5 "Approved, eligible for PO" PRs survive. Test in Task 5.
- **Stock lands in a different period or not at all** (GRN / stock-in dated outside the open period) → all dates are today (Bangkok), and Task 3's runner reads `/inventory-periods/current` first and refuses to post if it does not cover today. Test in Task 3.
- **The frontend's derived Campaign status** (Active / Draft / Expired from dates) → the builder reads the frontend's derivation before choosing dates; the test pins the three date pairs relative to today. Test in Task 8.

---

### Task 1: Plan-2 fix-ups: PR workflow through GM, SR workflow, first vendor ready

User decision (2026-11-05): every PR passes GM. First vendor (by code) must have an email (spec step 1).

**Files:** Modify `scripts/data-reset/fixtures/workflows.json`, `scripts/data-reset/workflow-template.ts`, `unit/data-reset/workflow-template.test.ts`, `scripts/data-reset/mappings.ts`, `unit/data-reset/mappings.test.ts`, `scripts/data-reset/README.md`, `CLAUDE.md` (data:reset section).

**Interfaces:**
- Fixture order: `0 Purchase Request` (stages `Create Request(create: requestor, purchase) → HOD Approval(approve, is_hod) → Purchase(purchase: purchase) → GM Approval(approve: gm)`, `routing_rules: []`), `1 General PO` (unchanged), `2 Store Requisition` (`workflow_type:"store_requisition"`, stages `Create Request(create: purchase, requestor, storemanager) → Store Approval(approve: purchase) → Issue(issue: purchase, storemanager)`; use the SR roles `apps/micro-business/src/master/workflows/workflow-stage-role.helper.ts` allows and ledger a ruling if they differ). `WorkflowTemplate.workflow_type` gains `"store_requisition"`.
- `ensureFirstVendorReady(admin: ApiClient, cfg: ResetConfig): Promise<string[]>` in `mappings.ts`, run by `seedMappings` before `checkMasterShape`: if the first vendor by code has no contact email, `PATCH /api/config/GR2VYNKQ/vendors/:id` with `vendor_contact:{add:[{name:"STD contact", email:"carmensoftware.dev+vendor@gmail.com", phone:"0800000000", is_primary:true}]}` (shape of `seed-master/mappers/vendor.ts`; confirm with one live GET of the detail before relying on it). Returns problems.

- [ ] **Step 1: Tests** — fixture test expects the PR stage list above with `routing_rules: []` and the SR workflow's 3 stages; `ensureFirstVendorReady`: vendor detail without email → exactly one PATCH with that body; with an email → no PATCH; PATCH 400 → `["first vendor A023: could not add an email (400)"]`.
- [ ] **Step 2: Run** `bun run test:unit -- unit/data-reset` — Expected: FAIL on the changed expectations.
- [ ] **Step 3: Implement**; drop `GM_THRESHOLD` and the README/CLAUDE.md text about the 100,000 rule (say "every PR passes GM").
- [ ] **Step 4: Run** the same — Expected: PASS.
- [ ] **Step 5: Commit** `fix(data-reset): PR ผ่าน GM ทุกใบ, เพิ่ม workflow SR, เติมอีเมลให้ vendor แรก`

### Task 2: Seed context, transition helper, row ledger

**Files:** Create `scripts/data-reset/docs/context.ts`, `scripts/data-reset/docs/transition.ts`, `scripts/data-reset/docs/row-ledger.ts`. Tests `unit/data-reset/docs-context.test.ts`, `unit/data-reset/docs-transition.test.ts`.

**Interfaces:**
- `SeedContext = { today: string; users: Record<string, TestUserInfo>; departments: { first: Id; second: Id }; locations: { first: Id; second: Id }; products: Array<{ id: string; code: string; unitId: string }>; vendor: { id: string; email: string }; currencyId: string; deliveryPointId: string; taxProfileId: string; workflows: { pr: string; po: string; sr: string }; adjustmentTypeId: string }`, `Id = { id: string; name: string }`. `resolveSeedContext(sessions, cfg, users, now): Promise<SeedContext>` — locations = first two **inventory** locations by code; products = first 10 by code; tax profile "None"; currency THB; throws naming whatever is missing.
- `transition(client: ApiClient, docPath: string, action: string, body: (docVersion: number, doc: any) => unknown): Promise<{ ok: boolean; status: number; doc?: any }>` — GET `docPath`, PATCH `${docPath}/${action}` with `body(doc_version, doc)`; on 409 re-read and retry once. `createDoc(client, listPath, body): Promise<{ ok: boolean; status: number; id?: string; no?: string }>`.
- `RowLedger` — `record(row: string, docNo: string | null, ok: boolean, why?: string)`, `rows(): Record<string, { docNos: string[]; failures: string[] }>`; one per run, consumed by Task 9.

- [ ] **Step 1: Tests** — `resolveSeedContext` against a fake backend picks `1AG01` and the next inventory code (skipping a direct location in between), THB, MAIN, "None"; missing PR workflow → throws `"no Purchase Request workflow in GR2VYNKQ"`. `transition` sends the doc_version it just read; 409 then 200 → ok after exactly 2 PATCHes; two 409s → `ok:false, status:409`; a 400 → no retry. `RowLedger` groups doc numbers and failures per row.
- [ ] **Step 2: Run** `bun run test:unit -- unit/data-reset/docs-context.test.ts unit/data-reset/docs-transition.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same — Expected: PASS.
- [ ] **Step 5: Commit** `feat(data-reset): seed context และ helper เปลี่ยนสถานะเอกสาร`

### Task 3: Stock — par levels, on hand at 2 locations, lots

**Files:** Create `scripts/data-reset/docs/stock.ts`; test `unit/data-reset/docs-stock.test.ts`.

**Interfaces:**
- `planStock(ctx: SeedContext): { parLevels: Array<{ productId: string; locationId: string; par_qty: number; min_qty: number; max_qty: number; re_order_qty: number }>; stockIns: Array<{ row: string; locationId: string; lines: Array<{ productId: string; qty: number; cost: number; expiredAt?: string }> }> }` — par 100 (min 10, max 150, re-order 50) for products 1–3 at location 1; stock-ins: location 1 products 1–3 qty 20 / 40 / 80 (Critical / Warning / Low), products 4–8 qty 200 cost 10; location 2 products 4–8 qty 100; one lot of product 9 at location 1 `expiredAt` = today − 30 days (`stock.expired`) and one `expiredAt` = today + 7 days (`stock.near-expiry`).
- `seedStock(sessions, cfg, ctx, ledger): Promise<StepResult>` — admin PATCHes par levels; storemanager POSTs + commits each stock-in; first checks `/api/GR2VYNKQ/inventory-periods/current` covers `ctx.today`, else fails the step without posting.

- [ ] **Step 1: Tests** — tier quantities give ratios 0.2 / 0.4 / 0.8 against par 100; expiry dates are `2026-10-06` / `2026-11-12` for `today:"2026-11-05"`; current period not covering today → no write, failed `"no open period covers 2026-11-05 — stock not posted"`; happy path records rows `stock.on-hand.l1`, `stock.on-hand.l2`, `stock.expired`, `stock.near-expiry`, `stock.tiers`.
- [ ] **Step 2–4:** run (FAIL) → implement → run (PASS) `bun run test:unit -- unit/data-reset/docs-stock.test.ts`.
- [ ] **Step 5: Commit** `feat(data-reset): สต๊อกคงเหลือ ระดับ par และ lot หมดอายุ`

### Task 4: Purchase requests and the PR template

**Files:** Create `scripts/data-reset/docs/purchase-requests.ts`; test `unit/data-reset/docs-pr.test.ts`.

**Interfaces:**
- `PrTarget = "draft" | "hod" | "purchase" | "gm" | "approved" | "returned" | "rejected" | "void" | "completed-reserve" | "second-dept"`; `planPurchaseRequests(ctx): Array<{ row: string; target: PrTarget; requestor: string; departmentId: string; lines: PrLine[]; deliveryDate: string | null; highValue: boolean }>` with exactly: draft ×3, hod ×18 (6 with 2 lines, 1 with `foc_qty:1`), purchase ×8, gm ×2 (high value), approved ×5 (one with `deliveryDate:null`), returned ×1, rejected ×1, void ×1, completed-reserve ×1, second-dept ×1 (requestor `owner`, second department, left at HOD). Row keys `pr.<target>`.
- Chain: create (requestor) → submit (requestor) → approve `stage_role:"approve"` (hod) → approve `stage_role:"purchase"` with vendor + price (purchase; high value: unit price 60,000 × qty 2, else 100 × qty) → approve (gm). Stop where the target says. `returned`: at HOD, `review` with `des_stage:"Create Request"` (hod). `rejected`: at HOD, `reject` (hod). `void`: at Purchase, `reject` (purchase). `completed-reserve`: approved, handed to Task 5.
- `seedPurchaseRequests(sessions, cfg, ctx, ledger): Promise<StepResult & { reservedForPo: string }>`; `seedPrTemplate(sessions, cfg, ctx, ledger): Promise<StepResult>` — one active template (2 lines) as purchase, row `pr-template.active`.

- [ ] **Step 1: Tests** — plan counts per row exactly as above; action sequence per target against a fake backend (e.g. `gm` → create, submit, approve(approve), approve(purchase), stop; `void` → … approve(approve), reject by purchase); each call carries the token of the right account; `reservedForPo` is the `completed-reserve` PR id; a failing HOD approve on one PR records a `pr.hod` failure and the next PR still runs.
- [ ] **Step 2–4:** FAIL → implement → PASS `bun run test:unit -- unit/data-reset/docs-pr.test.ts`.
- [ ] **Step 5: Commit** `feat(data-reset): PR ทุกสถานะตามตาราง และ PR template`

### Task 5: Purchase orders

**Files:** Create `scripts/data-reset/docs/purchase-orders.ts`; test `unit/data-reset/docs-po.test.ts`.

**Interfaces:**
- `planPurchaseOrders(ctx): Array<{ row: string; target: "draft" | "rejected" | "approved" | "sent" | "for-grn-full" | "for-grn-partial" }>` — one each; all **manual** POs for `ctx.vendor` at location 1, 2 lines.
- Chain: create + submit (purchase) → approve (fc) → approve (gm) → `mark-sent` (purchase) for `sent`, `for-grn-*`; `rejected`: reject at FC (fc); `draft`: create only.
- `seedPurchaseOrders(sessions, cfg, ctx, ledger, reservedPr: string): Promise<StepResult & { forGrn: { full: string; partial: string } }>` — also calls `confirm-pr` once with `reservedPr` (row `pr.completed`) and walks that PO to approved (row `po.from-pr`).

- [ ] **Step 1: Tests** — `confirm-pr` called exactly once with exactly `[reservedPr]`; no other PR id appears in any PO request; action sequences per target; `rejected` uses the fc session.
- [ ] **Step 2–4:** FAIL → implement → PASS `bun run test:unit -- unit/data-reset/docs-po.test.ts`.
- [ ] **Step 5: Commit** `feat(data-reset): PO ทุกสถานะตามตาราง`

### Task 6: GRN and credit notes

**Files:** Create `scripts/data-reset/docs/receiving.ts`; test `unit/data-reset/docs-grn-cn.test.ts`.

**Interfaces:**
- `seedReceiving(sessions, cfg, ctx, ledger, forGrn: { full: string; partial: string }): Promise<StepResult>` as purchase:
  - `grn.committed`: GRN from `forGrn.full` (all qty) → save → commit (PO → `completed`, row `po.completed`).
  - `grn.partial`: GRN from `forGrn.partial` (half of line 1) → save → commit (PO → `partial`, row `po.partial`).
  - `grn.received`: manual GRN, 2 lines → save only (`saved`).
  - `grn.draft`: manual GRN, 2 lines → create only (`draft`).
  - `cn.draft`: CN `quantity_return` on `grn.committed`, qty 1 → create only. `cn.committed`: second CN on the same GRN → submit (`completed`).
- Spec's "one item without storage location" on the received GRN: leave the shelf / storage field empty on line 2 if the GRN line has one; ledger a ruling if it does not exist.

- [ ] **Step 1: Tests** — GRN-from-PO lines carry each `purchase_order_detail_id`; partial qty = half of line 1; both CNs reference the committed GRN id; the draft GRN gets no `save`; the received GRN gets `save` and no `commit`.
- [ ] **Step 2–4:** FAIL → implement → PASS `bun run test:unit -- unit/data-reset/docs-grn-cn.test.ts`.
- [ ] **Step 5: Commit** `feat(data-reset): GRN และ credit note ตามตาราง`

### Task 7: Store requisitions

**Files:** Create `scripts/data-reset/docs/store-requisitions.ts`; test `unit/data-reset/docs-sr.test.ts`.

**Interfaces:**
- `seedStoreRequisitions(sessions, cfg, ctx, ledger): Promise<StepResult>` — location 1 (stock from Task 3) → location 2, products 4–5, qty 5, created by purchase: `sr.draft` ×2 (create only), `sr.approve` ×2 (submit), `sr.ready-for-issue` ×1 (submit → approve by purchase), `sr.cancelled` ×1 (submit → reject by purchase → `voided`; no cancel endpoint), `sr.completed` ×1 (submit → approve → issue).

- [ ] **Step 1: Tests** — counts and action sequences per row; the issue call carries `issued_qty` = approved qty; reject uses `stage_role:"approve"`.
- [ ] **Step 2–4:** FAIL → implement → PASS `bun run test:unit -- unit/data-reset/docs-sr.test.ts`.
- [ ] **Step 5: Commit** `feat(data-reset): ใบเบิกสินค้าตามตาราง`

### Task 8: Price lists and campaigns

**Files:** Create `scripts/data-reset/docs/pricing.ts`; test `unit/data-reset/docs-pricing.test.ts`.

**Interfaces:**
- `planCampaignDates(today: string): Record<"active" | "draft" | "expired", { start_date: string; end_date: string }>` and `seedPricing(sessions, cfg, ctx, ledger): Promise<StepResult>` as purchase: `pricelist.active` ×3 (vendor `ctx.vendor`, products 1–5, `effective_from_date` today−1, `effective_to_date` today+90); one pricelist template (products 1–5); RFPs `campaign.active`, `campaign.draft`, `campaign.expired`, each with `ctx.vendor` attached (`contact_email` = its email). Dates follow the frontend's status derivation — read the request-price-list list page under `carmen-frontend/routes/vendor-management/` first; expected: active = start ≤ today ≤ end, draft = start after today, expired = end before today. Ledger the rule actually found.

- [ ] **Step 1: Tests** — `planCampaignDates("2026-11-05")` → active `2026-11-04…2026-12-05`, draft `2026-11-20…2026-12-20`, expired `2026-10-01…2026-10-31` (adjust to the derivation found, keeping one of each); each RFP has exactly one vendor with the vendor's email; 3 pricelists, all `status:"active"`, covering today.
- [ ] **Step 2–4:** FAIL → implement → PASS `bun run test:unit -- unit/data-reset/docs-pricing.test.ts`.
- [ ] **Step 5: Commit** `feat(data-reset): price list และ campaign ตามตาราง`

### Task 9: Verify and wire into `data:reset`

**Files:** Create `scripts/data-reset/verify-dataset.ts`; modify `scripts/data-reset/index.ts`, `scripts/data-reset/README.md`, `CLAUDE.md`; tests `unit/data-reset/verify-dataset.test.ts`, extend `unit/data-reset/run.test.ts`.

**Interfaces:**
- `EXPECTED_ROWS: Array<{ row: string; list: string; field: string; values: string[]; min: number; stage?: string }>` — whole-BU minimums: PR `draft` ≥ 3; PR `in_progress` at stage "HOD Approval" ≥ 19 (18 + second-dept), "Purchase" ≥ 8, "GM Approval" ≥ 2, "Create Request" (returned) ≥ 1; PR `approved` ≥ 5; PR `completed` ≥ 1; PR `voided` ≥ 2; PR templates active ≥ 1; PO `draft` ≥ 1, `voided` ≥ 1, `approved` ≥ 2, `sent_or_print` ≥ 1, `partial` ≥ 1, `completed` ≥ 1; GRN `draft` ≥ 1, `saved` ≥ 1, `committed` ≥ 2; CN `draft` ≥ 1, `completed` ≥ 1; SR `draft` ≥ 2, `in_progress` ≥ 3, `voided` ≥ 1, `completed` ≥ 1; pricelist `active` ≥ 3; RFP ≥ 3. Stage counts filter on `workflow_current_stage` in the same list call (confirm the key with one live GET; fall back to counting the first 100 rows client-side and ledger it).
- `verifyDataset(sessions, cfg, ledger): Promise<{ short: string[]; table: string }>` — `short` lines read `"<row>: expected ≥ <min>, found <n> (seeded: <doc nos>)"`.
- `runDataReset` order after period: stock → pr-template → PRs → POs → receiving → SRs → pricing → verify; every `StepResult` joins the summary; exit 1 iff any failure or any `short` row. `--dry-run` prints the document plan counts per row instead.

- [ ] **Step 1: Tests** — `verifyDataset` with one row under its minimum → `short` names it with expected vs found and the ledger's doc numbers; run test: happy path calls every document step in the order above and exits 0; a short row → exit 1.
- [ ] **Step 2–4:** FAIL → implement → PASS `bun run test:unit` (whole suite).
- [ ] **Step 5:** `bun run data:reset --dry-run` against dev — Expected: exit 1 at step 0 (purchase role) or 0 with the document plan printed; only GETs.
- [ ] **Step 6: Commit** `feat(data-reset): สร้างเอกสารและสต๊อกตามตาราง แล้วตรวจนับก่อนจบ`
- [ ] **Step 7 (only when the user says the backend is deployed and purchase is granted):** `bun run data:reset --yes`; Expected: exit 0, summary with doc numbers per row. Then `bun run test` once and report which previously-skipping cases now run.
